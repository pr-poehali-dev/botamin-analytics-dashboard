"""
Транскрибирует аудиозапись через Yandex SpeechKit STT. v5
Схема работы:
  POST { audio_url, comm_id, ... }
    1. Скачивает аудио с CoMagic
    2. Загружает во внутренний S3 (bucket.poehali.dev)
    3. Передаёт S3-ссылку в SpeechKit longRunningRecognize
    4. Возвращает operation_id для опроса

  GET  ?operation_id=...&comm_id=...
    5. Опрашивает статус операции
    6. При done — парсит транскрипт, сохраняет в БД, возвращает результат
"""
import json
import os
import time
import urllib.request
import urllib.error
import psycopg2
import boto3
from botocore.exceptions import ClientError

YANDEX_API_KEY = os.environ.get('YANDEX_API_KEY', '')
DATABASE_URL   = os.environ.get('DATABASE_URL', '')
SCHEMA         = os.environ.get('MAIN_DB_SCHEMA', 't_p87080492_botamin_analytics_da')
AWS_KEY        = os.environ.get('AWS_ACCESS_KEY_ID', '')
AWS_SECRET     = os.environ.get('AWS_SECRET_ACCESS_KEY', '')

STT_URL       = 'https://transcribe.api.cloud.yandex.net/speech/stt/v2/longRunningRecognize'
STT_SYNC_URL  = 'https://stt.api.cloud.yandex.net/speech/v1/stt:recognize'
OPERATION_URL = 'https://operation.api.cloud.yandex.net/operations/'
S3_ENDPOINT   = 'https://bucket.poehali.dev'
S3_BUCKET     = 'files'


# ── S3 ─────────────────────────────────────────────────────────────────

def get_s3():
    return boto3.client(
        's3',
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=AWS_KEY,
        aws_secret_access_key=AWS_SECRET,
    )


def download_audio(audio_url: str) -> bytes:
    """Скачивает аудио с CoMagic и возвращает байты."""
    req = urllib.request.Request(audio_url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


# ── DB ─────────────────────────────────────────────────────────────────

def get_db():
    return psycopg2.connect(DATABASE_URL)


def get_cached(comm_id: str):
    if not comm_id:
        return None
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        f"SELECT full_text, replicas, replica_count, operator_replicas, client_replicas "
        f"FROM {SCHEMA}.call_transcripts WHERE comm_id = %s",
        (comm_id,)
    )
    row = cur.fetchone()
    cur.close(); conn.close()
    if not row:
        return None
    return {
        'comm_id': comm_id,
        'full_text': row[0] or '',
        'replicas': row[1] if row[1] else [],
        'replica_count': row[2] or 0,
        'operator_replicas': row[3] or 0,
        'client_replicas': row[4] or 0,
        'status': 'done',
        'cached': True,
    }


def save_to_db(comm_id, audio_url, meta, transcript):
    if not comm_id:
        return
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        f"""INSERT INTO {SCHEMA}.call_transcripts
            (comm_id, audio_url, date, duration, duration_sec, full_text, replicas,
             replica_count, operator_replicas, client_replicas)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (comm_id) DO UPDATE SET
                full_text=EXCLUDED.full_text, replicas=EXCLUDED.replicas,
                replica_count=EXCLUDED.replica_count,
                operator_replicas=EXCLUDED.operator_replicas,
                client_replicas=EXCLUDED.client_replicas""",
        (
            comm_id, audio_url,
            meta.get('date',''), meta.get('duration',''), meta.get('duration_sec', 0),
            transcript.get('full_text',''),
            json.dumps(transcript.get('replicas',[]), ensure_ascii=False),
            transcript.get('replica_count', 0),
            transcript.get('operator_replicas', 0),
            transcript.get('client_replicas', 0),
        )
    )
    conn.commit(); cur.close(); conn.close()


# ── Yandex SpeechKit ───────────────────────────────────────────────────

def yandex_request(url, method='GET', body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url, data=data,
        headers={'Authorization': f'Api-Key {YANDEX_API_KEY}', 'Content-Type': 'application/json'},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body_err = e.read().decode('utf-8', errors='replace')
        print(f'[YA] {method} {url} -> HTTP {e.code}: {body_err[:300]}')
        raise


def recognize_sync(audio_bytes: bytes) -> dict:
    """Синхронное распознавание — отправляем байты напрямую. CoMagic отдаёт OGG_OPUS."""
    req = urllib.request.Request(
        STT_SYNC_URL + '?lang=ru-RU&model=general&audioEncoding=OGG_OPUS',
        data=audio_bytes,
        headers={
            'Authorization': f'Api-Key {YANDEX_API_KEY}',
            'Content-Type': 'audio/ogg',
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read())


def check_operation(operation_id: str) -> dict:
    return yandex_request(OPERATION_URL + operation_id)


def parse_transcript(op: dict) -> dict:
    if 'error' in op:
        return {'error': op['error'].get('message', 'Ошибка распознавания')}

    chunks = op.get('response', {}).get('chunks', [])
    full_text, replicas = [], []

    for chunk in chunks:
        alts = chunk.get('alternatives', [])
        if not alts:
            continue
        best = alts[0]
        text = best.get('text', '').strip()
        if not text:
            continue
        channel = chunk.get('channelTag', '1')
        speaker = 'operator' if channel == '1' else 'client'
        label   = 'Оператор' if speaker == 'operator' else 'Клиент'
        start   = 0.0
        words   = best.get('words', [])
        if words:
            st = words[0].get('startTime', '0s')
            start = float(str(st).replace('s', ''))
        replicas.append({'speaker': speaker, 'speaker_label': label, 'text': text, 'start_time': round(start, 1)})
        full_text.append(f'{label}: {text}')

    replicas.sort(key=lambda r: r['start_time'])
    return {
        'full_text': '\n'.join(full_text),
        'replicas': replicas,
        'replica_count': len(replicas),
        'operator_replicas': sum(1 for r in replicas if r['speaker'] == 'operator'),
        'client_replicas':   sum(1 for r in replicas if r['speaker'] == 'client'),
    }


# ── Handler ────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    if not YANDEX_API_KEY:
        return {'statusCode': 500, 'headers': cors,
                'body': json.dumps({'error': 'YANDEX_API_KEY не настроен'}, ensure_ascii=False)}

    method = event.get('httpMethod', 'POST')
    params = event.get('queryStringParameters') or {}

    # ── GET: опрос статуса операции ──────────────────────────────────
    if method == 'GET':
        operation_id = params.get('operation_id', '')
        comm_id      = params.get('comm_id', '')
        audio_url    = params.get('audio_url', '')
        meta = {
            'date':         params.get('date', ''),
            'duration':     params.get('duration', ''),
            'duration_sec': int(params.get('duration_sec', 0) or 0),
        }

        if not operation_id:
            return {'statusCode': 400, 'headers': cors,
                    'body': json.dumps({'error': 'Нужен operation_id'}, ensure_ascii=False)}

        try:
            op = check_operation(operation_id)
        except Exception as e:
            return {'statusCode': 500, 'headers': cors,
                    'body': json.dumps({'error': str(e)}, ensure_ascii=False)}

        if not op.get('done'):
            return {'statusCode': 200, 'headers': {**cors, 'Content-Type': 'application/json'},
                    'body': json.dumps({'status': 'processing', 'operation_id': operation_id}, ensure_ascii=False)}

        transcript = parse_transcript(op)
        if 'error' in transcript:
            return {'statusCode': 500, 'headers': cors,
                    'body': json.dumps({'error': transcript['error']}, ensure_ascii=False)}

        save_to_db(comm_id, audio_url, meta, transcript)
        transcript.update({'comm_id': comm_id, 'status': 'done', 'cached': False})
        return {'statusCode': 200, 'headers': {**cors, 'Content-Type': 'application/json'},
                'body': json.dumps(transcript, ensure_ascii=False)}

    # ── POST: запуск транскрибации ────────────────────────────────────
    body_raw = event.get('body', '{}') or '{}'
    body = json.loads(body_raw) if isinstance(body_raw, str) else (body_raw or {})

    audio_url = body.get('audio_url', '')
    comm_id   = body.get('comm_id', '')
    meta = {
        'date':         body.get('date', ''),
        'duration':     body.get('duration', ''),
        'duration_sec': body.get('duration_sec', 0),
    }

    if not audio_url:
        return {'statusCode': 400, 'headers': cors,
                'body': json.dumps({'error': 'Нужен audio_url'}, ensure_ascii=False)}

    # Проверяем кэш
    cached = get_cached(comm_id)
    if cached:
        return {'statusCode': 200, 'headers': {**cors, 'Content-Type': 'application/json'},
                'body': json.dumps(cached, ensure_ascii=False)}

    # Шаг 1: скачиваем аудио
    try:
        audio_bytes = download_audio(audio_url)
        print(f'[AUDIO] downloaded {len(audio_bytes)} bytes for {comm_id}')
    except Exception as e:
        return {'statusCode': 500, 'headers': cors,
                'body': json.dumps({'error': f'Ошибка скачивания аудио: {str(e)}'}, ensure_ascii=False)}

    # Шаг 2: синхронное распознавание (байты напрямую, без S3)
    try:
        result = recognize_sync(audio_bytes)
    except urllib.error.HTTPError as e:
        code = e.code
        err_body = e.read().decode('utf-8', errors='replace')
        print(f'[STT] HTTP {code}: {err_body[:300]}')
        if code == 429:
            return {'statusCode': 429, 'headers': cors,
                    'body': json.dumps({'error': 'rate_limit'}, ensure_ascii=False)}
        return {'statusCode': 500, 'headers': cors,
                'body': json.dumps({'error': f'SpeechKit HTTP {code}: {err_body[:200]}'}, ensure_ascii=False)}
    except Exception as e:
        return {'statusCode': 500, 'headers': cors,
                'body': json.dumps({'error': str(e)}, ensure_ascii=False)}

    # Синхронный API возвращает { "result": "текст" } без разделения на каналы
    text = result.get('result', '').strip()
    print(f'[STT] result: {text[:100]}')

    transcript = {
        'full_text': f'Оператор/Клиент: {text}' if text else '',
        'replicas': [{'speaker': 'operator', 'speaker_label': 'Диалог', 'text': text, 'start_time': 0.0}] if text else [],
        'replica_count': 1 if text else 0,
        'operator_replicas': 1 if text else 0,
        'client_replicas': 0,
    }

    if text:
        save_to_db(comm_id, audio_url, meta, transcript)

    transcript.update({'comm_id': comm_id, 'status': 'done', 'cached': False})
    return {'statusCode': 200, 'headers': {**cors, 'Content-Type': 'application/json'},
            'body': json.dumps(transcript, ensure_ascii=False)}