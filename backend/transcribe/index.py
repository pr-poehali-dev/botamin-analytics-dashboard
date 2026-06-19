"""
Транскрибирует аудиозапись звонка через Yandex SpeechKit STT. v3
Сначала проверяет кэш в БД — если транскрипт уже есть, возвращает его.
Иначе транскрибирует и сохраняет результат в БД.
"""
import json
import os
import time
import urllib.request
import psycopg2

YANDEX_API_KEY = os.environ.get('YANDEX_API_KEY', '')
DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p87080492_botamin_analytics_da')
STT_URL = 'https://transcribe.api.cloud.yandex.net/speech/stt/v2/longRunningRecognize'
OPERATION_URL = 'https://operation.api.cloud.yandex.net/operations/'


def get_db():
    return psycopg2.connect(DATABASE_URL)


def get_cached(comm_id: str) -> dict | None:
    """Возвращает транскрипт из кэша БД если есть."""
    if not comm_id:
        return None
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        f"SELECT full_text, replicas, replica_count, operator_replicas, client_replicas FROM {SCHEMA}.call_transcripts WHERE comm_id = %s",
        (comm_id,)
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
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


def save_to_db(comm_id: str, audio_url: str, meta: dict, transcript: dict):
    """Сохраняет транскрипт в БД."""
    if not comm_id:
        return
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        f"""INSERT INTO {SCHEMA}.call_transcripts
            (comm_id, audio_url, date, duration, duration_sec, full_text, replicas, replica_count, operator_replicas, client_replicas)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (comm_id) DO UPDATE SET
                full_text = EXCLUDED.full_text,
                replicas = EXCLUDED.replicas,
                replica_count = EXCLUDED.replica_count,
                operator_replicas = EXCLUDED.operator_replicas,
                client_replicas = EXCLUDED.client_replicas
        """,
        (
            comm_id,
            audio_url,
            meta.get('date', ''),
            meta.get('duration', ''),
            meta.get('duration_sec', 0),
            transcript.get('full_text', ''),
            json.dumps(transcript.get('replicas', []), ensure_ascii=False),
            transcript.get('replica_count', 0),
            transcript.get('operator_replicas', 0),
            transcript.get('client_replicas', 0),
        )
    )
    conn.commit()
    cur.close()
    conn.close()


def yandex_request(url: str, method: str = 'GET', body: dict = None, retries: int = 3) -> dict:
    data = json.dumps(body).encode() if body else None
    for attempt in range(retries):
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                'Authorization': f'Api-Key {YANDEX_API_KEY}',
                'Content-Type': 'application/json',
            },
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries - 1:
                time.sleep(3 * (attempt + 1))
                continue
            raise


def start_recognition(audio_url: str) -> str:
    body = {
        'config': {
            'specification': {
                'languageCode': 'ru-RU',
                'model': 'general',
                'audioEncoding': 'MP3',
                'audioChannelCount': 2,
                'enableSpeakerLabeling': True,
                'literatureText': False,
            }
        },
        'audio': {'uri': audio_url}
    }
    result = yandex_request(STT_URL, method='POST', body=body)
    return result.get('id', '')


def poll_operation(operation_id: str, max_wait: int = 25) -> dict:
    deadline = time.time() + max_wait
    while time.time() < deadline:
        result = yandex_request(OPERATION_URL + operation_id)
        if result.get('done'):
            return result
        time.sleep(3)
    return {'done': False, 'timeout': True}


def parse_transcript(operation_result: dict) -> dict:
    if 'error' in operation_result:
        return {'error': operation_result['error'].get('message', 'Ошибка распознавания')}

    chunks = operation_result.get('response', {}).get('chunks', [])
    full_text = []
    replicas = []

    for chunk in chunks:
        alternatives = chunk.get('alternatives', [])
        if not alternatives:
            continue
        best = alternatives[0]
        text = best.get('text', '').strip()
        if not text:
            continue

        channel = chunk.get('channelTag', '1')
        speaker = 'operator' if channel == '1' else 'client'
        speaker_label = 'Оператор' if speaker == 'operator' else 'Клиент'

        start_time = 0.0
        words = best.get('words', [])
        if words:
            st = words[0].get('startTime', '0s')
            start_time = float(str(st).replace('s', ''))

        replicas.append({
            'speaker': speaker,
            'speaker_label': speaker_label,
            'text': text,
            'start_time': round(start_time, 1),
        })
        full_text.append(f'{speaker_label}: {text}')

    replicas.sort(key=lambda r: r['start_time'])

    return {
        'full_text': '\n'.join(full_text),
        'replicas': replicas,
        'replica_count': len(replicas),
        'operator_replicas': sum(1 for r in replicas if r['speaker'] == 'operator'),
        'client_replicas': sum(1 for r in replicas if r['speaker'] == 'client'),
    }


def handler(event: dict, context) -> dict:
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    if not YANDEX_API_KEY:
        return {'statusCode': 500, 'headers': cors,
                'body': json.dumps({'error': 'YANDEX_API_KEY не настроен'}, ensure_ascii=False)}

    body_raw = event.get('body', '{}') or '{}'
    body = json.loads(body_raw) if isinstance(body_raw, str) else (body_raw or {})

    audio_url = body.get('audio_url', '')
    comm_id = body.get('comm_id', '')
    meta = {
        'date': body.get('date', ''),
        'duration': body.get('duration', ''),
        'duration_sec': body.get('duration_sec', 0),
    }

    if not audio_url:
        return {'statusCode': 400, 'headers': cors,
                'body': json.dumps({'error': 'Нужен audio_url'}, ensure_ascii=False)}

    # Проверяем кэш
    cached = get_cached(comm_id)
    if cached:
        return {
            'statusCode': 200,
            'headers': {**cors, 'Content-Type': 'application/json'},
            'body': json.dumps(cached, ensure_ascii=False),
        }

    # Транскрибируем
    operation_id = start_recognition(audio_url)
    if not operation_id:
        return {'statusCode': 500, 'headers': cors,
                'body': json.dumps({'error': 'Не удалось запустить распознавание'}, ensure_ascii=False)}

    operation_result = poll_operation(operation_id, max_wait=25)

    if not operation_result.get('done'):
        return {
            'statusCode': 202,
            'headers': cors,
            'body': json.dumps({'status': 'pending', 'operation_id': operation_id, 'comm_id': comm_id},
                               ensure_ascii=False),
        }

    transcript = parse_transcript(operation_result)
    if 'error' in transcript:
        return {'statusCode': 500, 'headers': cors,
                'body': json.dumps({'error': transcript['error']}, ensure_ascii=False)}

    # Сохраняем в БД
    save_to_db(comm_id, audio_url, meta, transcript)

    transcript['comm_id'] = comm_id
    transcript['status'] = 'done'
    transcript['cached'] = False

    return {
        'statusCode': 200,
        'headers': {**cors, 'Content-Type': 'application/json'},
        'body': json.dumps(transcript, ensure_ascii=False),
    }