"""
Транскрибирует аудиозапись через Yandex SpeechKit STT. v4
Два режима:
  POST { audio_url, comm_id, ... }            → запускает job, возвращает operation_id
  GET  ?operation_id=...&comm_id=...&...      → опрашивает статус, при done сохраняет в БД
"""
import json
import os
import time
import urllib.request
import urllib.error
import psycopg2

YANDEX_API_KEY = os.environ.get('YANDEX_API_KEY', '')
DATABASE_URL   = os.environ.get('DATABASE_URL', '')
SCHEMA         = os.environ.get('MAIN_DB_SCHEMA', 't_p87080492_botamin_analytics_da')
STT_URL        = 'https://transcribe.api.cloud.yandex.net/speech/stt/v2/longRunningRecognize'
OPERATION_URL  = 'https://operation.api.cloud.yandex.net/operations/'


# ── DB helpers ─────────────────────────────────────────────────────────

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


# ── Yandex helpers ─────────────────────────────────────────────────────

def yandex_request(url, method='GET', body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url, data=data,
        headers={'Authorization': f'Api-Key {YANDEX_API_KEY}', 'Content-Type': 'application/json'},
        method=method,
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read())


def start_recognition(audio_url: str) -> str:
    body = {
        'config': {'specification': {
            'languageCode': 'ru-RU',
            'model': 'general',
            'audioEncoding': 'MP3',
            'audioChannelCount': 2,
            'enableSpeakerLabeling': True,
        }},
        'audio': {'uri': audio_url}
    }
    result = yandex_request(STT_URL, method='POST', body=body)
    return result.get('id', '')


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
            'duration_sec': int(params.get('duration_sec', 0)),
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

    # Запускаем распознавание
    try:
        operation_id = start_recognition(audio_url)
    except urllib.error.HTTPError as e:
        code = e.code
        if code == 429:
            return {'statusCode': 429, 'headers': cors,
                    'body': json.dumps({'error': 'rate_limit'}, ensure_ascii=False)}
        return {'statusCode': 500, 'headers': cors,
                'body': json.dumps({'error': f'SpeechKit HTTP {code}'}, ensure_ascii=False)}
    except Exception as e:
        return {'statusCode': 500, 'headers': cors,
                'body': json.dumps({'error': str(e)}, ensure_ascii=False)}

    if not operation_id:
        return {'statusCode': 500, 'headers': cors,
                'body': json.dumps({'error': 'operation_id не получен'}, ensure_ascii=False)}

    return {'statusCode': 200, 'headers': {**cors, 'Content-Type': 'application/json'},
            'body': json.dumps({
                'status': 'started',
                'operation_id': operation_id,
                'comm_id': comm_id,
                'audio_url': audio_url,
                'date': meta['date'],
                'duration': meta['duration'],
                'duration_sec': meta['duration_sec'],
            }, ensure_ascii=False)}
