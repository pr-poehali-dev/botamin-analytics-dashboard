"""
Транскрибация через Whisper + GPT-4o диаризация.
Схема:
  POST: скачивает MP3 → Whisper транскрибирует → GPT-4o делит на спикеров → сохраняет в БД
  GET ?comm_id=...: возвращает кэш из БД
"""
import json
import os
import urllib.request
import psycopg2

OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
DATABASE_URL   = os.environ.get('DATABASE_URL', '')
SCHEMA         = os.environ.get('MAIN_DB_SCHEMA', 't_p87080492_botamin_analytics_da')

WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions'
OPENAI_URL  = 'https://api.openai.com/v1/chat/completions'


# ── Шаг 1: Whisper — транскрибация с временными метками ─────────────────

def transcribe_whisper(audio_bytes: bytes, filename: str) -> list:
    """Транскрибирует аудио через Whisper, возвращает сегменты с timestamps."""
    boundary = 'Boundary7MA4YWxkTrZu0gW'
    parts = [
        (b'model',               b'whisper-1'),
        (b'language',            b'ru'),
        (b'response_format',     b'verbose_json'),
        (b'timestamp_granularities[]', b'segment'),
    ]
    body_parts = []
    for name, value in parts:
        body_parts.append(
            b'--' + boundary.encode() +
            b'\r\nContent-Disposition: form-data; name="' + name + b'"\r\n\r\n' +
            value
        )
    body_parts.append(
        b'--' + boundary.encode() +
        b'\r\nContent-Disposition: form-data; name="file"; filename="' + filename.encode() + b'"\r\n' +
        b'Content-Type: audio/mpeg\r\n\r\n' +
        audio_bytes
    )
    body_parts.append(b'--' + boundary.encode() + b'--')
    body = b'\r\n'.join(body_parts)

    req = urllib.request.Request(
        WHISPER_URL, data=body, method='POST',
        headers={
            'Authorization': f'Bearer {OPENAI_API_KEY}',
            'Content-Type': f'multipart/form-data; boundary={boundary}',
        }
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        result = json.loads(resp.read())

    return result.get('segments', [])


# ── Шаг 2: GPT-4o — диаризация (кто говорит) ────────────────────────────

def diarize_with_gpt(segments: list) -> dict:
    """Отправляет сегменты в GPT-4o, получает разметку спикеров."""
    segments_text = '\n'.join(
        f'[{round(s["start"], 1)}с] {s["text"].strip()}' for s in segments
    )

    prompt = f"""Ты анализируешь транскрипт исходящего звонка колл-центра.
Наш менеджер ЗВОНИТ клиентам и предлагает услуги по маркетингу и привлечению клиентов.

Транскрипт (формат [время] текст):
{segments_text}

Раздели реплики по спикерам и верни ТОЛЬКО JSON без markdown:
{{
  "replicas": [
    {{"start_time": 0.0, "speaker": "operator", "text": "текст"}},
    {{"start_time": 5.0, "speaker": "client", "text": "текст"}},
    {{"start_time": 1.0, "speaker": "ivr", "text": "текст автоответчика"}}
  ]
}}

Правила:
- "operator" — наш менеджер (звонит, предлагает услуги, спрашивает с кем поговорить)
- "client" — клиент (принял звонок, отвечает)
- "ivr" — автоответчик в начале (нажмите 1, вы позвонили, ваш звонок важен и т.п.)
- Объединяй последовательные реплики одного спикера в одну
- start_time бери из исходного транскрипта"""

    body = {
        'model': 'gpt-4o',
        'messages': [{'role': 'user', 'content': prompt}],
        'max_tokens': 4096,
        'temperature': 0,
        'response_format': {'type': 'json_object'},
    }
    data = json.dumps(body, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(
        OPENAI_URL, data=data, method='POST',
        headers={
            'Authorization': f'Bearer {OPENAI_API_KEY}',
            'Content-Type': 'application/json',
        }
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read())

    return json.loads(result['choices'][0]['message']['content'])


# ── Парсинг результата ───────────────────────────────────────────────────

def parse_gpt_transcript(gpt_result: dict) -> dict:
    replicas_raw = gpt_result.get('replicas', [])
    replicas = []
    full_text = []

    for r in replicas_raw:
        speaker = r.get('speaker', 'client')
        text    = r.get('text', '').strip()
        start   = float(r.get('start_time', 0.0))
        if not text:
            continue
        if speaker == 'operator':
            label = 'Оператор'
        elif speaker == 'ivr':
            label = 'Автоответчик'
        else:
            speaker = 'client'
            label = 'Клиент'
        segment = 'ivr' if speaker == 'ivr' else 'live'
        replicas.append({'speaker': speaker, 'speaker_label': label,
                         'text': text, 'start_time': round(start, 1), 'segment': segment})
        full_text.append(f'{label}: {text}')

    replicas.sort(key=lambda r: r['start_time'])
    live = [r for r in replicas if r['segment'] == 'live']
    return {
        'full_text':         '\n'.join(full_text),
        'replicas':          replicas,
        'replica_count':     len(live),
        'operator_replicas': sum(1 for r in live if r['speaker'] == 'operator'),
        'client_replicas':   sum(1 for r in live if r['speaker'] == 'client'),
        'has_ivr':           any(r['segment'] == 'ivr' for r in replicas),
        'all_ivr':           bool(replicas) and all(r['segment'] == 'ivr' for r in replicas),
    }


# ── Скачивание аудио ─────────────────────────────────────────────────────

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
    """Транскрибирует звонок: Whisper → текст, GPT-4o → разделение спикеров."""
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

    if len(audio_bytes) > 24 * 1024 * 1024:
        return {'statusCode': 200, 'headers': CORS,
                'body': json.dumps({'error': 'Файл слишком большой'}, ensure_ascii=False)}

    print(f'[WHISPER] transcribing {comm_id}')
    segments = transcribe_whisper(audio_bytes, f'{comm_id}.mp3')
    print(f'[WHISPER] segments: {len(segments)}')

    if not segments:
        return {'statusCode': 200, 'headers': CORS,
                'body': json.dumps({'error': 'Не удалось распознать речь'}, ensure_ascii=False)}

    print(f'[GPT4O] diarizing {comm_id}')
    gpt_result = diarize_with_gpt(segments)
    print(f'[GPT4O] replicas: {len(gpt_result.get("replicas", []))}')

    parsed = parse_gpt_transcript(gpt_result)

    if parsed['replica_count'] > 0 or parsed.get('all_ivr'):
        save_transcript(comm_id, date, duration, duration_sec, parsed)

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({**parsed, 'comm_id': comm_id, 'status': 'done', 'cached': False},
                           ensure_ascii=False)
    }
