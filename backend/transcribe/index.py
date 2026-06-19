"""
Транскрибирует аудиозапись через Yandex SpeechKit STT. v6
Схема:
  POST { audio_url, comm_id, ... }
    1. Проверяет кэш в БД
    2. Скачивает MP3 с CoMagic
    3. Декодирует MP3 → LPCM 16kHz mono через audioop (stdlib)
    4. Отправляет LPCM в SpeechKit sync API
    5. Сохраняет в БД, возвращает транскрипт
"""
import json
import os
import io
import base64
import urllib.request
import urllib.error
import psycopg2

YANDEX_API_KEY = os.environ.get('YANDEX_API_KEY', '')
DATABASE_URL   = os.environ.get('DATABASE_URL', '')
SCHEMA         = os.environ.get('MAIN_DB_SCHEMA', 't_p87080492_botamin_analytics_da')

STT_SYNC_URL  = 'https://stt.api.cloud.yandex.net/speech/v1/stt:recognize'


# ── SpeechKit v3 REST (принимает MP3 напрямую) ─────────────────────────

def speechkit_v3_recognize(mp3_bytes: bytes) -> str:
    """SpeechKit v3 REST API — принимает MP3 напрямую без конвертации."""
    url = 'https://stt.api.cloud.yandex.net/stt/v3/recognizeFile'
    body = {
        'content': base64.b64encode(mp3_bytes).decode(),
        'recognitionModel': {
            'config': {'specification': {'languageCode': 'ru-RU'}},
            'audioFormat': {'containerAudio': {'containerAudioType': 'MP3'}},
        }
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={
            'Authorization': f'Api-Key {YANDEX_API_KEY}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        # v3 возвращает NDJSON — несколько JSON строк
        raw = resp.read().decode('utf-8')
    text_parts = []
    for line in raw.strip().split('\n'):
        if not line:
            continue
        try:
            obj = json.loads(line)
            # finalRefinement содержит финальный текст
            norm = obj.get('finalRefinement', {})
            alts = norm.get('normalizedText', {}).get('alternatives', [])
            for alt in alts:
                t = alt.get('text', '').strip()
                if t:
                    text_parts.append(t)
        except Exception:
            pass
    return ' '.join(text_parts)


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


# ── SpeechKit ──────────────────────────────────────────────────────────

def speechkit_recognize(lpcm_bytes: bytes) -> str:
    """Отправляет LPCM 16kHz mono в SpeechKit sync, возвращает текст."""
    url = f'{STT_SYNC_URL}?lang=ru-RU&model=general&audioEncoding=LPCM&sampleRateHertz=16000'
    req = urllib.request.Request(
        url,
        data=lpcm_bytes,
        headers={
            'Authorization': f'Api-Key {YANDEX_API_KEY}',
            'Content-Type': 'audio/x-pcm;bit=16;rate=16000',
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        result = json.loads(resp.read())
    return result.get('result', '')


# ── Handler ────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    # Шаг 1: скачиваем MP3
    try:
        req = urllib.request.Request(audio_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=60) as resp:
            mp3_bytes = resp.read()
        print(f'[AUDIO] {comm_id}: {len(mp3_bytes)} bytes, magic={mp3_bytes[:4].hex()}')
    except Exception as e:
        return {'statusCode': 500, 'headers': cors,
                'body': json.dumps({'error': f'Ошибка скачивания: {str(e)}'}, ensure_ascii=False)}

    # Шаг 2: SpeechKit v3 распознавание (принимает MP3 напрямую)
    try:
        text = speechkit_v3_recognize(mp3_bytes)
        print(f'[STT] result: "{text[:100]}"')
    except urllib.error.HTTPError as e:
        code = e.code
        err = e.read().decode('utf-8', errors='replace')
        print(f'[STT] HTTP {code}: {err[:200]}')
        if code == 429:
            return {'statusCode': 429, 'headers': cors,
                    'body': json.dumps({'error': 'rate_limit'}, ensure_ascii=False)}
        return {'statusCode': 500, 'headers': cors,
                'body': json.dumps({'error': f'SpeechKit HTTP {code}: {err[:200]}'}, ensure_ascii=False)}
    except Exception as e:
        return {'statusCode': 500, 'headers': cors,
                'body': json.dumps({'error': str(e)}, ensure_ascii=False)}

    # Формируем транскрипт
    transcript = {
        'full_text': text,
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