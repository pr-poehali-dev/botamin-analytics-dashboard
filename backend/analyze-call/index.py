"""
Анализирует транскрипт звонка через Google Gemini 1.5 Flash.
Сначала проверяет кэш в БД — если анализ уже есть, возвращает его.
Иначе анализирует и сохраняет результат в БД.
"""
import json
import os
import urllib.request
import psycopg2

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
DATABASE_URL   = os.environ.get('DATABASE_URL', '')
SCHEMA         = os.environ.get('MAIN_DB_SCHEMA', 't_p87080492_botamin_analytics_da')

GEMINI_URL = (
    'https://generativelanguage.googleapis.com/v1beta/models/'
    'gemini-1.5-flash:generateContent?key='
)

SYSTEM_PROMPT = """Ты эксперт по анализу звонков колл-центра рекламного агентства СайтАктив.
Анализируй транскрипты звонков и возвращай ТОЛЬКО валидный JSON без markdown-обёртки и без ```json.

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
  "operator_score": число от 1 до 10,
  "operator_followed_script": true | false,
  "operator_handled_objections": true | false,
  "operator_comment": "краткий комментарий по работе оператора 1-2 предложения",
  "summary": "2-3 предложения о чём был звонок",
  "key_phrases_client": ["фраза1", "фраза2"],
  "key_phrases_operator": ["фраза1", "фраза2"]
}

Правила:
- target: клиент интересуется услугами компании, есть потенциал сделки
- non_target: спам, ошибочный номер, не по теме бизнеса
- qualification: клиент назвал бюджет/сроки/ЛПР или есть явная конкретная потребность
- operator_score: 1-4 плохо, 5-6 удовлетворительно, 7-8 хорошо, 9-10 отлично
- fail_reason: только если outcome=failure, иначе null
- success_factor: только если outcome=success, иначе null
- key_phrases: 2-4 реальные цитаты из текста, не придумывай"""


def get_db():
    return psycopg2.connect(DATABASE_URL)


def get_cached(comm_id: str):
    if not comm_id:
        return None
    conn = get_db()
    cur  = conn.cursor()
    cur.execute(
        f"""SELECT call_type, call_type_label, qualification, qualification_label,
                   client_interest, client_interest_label, outcome, outcome_label,
                   fail_reason, success_factor, operator_score, operator_followed_script,
                   operator_handled_objections, operator_comment, summary,
                   key_phrases_client, key_phrases_operator
            FROM {SCHEMA}.call_analyses WHERE comm_id = %s""",
        (comm_id,)
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        return None
    return {
        'comm_id': comm_id,
        'call_type': row[0], 'call_type_label': row[1],
        'qualification': row[2], 'qualification_label': row[3],
        'client_interest': row[4], 'client_interest_label': row[5],
        'outcome': row[6], 'outcome_label': row[7],
        'fail_reason': row[8], 'success_factor': row[9],
        'operator_score': row[10], 'operator_followed_script': row[11],
        'operator_handled_objections': row[12], 'operator_comment': row[13],
        'summary': row[14],
        'key_phrases_client':  row[15] if row[15] else [],
        'key_phrases_operator': row[16] if row[16] else [],
        'cached': True,
    }


def save_to_db(comm_id: str, a: dict):
    if not comm_id:
        return
    conn = get_db()
    cur  = conn.cursor()
    cur.execute(
        f"""INSERT INTO {SCHEMA}.call_analyses
            (comm_id, call_type, call_type_label, qualification, qualification_label,
             client_interest, client_interest_label, outcome, outcome_label,
             fail_reason, success_factor, operator_score, operator_followed_script,
             operator_handled_objections, operator_comment, summary,
             key_phrases_client, key_phrases_operator)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (comm_id) DO UPDATE SET
                call_type=EXCLUDED.call_type, call_type_label=EXCLUDED.call_type_label,
                qualification=EXCLUDED.qualification, qualification_label=EXCLUDED.qualification_label,
                client_interest=EXCLUDED.client_interest, client_interest_label=EXCLUDED.client_interest_label,
                outcome=EXCLUDED.outcome, outcome_label=EXCLUDED.outcome_label,
                fail_reason=EXCLUDED.fail_reason, success_factor=EXCLUDED.success_factor,
                operator_score=EXCLUDED.operator_score,
                operator_followed_script=EXCLUDED.operator_followed_script,
                operator_handled_objections=EXCLUDED.operator_handled_objections,
                operator_comment=EXCLUDED.operator_comment,
                summary=EXCLUDED.summary,
                key_phrases_client=EXCLUDED.key_phrases_client,
                key_phrases_operator=EXCLUDED.key_phrases_operator""",
        (
            comm_id,
            a.get('call_type'), a.get('call_type_label'),
            a.get('qualification'), a.get('qualification_label'),
            a.get('client_interest'), a.get('client_interest_label'),
            a.get('outcome'), a.get('outcome_label'),
            a.get('fail_reason'), a.get('success_factor'),
            a.get('operator_score'), a.get('operator_followed_script'),
            a.get('operator_handled_objections'), a.get('operator_comment'),
            a.get('summary'),
            json.dumps(a.get('key_phrases_client', []), ensure_ascii=False),
            json.dumps(a.get('key_phrases_operator', []), ensure_ascii=False),
        )
    )
    conn.commit()
    cur.close()
    conn.close()


def analyze(transcript: str, duration_sec: int) -> dict:
    minutes = duration_sec // 60
    seconds = duration_sec % 60
    user_text = f"Длительность звонка: {minutes}м {seconds}с\n\nТранскрипт:\n{transcript}"

    body = {
        'system_instruction': {'parts': [{'text': SYSTEM_PROMPT}]},
        'contents': [{'parts': [{'text': user_text}]}],
        'generationConfig': {
            'temperature': 0.1,
            'maxOutputTokens': 1024,
        },
    }

    req = urllib.request.Request(
        GEMINI_URL + GEMINI_API_KEY,
        data=json.dumps(body).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read())

    content = result['candidates'][0]['content']['parts'][0]['text'].strip()

    # Убираем markdown-обёртку если вдруг есть
    if content.startswith('```'):
        lines = content.split('\n')
        lines = [l for l in lines if not l.strip().startswith('```')]
        content = '\n'.join(lines).strip()

    return json.loads(content)


CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


def handler(event: dict, context) -> dict:
    """Анализирует транскрипт звонка через Google Gemini 1.5 Flash."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    if not GEMINI_API_KEY:
        return {'statusCode': 500, 'headers': CORS,
                'body': json.dumps({'error': 'GEMINI_API_KEY не настроен'}, ensure_ascii=False)}

    body_raw = event.get('body', '{}') or '{}'
    body = json.loads(body_raw) if isinstance(body_raw, str) else (body_raw or {})

    transcript   = body.get('transcript', '')
    comm_id      = body.get('comm_id', '')
    duration_sec = int(body.get('duration_sec') or 0)

    if not transcript:
        return {'statusCode': 400, 'headers': CORS,
                'body': json.dumps({'error': 'Нужен transcript'}, ensure_ascii=False)}

    # Проверяем кэш
    cached = get_cached(comm_id)
    if cached:
        return {'statusCode': 200, 'headers': {**CORS, 'Content-Type': 'application/json'},
                'body': json.dumps(cached, ensure_ascii=False)}

    # Анализируем через Gemini
    print(f'[GEMINI] analyzing comm_id={comm_id} duration={duration_sec}s')
    analysis = analyze(transcript, duration_sec)
    analysis['comm_id'] = comm_id
    analysis['cached']  = False
    print(f'[GEMINI] done: score={analysis.get("operator_score")} outcome={analysis.get("outcome")}')

    # Сохраняем в БД
    save_to_db(comm_id, analysis)

    return {'statusCode': 200, 'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps(analysis, ensure_ascii=False)}
