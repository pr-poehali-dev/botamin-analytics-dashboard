"""
Транскрибирует аудиозапись через Yandex SpeechKit STT. v7 (ФИНАЛЬНАЯ)
Схема:
  1. Проверяет кэш в БД
  2. Скачивает MP3 с CoMagic
  3. Загружает в Yandex Object Storage (storage.yandexcloud.net)
  4. Передаёт YOS-ссылку в SpeechKit longRunningRecognize (async)
  5. Ждёт результат (до 25 сек), при timeout возвращает operation_id
  GET ?operation_id=... — опрашивает статус, при done сохраняет в БД
"""
import json
import os
import base64
import time
import urllib.request
import urllib.error
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


# ── Yandex Object Storage upload через boto3 ───────────────────────────

def yos_upload(data: bytes, key: str, content_type: str = 'audio/mpeg') -> str:
    """Загружает файл в YOS через boto3. Возвращает публичный URL."""
    import boto3
    s3 = boto3.client(
        's3',
        endpoint_url=f'https://{YOS_HOST}',
        aws_access_key_id=YOS_KEY,
        aws_secret_access_key=YOS_SECRET,
        region_name=YOS_REGION,
    )
    s3.put_object(
        Bucket=YOS_BUCKET,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return f'https://{YOS_HOST}/{YOS_BUCKET}/{key}'


# ── SpeechKit async ────────────────────────────────────────────────────

def ya_request(url, method='GET', body=None):
    data = json.dumps(body).encode() if body else None
    req  = urllib.request.Request(
        url, data=data, method=method,
        headers={'Authorization': f'Api-Key {YANDEX_API_KEY}', 'Content-Type': 'application/json'},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read())


def start_recognition(yos_url: str) -> str:
    body = {
        'config': {'specification': {
            'languageCode':        'ru-RU',
            'model':               'general',
            'audioEncoding':       'MP3',
            'audioChannelCount':   2,
            'enableSpeakerLabeling': True,
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
    return {'done': False}


def parse_transcript(op: dict) -> dict:
    if 'error' in op:
        return {'error': op['error'].get('message', 'Ошибка распознавания')}
    chunks     = op.get('response', {}).get('chunks', [])
    full_text  = []
    replicas   = []
    # Канал 1 = оператор (менеджер), канал 2 = клиент
    # SpeechKit дублирует стерео — берём только канал 1 для оператора и канал 2 для клиента
    # Фильтруем дубли: одинаковый текст в ту же секунду на разных каналах
    seen = set()
    for chunk in chunks:
        alts = chunk.get('alternatives', [])
        if not alts:
            continue
        best = alts[0]
        text = best.get('text', '').strip()
        if not text:
            continue
        channel = chunk.get('channelTag', '1')
        start   = 0.0
        words   = best.get('words', [])
        if words:
            st = words[0].get('startTime', '0s')
            start = float(str(st).replace('s', ''))
        start_r = round(start, 1)
        # Ключ дедупликации: текст + время (игнорируем канал)
        key = (start_r, text[:40])
        if key in seen:
            continue
        seen.add(key)
        speaker = 'client' if channel == '1' else 'operator'
        label = 'Оператор' if speaker == 'operator' else 'Клиент'
        replicas.append({'speaker': speaker, 'speaker_label': label, 'text': text, 'start_time': start_r})
        full_text.append(f'{label}: {text}')
    replicas.sort(key=lambda r: r['start_time'])

    # Определяем автоответчик: если в начале идут только реплики клиента
    # с типичными IVR-фразами (нажмите, добро пожаловать, пресс и т.д.)
    ivr_keywords = ['нажмите', 'добро пожаловать', 'наберите', 'соединяем', 'оставайтесь', 'записываются', 'внутренний номер', 'пресс', 'press']
    ivr_end_idx = None
    for idx, r in enumerate(replicas):
        if r['speaker'] == 'operator':
            ivr_end_idx = idx
            break
        text_lower = r['text'].lower()
        is_ivr = any(kw in text_lower for kw in ivr_keywords)
        if not is_ivr and idx > 0:
            ivr_end_idx = idx
            break
    has_ivr = ivr_end_idx is not None and ivr_end_idx > 0

    for idx, r in enumerate(replicas):
        if has_ivr and idx < ivr_end_idx:
            r['segment'] = 'ivr'
        else:
            r['segment'] = 'live'

    return {
        'full_text':        '\n'.join(full_text),
        'replicas':         replicas,
        'replica_count':    len(replicas),
        'operator_replicas': sum(1 for r in replicas if r['speaker'] == 'operator'),
        'client_replicas':   sum(1 for r in replicas if r['speaker'] == 'client'),
        'has_ivr':           has_ivr,
        'ivr_end_idx':       ivr_end_idx,
    }


# ── DB ─────────────────────────────────────────────────────────────────

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
    if not row:
        return None
    replica_count = row[2] or 0
    # Если данные пустые — не отдаём из кэша, пересчитаем
    if replica_count == 0:
        return None
    return {'comm_id': comm_id, 'full_text': row[0] or '', 'replicas': row[1] or [],
            'replica_count': replica_count, 'operator_replicas': row[3] or 0,
            'client_replicas': row[4] or 0, 'status': 'done', 'cached': True}


def save_to_db(comm_id, audio_url, meta, transcript):
    if not comm_id:
        return
    conn = get_db(); cur = conn.cursor()
    cur.execute(
        f"""INSERT INTO {SCHEMA}.call_transcripts
            (comm_id,audio_url,date,duration,duration_sec,full_text,replicas,
             replica_count,operator_replicas,client_replicas)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (comm_id) DO UPDATE SET
              full_text=EXCLUDED.full_text, replicas=EXCLUDED.replicas,
              replica_count=EXCLUDED.replica_count,
              operator_replicas=EXCLUDED.operator_replicas,
              client_replicas=EXCLUDED.client_replicas""",
        (comm_id, audio_url, meta.get('date',''), meta.get('duration',''),
         meta.get('duration_sec',0), transcript.get('full_text',''),
         json.dumps(transcript.get('replicas',[]), ensure_ascii=False),
         transcript.get('replica_count',0), transcript.get('operator_replicas',0),
         transcript.get('client_replicas',0))
    )
    conn.commit(); cur.close(); conn.close()


# ── Handler ────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    cors = {'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'}

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    if not YANDEX_API_KEY:
        return {'statusCode': 500, 'headers': cors,
                'body': json.dumps({'error': 'YANDEX_API_KEY не настроен'}, ensure_ascii=False)}

    method = event.get('httpMethod', 'POST')
    params = event.get('queryStringParameters') or {}

    # ── GET: опрос операции ──────────────────────────────────────────
    if method == 'GET':
        op_id    = params.get('operation_id', '')
        comm_id  = params.get('comm_id', '')
        meta     = {'date': params.get('date',''), 'duration': params.get('duration',''),
                    'duration_sec': int(params.get('duration_sec', 0) or 0)}
        audio_url = params.get('audio_url', '')

        if not op_id:
            return {'statusCode': 400, 'headers': cors,
                    'body': json.dumps({'error': 'Нужен operation_id'}, ensure_ascii=False)}
        try:
            op = ya_request(OPERATION_URL + op_id)
        except Exception as e:
            return {'statusCode': 500, 'headers': cors,
                    'body': json.dumps({'error': str(e)}, ensure_ascii=False)}

        if not op.get('done'):
            return {'statusCode': 200, 'headers': {**cors, 'Content-Type': 'application/json'},
                    'body': json.dumps({'status': 'processing', 'operation_id': op_id}, ensure_ascii=False)}

        t = parse_transcript(op)
        if 'error' in t:
            return {'statusCode': 500, 'headers': cors,
                    'body': json.dumps({'error': t['error']}, ensure_ascii=False)}
        save_to_db(comm_id, audio_url, meta, t)
        t.update({'comm_id': comm_id, 'status': 'done', 'cached': False})
        return {'statusCode': 200, 'headers': {**cors, 'Content-Type': 'application/json'},
                'body': json.dumps(t, ensure_ascii=False)}

    # ── POST: запуск ─────────────────────────────────────────────────
    body_raw = event.get('body', '{}') or '{}'
    body     = json.loads(body_raw) if isinstance(body_raw, str) else (body_raw or {})
    audio_url = body.get('audio_url', '')
    comm_id   = body.get('comm_id', '')
    meta = {'date': body.get('date',''), 'duration': body.get('duration',''),
            'duration_sec': body.get('duration_sec', 0)}

    if not audio_url:
        return {'statusCode': 400, 'headers': cors,
                'body': json.dumps({'error': 'Нужен audio_url'}, ensure_ascii=False)}

    # Кэш
    cached = get_cached(comm_id)
    if cached:
        return {'statusCode': 200, 'headers': {**cors, 'Content-Type': 'application/json'},
                'body': json.dumps(cached, ensure_ascii=False)}

    # Шаг 1: скачиваем MP3
    try:
        req = urllib.request.Request(audio_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=60) as resp:
            mp3_bytes = resp.read()
        print(f'[AUDIO] {comm_id}: {len(mp3_bytes)} bytes')
    except Exception as e:
        return {'statusCode': 500, 'headers': cors,
                'body': json.dumps({'error': f'Ошибка скачивания: {str(e)}'}, ensure_ascii=False)}

    # Шаг 2: загружаем в YOS
    try:
        yos_key = f'calls/{comm_id}.mp3'
        yos_url = yos_upload(mp3_bytes, yos_key)
        print(f'[YOS] uploaded: {yos_url}')
    except Exception as e:
        return {'statusCode': 500, 'headers': cors,
                'body': json.dumps({'error': f'Ошибка YOS: {str(e)}'}, ensure_ascii=False)}

    # Шаг 3: запускаем SpeechKit async
    try:
        op_id = start_recognition(yos_url)
        print(f'[STT] operation_id: {op_id}')
    except urllib.error.HTTPError as e:
        code = e.code
        err  = e.read().decode('utf-8', errors='replace')
        print(f'[STT] HTTP {code}: {err[:300]}')
        if code == 429:
            return {'statusCode': 429, 'headers': cors,
                    'body': json.dumps({'error': 'rate_limit'}, ensure_ascii=False)}
        return {'statusCode': 500, 'headers': cors,
                'body': json.dumps({'error': f'SpeechKit HTTP {code}: {err[:200]}'}, ensure_ascii=False)}
    except Exception as e:
        return {'statusCode': 500, 'headers': cors,
                'body': json.dumps({'error': str(e)}, ensure_ascii=False)}

    # Шаг 4: ждём до 25 сек
    op = poll_operation(op_id, max_wait=25)

    if not op.get('done'):
        # Возвращаем operation_id — фронт опросит сам
        return {'statusCode': 200, 'headers': {**cors, 'Content-Type': 'application/json'},
                'body': json.dumps({
                    'status': 'started', 'operation_id': op_id,
                    'comm_id': comm_id, 'audio_url': audio_url,
                    'date': meta['date'], 'duration': meta['duration'],
                    'duration_sec': meta['duration_sec'],
                }, ensure_ascii=False)}

    t = parse_transcript(op)
    if 'error' in t:
        return {'statusCode': 500, 'headers': cors,
                'body': json.dumps({'error': t['error']}, ensure_ascii=False)}

    save_to_db(comm_id, audio_url, meta, t)
    t.update({'comm_id': comm_id, 'status': 'done', 'cached': False})
    return {'statusCode': 200, 'headers': {**cors, 'Content-Type': 'application/json'},
            'body': json.dumps(t, ensure_ascii=False)}