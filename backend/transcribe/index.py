"""
Транскрибация через Yandex SpeechKit v2 longRunningRecognize.
Схема:
  POST: скачивает MP3 → загружает в YOS → запускает async STT → ждёт результат
  GET ?comm_id=...: возвращает кэш из БД
"""
import json
import os
import time
import urllib.request
import psycopg2

YANDEX_API_KEY = os.environ.get('YANDEX_API_KEY', '')
DATABASE_URL   = os.environ.get('DATABASE_URL', '')
SCHEMA         = os.environ.get('MAIN_DB_SCHEMA', 't_p87080492_botamin_analytics_da')
YOS_KEY        = os.environ.get('YOS_ACCESS_KEY', '')
YOS_SECRET     = os.environ.get('YOS_SECRET_KEY', '')
YOS_BUCKET     = 'siteactiv-audio'
YOS_REGION     = 'ru-central1'
YOS_HOST       = 'storage.yandexcloud.net'

STT_ASYNC_URL = 'https://transcribe.api.cloud.yandex.net/speech/stt/v2/longRunningRecognize'
OPERATION_URL = 'https://operation.api.cloud.yandex.net/operations/'


# ── S3 upload через boto3 ────────────────────────────────────────────────

def yos_upload(data: bytes, key: str) -> str:
    import boto3
    s3 = boto3.client(
        's3',
        endpoint_url=f'https://{YOS_HOST}',
        aws_access_key_id=YOS_KEY,
        aws_secret_access_key=YOS_SECRET,
        region_name=YOS_REGION,
    )
    s3.put_object(Bucket=YOS_BUCKET, Key=key, Body=data, ContentType='audio/mpeg')
    return f'https://{YOS_HOST}/{YOS_BUCKET}/{key}'


# ── SpeechKit async ──────────────────────────────────────────────────────

def ya_request(url, method='GET', body=None):
    data = json.dumps(body).encode() if body else None
    req  = urllib.request.Request(
        url, data=data, method=method,
        headers={'Authorization': f'Api-Key {YANDEX_API_KEY}', 'Content-Type': 'application/json'},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read())


def start_recognition(yos_url: str) -> str:
    # Без audioChannelCount — Яндекс микширует каналы в моно и делает диаризацию по голосу
    body = {
        'config': {'specification': {
            'languageCode':          'ru-RU',
            'model':                 'general',
            'audioEncoding':         'MP3',
            'enableSpeakerLabeling': True,
            'literature_text':       False,
        }},
        'audio': {'uri': yos_url},
    }
    result = ya_request(STT_ASYNC_URL, method='POST', body=body)
    return result.get('id', '')


def poll_operation(op_id: str, max_wait: int = 25) -> dict:
    deadline = time.time() + max_wait
    while time.time() < deadline:
        op = ya_request(OPERATION_URL + op_id)
        if op.get('done'):
            return op
        time.sleep(3)
    return {'done': False, '_op_id': op_id}


# ── Парсинг транскрипта ──────────────────────────────────────────────────

def parse_transcript(op: dict) -> dict:
    if 'error' in op:
        return {'error': op['error'].get('message', 'Ошибка распознавания')}

    chunks = op.get('response', {}).get('chunks', [])
    raw = []
    for chunk in chunks:
        alts = chunk.get('alternatives', [])
        if not alts:
            continue
        best = alts[0]
        text = best.get('text', '').strip()
        if not text:
            continue
        words = best.get('words', [])
        start = 0.0
        speaker_tag = None
        if words:
            st = words[0].get('startTime', '0s')
            start = float(str(st).replace('s', ''))
            speaker_tag = words[0].get('speakerTag')
        channel = str(chunk.get('channelTag', '1'))
        raw.append({'text': text, 'start': round(start, 1),
                    'speaker_tag': speaker_tag, 'channel': channel})

    channels     = set(r['channel'] for r in raw)
    speaker_tags = set(r['speaker_tag'] for r in raw if r['speaker_tag'] is not None)
    print(f'[DEBUG] channels={channels} speakerTags={speaker_tags}')
    for r in raw:
        print(f'[DEBUG] ch={r["channel"]} tag={r["speaker_tag"]} t={r["start"]} text={r["text"][:60]}')

    replicas  = []
    full_text = []
    seen      = set()
    has_both  = '1' in channels and '2' in channels

    if has_both:
        # Стерео: канал 1 = оператор, канал 2 = клиент.
        # SpeechKit дублирует реплики на оба канала — убираем дубли.
        ch1_texts = {r['text'] for r in raw if r['channel'] == '1'}
        for r in sorted(raw, key=lambda x: x['start']):
            if r['channel'] == '1':
                speaker = 'operator'
            else:
                if r['text'] in ch1_texts:
                    continue  # дубль с канала 1
                speaker = 'client'
            key = (r['start'], r['text'][:40])
            if key in seen:
                continue
            seen.add(key)
            label = 'Оператор' if speaker == 'operator' else 'Клиент'
            replicas.append({'speaker': speaker, 'speaker_label': label,
                             'text': r['text'], 'start_time': r['start'], 'segment': 'live'})
            full_text.append(f'{label}: {r["text"]}')

    elif len(speaker_tags) >= 2:
        # Моно + диаризация по speakerTag
        # Первый спикер с длинной фразой = оператор (он звонит и представляется)
        sorted_raw = sorted(raw, key=lambda x: x['start'])
        operator_tag = None
        for r in sorted_raw:
            if r['speaker_tag'] and len(r['text']) > 15:
                operator_tag = r['speaker_tag']
                break
        if operator_tag is None and sorted_raw:
            operator_tag = sorted_raw[0]['speaker_tag']

        for r in sorted_raw:
            key = (r['start'], r['text'][:40])
            if key in seen:
                continue
            seen.add(key)
            tag     = r['speaker_tag']
            speaker = 'operator' if tag == operator_tag else 'client'
            label   = 'Оператор' if speaker == 'operator' else 'Клиент'
            replicas.append({'speaker': speaker, 'speaker_label': label,
                             'text': r['text'], 'start_time': r['start'], 'segment': 'live'})
            full_text.append(f'{label}: {r["text"]}')

    else:
        # Моно без диаризации
        for r in sorted(raw, key=lambda x: x['start']):
            key = (r['start'], r['text'][:40])
            if key in seen:
                continue
            seen.add(key)
            replicas.append({'speaker': 'unknown', 'speaker_label': 'Неизвестно',
                             'text': r['text'], 'start_time': r['start'], 'segment': 'live'})
            full_text.append(r['text'])

    replicas.sort(key=lambda r: r['start_time'])

    # IVR детект
    ivr_kw = ['нажмите', 'внутренний номер', 'дождитесь ответа', 'ваш звонок',
               'для соединения', 'записываются', 'контроля качества',
               'добро пожаловать', 'вы позвонили']

    def is_ivr(text):
        t = text.lower()
        return any(k in t for k in ivr_kw)

    ivr_end   = 0
    found_ivr = False
    for idx, r in enumerate(replicas):
        if is_ivr(r['text']):
            found_ivr = True
            ivr_end   = idx + 1
        elif found_ivr:
            break

    if found_ivr:
        for idx, r in enumerate(replicas):
            if idx < ivr_end:
                r['segment']       = 'ivr'
                r['speaker']       = 'ivr'
                r['speaker_label'] = 'Автоответчик'

    live = [r for r in replicas if r['segment'] == 'live']
    return {
        'full_text':         '\n'.join(full_text),
        'replicas':          replicas,
        'replica_count':     len(live),
        'operator_replicas': sum(1 for r in live if r['speaker'] == 'operator'),
        'client_replicas':   sum(1 for r in live if r['speaker'] == 'client'),
        'has_ivr':           found_ivr,
        'all_ivr':           found_ivr and ivr_end == len(replicas),
    }


# ── Audio download ───────────────────────────────────────────────────────

def download_audio(url: str) -> bytes:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


# ── DB ───────────────────────────────────────────────────────────────────

def get_db():
    return psycopg2.connect(DATABASE_URL)


def get_cached(comm_id):
    if not comm_id:
        return None
    conn = get_db(); cur = conn.cursor()
    cur.execute(
        f"SELECT full_text,replicas,replica_count,operator_replicas,client_replicas "
        f"FROM {SCHEMA}.call_transcripts WHERE comm_id=%s", (comm_id,)
    )
    row = cur.fetchone(); cur.close(); conn.close()
    if not row or not (row[2] or 0):
        return None
    return {'comm_id': comm_id, 'full_text': row[0] or '', 'replicas': row[1] or [],
            'replica_count': row[2] or 0, 'operator_replicas': row[3] or 0,
            'client_replicas': row[4] or 0, 'status': 'done', 'cached': True}


def save_transcript(comm_id, date, duration, duration_sec, parsed):
    conn = get_db(); cur = conn.cursor()
    cur.execute(
        f"""INSERT INTO {SCHEMA}.call_transcripts
            (comm_id,date,duration,duration_sec,full_text,replicas,
             replica_count,operator_replicas,client_replicas)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (comm_id) DO UPDATE SET
              full_text=EXCLUDED.full_text, replicas=EXCLUDED.replicas,
              replica_count=EXCLUDED.replica_count,
              operator_replicas=EXCLUDED.operator_replicas,
              client_replicas=EXCLUDED.client_replicas,
              updated_at=NOW()""",
        (comm_id, date, duration, duration_sec,
         parsed['full_text'],
         json.dumps(parsed['replicas'], ensure_ascii=False),
         parsed['replica_count'], parsed['operator_replicas'], parsed['client_replicas'])
    )
    conn.commit(); cur.close(); conn.close()


# ── CORS ─────────────────────────────────────────────────────────────────

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


# ── Handler ──────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """Транскрибирует звонок через Yandex SpeechKit с диаризацией."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')

    if method == 'GET':
        params  = event.get('queryStringParameters') or {}
        comm_id = params.get('comm_id', '')
        op_id   = params.get('operation_id', '')

        cached = get_cached(comm_id)
        if cached:
            return {'statusCode': 200, 'headers': CORS,
                    'body': json.dumps({**cached, 'status': 'done'}, ensure_ascii=False)}

        if op_id:
            op = ya_request(OPERATION_URL + op_id)
            if op.get('done'):
                parsed = parse_transcript(op)
                return {'statusCode': 200, 'headers': CORS,
                        'body': json.dumps({**parsed, 'status': 'done'}, ensure_ascii=False)}
            return {'statusCode': 200, 'headers': CORS,
                    'body': json.dumps({'status': 'processing', 'operation_id': op_id}, ensure_ascii=False)}

        return {'statusCode': 200, 'headers': CORS,
                'body': json.dumps({'status': 'processing'}, ensure_ascii=False)}

    # POST
    body         = json.loads(event.get('body') or '{}')
    comm_id      = body.get('comm_id', '')
    audio_url    = body.get('audio_url', '')
    date         = body.get('date', '')
    duration     = body.get('duration', '')
    duration_sec = int(body.get('duration_sec') or 0)

    cached = get_cached(comm_id)
    if cached:
        return {'statusCode': 200, 'headers': CORS,
                'body': json.dumps(cached, ensure_ascii=False)}

    if not audio_url:
        return {'statusCode': 400, 'headers': CORS,
                'body': json.dumps({'error': 'нет audio_url'}, ensure_ascii=False)}

    print(f'[AUDIO] downloading {comm_id}')
    audio_bytes = download_audio(audio_url)
    print(f'[AUDIO] {comm_id}: {len(audio_bytes)} bytes')

    yos_key = f'transcribe/{comm_id}.mp3'
    print(f'[YOS] uploading {comm_id}')
    yos_url = yos_upload(audio_bytes, yos_key)
    print(f'[YOS] done')

    op_id = start_recognition(yos_url)
    print(f'[STT] operation_id={op_id}')

    if not op_id:
        return {'statusCode': 200, 'headers': CORS,
                'body': json.dumps({'error': 'Не удалось запустить распознавание'}, ensure_ascii=False)}

    op = poll_operation(op_id, max_wait=25)

    if not op.get('done'):
        return {'statusCode': 200, 'headers': CORS,
                'body': json.dumps({'status': 'processing', 'operation_id': op_id,
                                    'comm_id': comm_id}, ensure_ascii=False)}

    parsed = parse_transcript(op)
    print(f'[DONE] {comm_id}: replicas={parsed.get("replica_count")} op={parsed.get("operator_replicas")} cl={parsed.get("client_replicas")}')

    if parsed.get('replica_count', 0) > 0 or parsed.get('all_ivr'):
        save_transcript(comm_id, date, duration, duration_sec, parsed)

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({**parsed, 'comm_id': comm_id, 'status': 'done', 'cached': False},
                           ensure_ascii=False)
    }