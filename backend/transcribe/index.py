"""
Транскрибация через AssemblyAI с диаризацией спикеров.
Схема:
  POST: скачивает MP3 → загружает в AssemblyAI → запускает транскрибацию → ждёт результат
  GET ?comm_id=...: возвращает кэш из БД
"""
import json
import os
import time
import urllib.request
import urllib.error
import psycopg2

ASSEMBLYAI_KEY = os.environ.get('ASSEMBLYAI_API_KEY', '')
DATABASE_URL   = os.environ.get('DATABASE_URL', '')
SCHEMA         = os.environ.get('MAIN_DB_SCHEMA', 't_p87080492_botamin_analytics_da')

UPLOAD_URL      = 'https://api.assemblyai.com/v2/upload'
TRANSCRIPT_URL  = 'https://api.assemblyai.com/v2/transcript'


# ── AssemblyAI helpers ───────────────────────────────────────────────────

def aai_request(url, method='GET', body=None, data=None, content_type='application/json'):
    if body is not None:
        data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={
            'Authorization': ASSEMBLYAI_KEY,
            'Content-Type': content_type,
        }
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def upload_audio(audio_bytes: bytes) -> str:
    """Загружает аудио в AssemblyAI, возвращает upload_url."""
    req = urllib.request.Request(
        UPLOAD_URL, data=audio_bytes, method='POST',
        headers={
            'Authorization': ASSEMBLYAI_KEY,
            'Content-Type': 'application/octet-stream',
        }
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        result = json.loads(resp.read())
    return result['upload_url']


def start_transcription(upload_url: str) -> str:
    """Запускает транскрибацию с диаризацией, возвращает transcript_id."""
    result = aai_request(TRANSCRIPT_URL, method='POST', body={
        'audio_url':         upload_url,
        'language_code':     'ru',
        'speaker_labels':    True,   # диаризация по голосу
        'speakers_expected': 2,      # оператор + клиент
    })
    return result['id']


def poll_transcription(transcript_id: str, max_wait: int = 55) -> dict:
    """Ждёт завершения транскрибации."""
    url      = f'{TRANSCRIPT_URL}/{transcript_id}'
    deadline = time.time() + max_wait
    while time.time() < deadline:
        result = aai_request(url)
        status = result.get('status')
        print(f'[AAI] status={status}')
        if status == 'completed':
            return result
        if status == 'error':
            return {'status': 'error', 'error': result.get('error', 'Ошибка AssemblyAI')}
        time.sleep(4)
    return {'status': 'processing', '_id': transcript_id}


# ── Парсинг результата AssemblyAI ────────────────────────────────────────

def parse_assemblyai(result: dict) -> dict:
    """Парсит ответ AssemblyAI в наш формат."""
    utterances = result.get('utterances') or []

    if not utterances:
        # Fallback: нет диаризации — берём words
        words = result.get('words') or []
        text  = result.get('text', '')
        if not text:
            return {'error': 'Транскрипт пуст'}
        return {
            'full_text':         text,
            'replicas':          [{'speaker': 'unknown', 'speaker_label': 'Неизвестно',
                                   'text': text, 'start_time': 0.0, 'segment': 'live'}],
            'replica_count':     1,
            'operator_replicas': 0,
            'client_replicas':   0,
            'has_ivr':           False,
            'all_ivr':           False,
        }

    # Определяем кто оператор: обычно первым говорит много (представляется)
    # AssemblyAI даёт speaker "A", "B", "C"...
    # Считаем суммарное кол-во слов на каждого спикера в первых 30 секундах
    speaker_words_early = {}
    for u in utterances:
        start_sec = u.get('start', 0) / 1000.0
        if start_sec < 30:
            spk = u.get('speaker', 'A')
            wc  = len(u.get('words', []))
            speaker_words_early[spk] = speaker_words_early.get(spk, 0) + wc

    # Спикер с наибольшим кол-вом слов в начале = оператор
    operator_spk = max(speaker_words_early, key=speaker_words_early.get) if speaker_words_early else 'A'
    print(f'[AAI] speaker_words_early={speaker_words_early} operator={operator_spk}')

    replicas  = []
    full_text = []

    for u in utterances:
        spk       = u.get('speaker', 'A')
        text      = u.get('text', '').strip()
        start_sec = round(u.get('start', 0) / 1000.0, 1)
        if not text:
            continue

        speaker = 'operator' if spk == operator_spk else 'client'
        label   = 'Оператор' if speaker == 'operator' else 'Клиент'
        replicas.append({
            'speaker':       speaker,
            'speaker_label': label,
            'text':          text,
            'start_time':    start_sec,
            'segment':       'live',
        })
        full_text.append(f'{label}: {text}')

    # IVR детект в начале
    ivr_kw = ['нажмите', 'внутренний номер', 'дождитесь ответа', 'ваш звонок',
               'для соединения', 'записываются', 'контроля качества',
               'добро пожаловать', 'вы позвонили', 'приветствует']

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


def save_transcript(comm_id, date, duration, duration_sec, parsed, audio_url=''):
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
              client_replicas=EXCLUDED.client_replicas,
              updated_at=NOW()""",
        (comm_id, audio_url, date, duration, duration_sec,
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
    """Транскрибирует звонок через AssemblyAI с диаризацией спикеров по голосу."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')

    if method == 'GET':
        params  = event.get('queryStringParameters') or {}
        comm_id = params.get('comm_id', '')
        cached  = get_cached(comm_id)
        if cached:
            return {'statusCode': 200, 'headers': CORS,
                    'body': json.dumps({**cached, 'status': 'done'}, ensure_ascii=False)}
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

    # 1. Скачиваем аудио
    print(f'[AUDIO] downloading {comm_id}')
    audio_bytes = download_audio(audio_url)
    print(f'[AUDIO] {comm_id}: {len(audio_bytes)} bytes')

    # 2. Загружаем в AssemblyAI
    print(f'[AAI] uploading {comm_id}')
    upload_url = upload_audio(audio_bytes)
    print(f'[AAI] uploaded ok')

    # 3. Запускаем транскрибацию
    transcript_id = start_transcription(upload_url)
    print(f'[AAI] transcript_id={transcript_id}')

    # 4. Ждём результат
    result = poll_transcription(transcript_id, max_wait=55)

    if result.get('status') == 'processing':
        return {'statusCode': 200, 'headers': CORS,
                'body': json.dumps({'status': 'processing', 'comm_id': comm_id,
                                    'transcript_id': transcript_id}, ensure_ascii=False)}

    if result.get('status') == 'error':
        return {'statusCode': 200, 'headers': CORS,
                'body': json.dumps({'error': result.get('error', 'Ошибка транскрибации')},
                                   ensure_ascii=False)}

    # 5. Парсим и сохраняем
    parsed = parse_assemblyai(result)
    print(f'[DONE] {comm_id}: replicas={parsed.get("replica_count")} op={parsed.get("operator_replicas")} cl={parsed.get("client_replicas")}')

    if parsed.get('replica_count', 0) > 0 or parsed.get('all_ivr'):
        save_transcript(comm_id, date, duration, duration_sec, parsed, audio_url)

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({**parsed, 'comm_id': comm_id, 'status': 'done', 'cached': False},
                           ensure_ascii=False)
    }
