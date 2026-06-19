"""
Транскрибирует аудиозапись звонка через Yandex SpeechKit STT (асинхронное распознавание).
Принимает POST с { "audio_url": "https://..." } — ссылку на запись из CoMagic.
Возвращает транскрипт с разделением на спикеров (оператор / клиент).
"""
import json
import os
import time
import urllib.request
import urllib.error


YANDEX_API_KEY = os.environ.get('YANDEX_API_KEY', '')
STT_URL = 'https://transcribe.api.cloud.yandex.net/speech/stt/v2/longRunningRecognize'
OPERATION_URL = 'https://operation.api.cloud.yandex.net/operations/'


def yandex_request(url: str, method: str = 'GET', body: dict = None) -> dict:
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            'Authorization': f'Api-Key {YANDEX_API_KEY}',
            'Content-Type': 'application/json',
        },
        method=method,
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def start_recognition(audio_url: str) -> str:
    """Запускает асинхронное распознавание, возвращает operation_id."""
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
        'audio': {
            'uri': audio_url,
        }
    }
    result = yandex_request(STT_URL, method='POST', body=body)
    return result.get('id', '')


def poll_operation(operation_id: str, max_wait: int = 25) -> dict:
    """Опрашивает статус операции до завершения (макс max_wait секунд)."""
    deadline = time.time() + max_wait
    while time.time() < deadline:
        result = yandex_request(OPERATION_URL + operation_id)
        if result.get('done'):
            return result
        time.sleep(3)
    return {'done': False, 'timeout': True}


def parse_transcript(operation_result: dict) -> dict:
    """Парсит результат SpeechKit в удобный формат с репликами."""
    if 'error' in operation_result:
        return {'error': operation_result['error'].get('message', 'Ошибка распознавания')}

    response = operation_result.get('response', {})
    chunks = response.get('chunks', [])

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

        # Определяем спикера (channelTag: 1=оператор, 2=клиент в стерео записи)
        channel = chunk.get('channelTag', '1')
        speaker = 'operator' if channel == '1' else 'client'
        speaker_label = 'Оператор' if speaker == 'operator' else 'Клиент'

        # Время начала реплики
        start_time = 0.0
        words = best.get('words', [])
        if words:
            st = words[0].get('startTime', '0s')
            start_time = float(st.replace('s', '')) if isinstance(st, str) else float(st)

        replicas.append({
            'speaker': speaker,
            'speaker_label': speaker_label,
            'text': text,
            'start_time': round(start_time, 1),
        })
        full_text.append(f'{speaker_label}: {text}')

    # Сортируем реплики по времени
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
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    if not YANDEX_API_KEY:
        return {
            'statusCode': 500,
            'headers': cors,
            'body': json.dumps({'error': 'YANDEX_API_KEY не настроен'}, ensure_ascii=False),
        }

    body_raw = event.get('body', '{}') or '{}'
    if isinstance(body_raw, str):
        body = json.loads(body_raw)
    elif isinstance(body_raw, dict):
        body = body_raw
    else:
        body = {}
    audio_url = body.get('audio_url', '')
    comm_id = body.get('comm_id', '')

    if not audio_url:
        return {
            'statusCode': 400,
            'headers': cors,
            'body': json.dumps({'error': 'Нужен audio_url'}, ensure_ascii=False),
        }

    # Запускаем распознавание
    operation_id = start_recognition(audio_url)
    if not operation_id:
        return {
            'statusCode': 500,
            'headers': cors,
            'body': json.dumps({'error': 'Не удалось запустить распознавание'}, ensure_ascii=False),
        }

    # Ждём результат (до 25 сек в рамках таймаута функции)
    operation_result = poll_operation(operation_id, max_wait=25)

    if not operation_result.get('done'):
        # Возвращаем operation_id — фронт сам опросит позже
        return {
            'statusCode': 202,
            'headers': cors,
            'body': json.dumps({
                'status': 'pending',
                'operation_id': operation_id,
                'comm_id': comm_id,
            }, ensure_ascii=False),
        }

    transcript = parse_transcript(operation_result)
    transcript['comm_id'] = comm_id
    transcript['operation_id'] = operation_id
    transcript['status'] = 'done'

    return {
        'statusCode': 200,
        'headers': {**cors, 'Content-Type': 'application/json'},
        'body': json.dumps(transcript, ensure_ascii=False),
    }