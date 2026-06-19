"""
Транскрибация через GPT-4o Audio с диаризацией спикеров.
Схема:
  POST: скачивает MP3 → отправляет в GPT-4o → получает транскрипт с разделением на спикеров
  GET ?operation_id=...: не используется (GPT-4o синхронный), оставлен для совместимости
"""
import json
import os
import base64
import time
import urllib.request
import psycopg2

OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
DATABASE_URL   = os.environ.get('DATABASE_URL', '')
SCHEMA         = os.environ.get('MAIN_DB_SCHEMA', 't_p87080492_botamin_analytics_da')

OPENAI_URL = 'https://api.openai.com/v1/chat/completions'


# ── OpenAI GPT-4o Audio ─────────────────────────────────────────────────

def transcribe_with_gpt(audio_bytes: bytes, filename: str) -> dict:
    """Отправляет аудио в GPT-4o, получает транскрипт с разделением спикеров."""
    audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')

    prompt = """Ты — система транскрибации звонков колл-центра. Тебе дана аудиозапись телефонного разговора.

Задача:
1. Транскрибируй весь разговор на русском языке
2. Раздели реплики по спикерам: ОПЕРАТОР (тот кто звонит, наш менеджер) и КЛИЕНТ (тот кто принял звонок)
3. Если в начале есть автоответчик/IVR — пометь его как АВТООТВЕТЧИК
4. Определяй спикеров по голосу, интонации и контексту

Верни СТРОГО JSON в таком формате (без markdown, без пояснений):
{
  "replicas": [
    {"speaker": "operator", "text": "текст реплики", "start_time": 0.0},
    {"speaker": "client", "text": "текст реплики", "start_time": 5.0},
    {"speaker": "ivr", "text": "текст автоответчика", "start_time": 1.0}
  ]
}

Значения speaker: "operator" (наш менеджер), "client" (клиент), "ivr" (автоответчик).
start_time — примерное время начала реплики в секундах."""

    body = {
        'model': 'gpt-4o-audio-preview',
        'modalities': ['text'],
        'messages': [
            {
                'role': 'user',
                'content': [
                    {'type': 'text', 'text': prompt},
                    {
                        'type': 'input_audio',
                        'input_audio': {
                            'data': audio_b64,
                            'format': 'mp3',
                        }
                    }
                ]
            }
        ],
        'max_tokens': 4096,
        'temperature': 0,
    }

    data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(
        OPENAI_URL,
        data=data,
        method='POST',
        headers={
            'Authorization': f'Bearer {OPENAI_API_KEY}',
            'Content-Type': 'application/json',
        }
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        result = json.loads(resp.read())

    content = result['choices'][0]['message']['content'].strip()

    # Убираем markdown-обёртку если есть
    if content.startswith('```'):
        lines = content.split('\n')
        content = '\n'.join(lines[1:-1])

    return json.loads(content)


def parse_gpt_transcript(gpt_result: dict) -> dict:
    """Парсит результат GPT в наш формат."""
    replicas_raw = gpt_result.get('replicas', [])
    replicas = []
    full_text = []

    for r in replicas_raw:
        speaker = r.get('speaker', 'client')
        text = r.get('text', '').strip()
        start_time = float(r.get('start_time', 0.0))

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
        replicas.append({
            'speaker': speaker,
            'speaker_label': label,
            'text': text,
            'start_time': round(start_time, 1),
            'segment': segment,
        })
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
        'all_ivr':           all(r['segment'] == 'ivr' for r in replicas) if replicas else False,
    }


# ── Audio download ──────────────────────────────────────────────────────

def download_audio(url: str) -> bytes:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


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
    if replica_count == 0:
        return None
    return {
        'comm_id': comm_id,
        'full_text': row[0] or '',
        'replicas': row[1] or [],
        'replica_count': replica_count,
        'operator_replicas': row[3] or 0,
        'client_replicas': row[4] or 0,
        'status': 'done',
        'cached': True,
    }


def save_transcript(comm_id, date, duration, duration_sec, parsed):
    conn = get_db(); cur = conn.cursor()
    cur.execute(
        f"""INSERT INTO {SCHEMA}.call_transcripts
            (comm_id, date, duration, duration_sec, full_text, replicas,
             replica_count, operator_replicas, client_replicas)
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
         parsed['replica_count'],
         parsed['operator_replicas'],
         parsed['client_replicas'])
    )
    conn.commit(); cur.close(); conn.close()


# ── CORS ────────────────────────────────────────────────────────────────

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


# ── Handler ─────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """Транскрибирует звонок через GPT-4o Audio с диаризацией спикеров."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')

    # GET — проверка кэша (для polling совместимости)
    if method == 'GET':
        params = event.get('queryStringParameters') or {}
        comm_id = params.get('comm_id', '')
        cached = get_cached(comm_id)
        if cached:
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({**cached, 'status': 'done'}, ensure_ascii=False)}
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'status': 'processing'}, ensure_ascii=False)}

    # POST — транскрибируем
    body = json.loads(event.get('body') or '{}')
    comm_id     = body.get('comm_id', '')
    audio_url   = body.get('audio_url', '')
    date        = body.get('date', '')
    duration    = body.get('duration', '')
    duration_sec = int(body.get('duration_sec') or 0)

    # Кэш
    cached = get_cached(comm_id)
    if cached:
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(cached, ensure_ascii=False)}

    if not audio_url:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'нет audio_url'}, ensure_ascii=False)}

    # Скачиваем аудио
    print(f'[AUDIO] downloading {comm_id}')
    audio_bytes = download_audio(audio_url)
    print(f'[AUDIO] {comm_id}: {len(audio_bytes)} bytes')

    # Ограничение: GPT-4o принимает до ~25MB
    if len(audio_bytes) > 24 * 1024 * 1024:
        return {'statusCode': 200, 'headers': CORS,
                'body': json.dumps({'error': 'Файл слишком большой для обработки'}, ensure_ascii=False)}

    # Транскрибируем через GPT-4o
    print(f'[GPT4O] transcribing {comm_id}')
    gpt_result = transcribe_with_gpt(audio_bytes, f'{comm_id}.mp3')
    print(f'[GPT4O] done, replicas: {len(gpt_result.get("replicas", []))}')

    parsed = parse_gpt_transcript(gpt_result)

    # Сохраняем в БД
    if parsed['replica_count'] > 0 or parsed.get('all_ivr'):
        save_transcript(comm_id, date, duration, duration_sec, parsed)

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({
            **parsed,
            'comm_id': comm_id,
            'status': 'done',
            'cached': False,
        }, ensure_ascii=False)
    }
