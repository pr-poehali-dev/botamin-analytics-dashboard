"""
Анализирует транскрипт звонка через OpenAI GPT-4o-mini. v2
Принимает POST с { "transcript": "...", "comm_id": "...", "duration_sec": N }.
Возвращает структурированный анализ: классификация, тональность, итог, оценка оператора.
"""
import json
import os
import urllib.request


OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

SYSTEM_PROMPT = """Ты эксперт по анализу звонков колл-центра рекламного агентства СайтАктив.
Анализируй транскрипты звонков и возвращай ТОЛЬКО валидный JSON без markdown-обёртки.

Структура ответа:
{
  "call_type": "target" | "non_target",
  "call_type_label": "Целевой" | "Нецелевой",
  "qualification": true | false,
  "qualification_label": "Квалифицирован" | "Не квалифицирован",
  "client_interest": "high" | "medium" | "low",
  "client_interest_label": "Высокий" | "Средний" | "Низкий",
  "outcome": "success" | "failure" | "pending",
  "outcome_label": "Успех" | "Отказ" | "В работе",
  "fail_reason": "строка или null",
  "success_factor": "строка или null",
  "operator_score": 1-10,
  "operator_followed_script": true | false,
  "operator_handled_objections": true | false,
  "operator_comment": "краткий комментарий по работе оператора",
  "summary": "2-3 предложения о чём был звонок",
  "key_phrases_client": ["фраза1", "фраза2"],
  "key_phrases_operator": ["фраза1", "фраза2"]
}

Правила:
- target: клиент интересуется услугами, есть потенциал сделки
- non_target: спам, ошибочный номер, нецелевой запрос
- qualification: клиент назвал бюджет/сроки/ЛПР или есть явная потребность
- operator_score: 1-4 плохо, 5-6 удовлетворительно, 7-8 хорошо, 9-10 отлично
- fail_reason: только если outcome=failure, иначе null
- success_factor: только если outcome=success, иначе null"""


def analyze(transcript: str, duration_sec: int) -> dict:
    minutes = duration_sec // 60
    seconds = duration_sec % 60
    user_message = f"""Длительность звонка: {minutes}м {seconds}с

Транскрипт:
{transcript}"""

    body = {
        'model': 'gpt-4o-mini',
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': user_message},
        ],
        'temperature': 0.1,
        'max_tokens': 800,
    }

    req = urllib.request.Request(
        OPENAI_URL,
        data=json.dumps(body).encode(),
        headers={
            'Authorization': f'Bearer {OPENAI_API_KEY}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read())

    content = result['choices'][0]['message']['content'].strip()
    # Убираем возможные markdown-обёртки
    if content.startswith('```'):
        content = content.split('```')[1]
        if content.startswith('json'):
            content = content[4:]
    return json.loads(content.strip())


def handler(event: dict, context) -> dict:
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    if not OPENAI_API_KEY:
        return {
            'statusCode': 500,
            'headers': cors,
            'body': json.dumps({'error': 'OPENAI_API_KEY не настроен'}, ensure_ascii=False),
        }

    body_raw = event.get('body', '{}') or '{}'
    body = json.loads(body_raw) if isinstance(body_raw, str) else body_raw
    transcript = body.get('transcript', '')
    comm_id = body.get('comm_id', '')
    duration_sec = body.get('duration_sec', 0)

    if not transcript:
        return {
            'statusCode': 400,
            'headers': cors,
            'body': json.dumps({'error': 'Нужен transcript'}, ensure_ascii=False),
        }

    analysis = analyze(transcript, duration_sec)
    analysis['comm_id'] = comm_id

    return {
        'statusCode': 200,
        'headers': {**cors, 'Content-Type': 'application/json'},
        'body': json.dumps(analysis, ensure_ascii=False),
    }