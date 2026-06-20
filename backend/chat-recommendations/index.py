"""
Чат с ИИ-советником по рекомендациям для роста конверсии.
Пользователь обсуждает рекомендации, ИИ объективно отвечает и обновляет их при необходимости.
"""
import json
import os
import psycopg2
import urllib.request

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA       = os.environ.get('MAIN_DB_SCHEMA', 't_p87080492_botamin_analytics_da')
MISTRAL_KEY  = os.environ.get('MISTRAL_API_KEY', '')
MISTRAL_URL  = 'https://api.mistral.ai/v1/chat/completions'

CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

DEFAULT_SYSTEM_PROMPT = """Ты опытный бизнес-советник по B2B продажам. Работаешь с руководителем как партнёр — честно, без лести, но и без упрямства ради упрямства.

ХАРАКТЕР:
- Объективен: данные важнее мнений, включая твоих собственных
- Прямолинеен: говоришь неудобную правду, но уважительно
- Гибок: если руководитель приводит весомый аргумент или контекст который ты не знал — признаёшь это и меняешь позицию
- Практичен: каждый ответ заканчивается конкретным действием

КОГДА СОГЛАШАТЬСЯ С РУКОВОДИТЕЛЕМ:
- Он объясняет отраслевую специфику или контекст который меняет картину
- Его опыт противоречит данным и он может это обосновать
- Данных недостаточно чтобы делать уверенный вывод
- Его альтернативное решение логичнее твоего

КОГДА НЕ СОГЛАШАТЬСЯ:
- Руководитель давит эмоционально без аргументов ("я так чувствую", "просто доверься мне")
- Его позиция противоречит цифрам и он это не объясняет
- Он хочет игнорировать проблему потому что неудобно её признавать

ФОРМАТ ОТВЕТОВ:
- Говори цифрами: не "улучшить конверсию", а "поднять с X% до Y% за Z дней"
- Если не согласен — объясни почему, не просто скажи "нет"
- Если согласен — скажи что именно изменило твоё мнение
- Предлагай решения разной радикальности: от мягких до экстремальных (уволить оператора, сменить базу, остановить кампанию)
- Задавай уточняющие вопросы чтобы понять контекст
- Ссылайся на рекомендации по номеру (#1, #2...)
- Отвечай лаконично — 4–6 предложений, если не нужно больше"""


def get_stats():
    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor()
    cur.execute(f"""
        SELECT call_type, qualification, client_interest, outcome,
               fail_reason, operator_score, operator_followed_script,
               operator_handled_objections
        FROM {SCHEMA}.call_analyses
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    total = len(rows)
    if total == 0:
        return None

    target  = sum(1 for r in rows if r[0] == 'target')
    success = sum(1 for r in rows if r[3] == 'success')
    scores  = [r[5] for r in rows if r[5]]
    script  = sum(1 for r in rows if r[6])
    obj     = sum(1 for r in rows if r[7])

    return {
        'total': total,
        'target_rate':     round(target / total * 100, 1),
        'conversion_rate': round(success / total * 100, 1),
        'avg_score':       round(sum(scores) / len(scores), 1) if scores else 0,
        'script_rate':     round(script / total * 100, 1),
        'objection_rate':  round(obj / total * 100, 1),
    }


def call_mistral(messages: list, system_prompt: str) -> str:
    payload = json.dumps({
        'model': 'mistral-small-latest',
        'temperature': 0.7,
        'max_tokens': 1024,
        'messages': [{'role': 'system', 'content': system_prompt}] + messages,
    }).encode()

    req = urllib.request.Request(
        MISTRAL_URL,
        data=payload,
        headers={
            'Authorization': f'Bearer {MISTRAL_KEY}',
            'Content-Type':  'application/json',
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=25) as resp:
        data = json.loads(resp.read())
    return data['choices'][0]['message']['content']


def handler(event: dict, context) -> dict:
    """Чат с ИИ-советником по рекомендациям звонков."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    messages      = body.get('messages', [])
    recommendations = body.get('recommendations', [])
    system_prompt = body.get('system_prompt', DEFAULT_SYSTEM_PROMPT)

    stats = get_stats()

    context_block = ''
    if stats:
        context_block += f"""
ТЕКУЩИЕ ПОКАЗАТЕЛИ (из {stats['total']} проанализированных звонков):
- Конверсия в сделку: {stats['conversion_rate']}%
- Целевые звонки: {stats['target_rate']}%
- Средняя оценка оператора: {stats['avg_score']}/10
- Соблюдение скрипта: {stats['script_rate']}%
- Отработка возражений: {stats['objection_rate']}%
"""

    if recommendations:
        context_block += '\nТЕКУЩИЕ РЕКОМЕНДАЦИИ ИИ:\n'
        for i, rec in enumerate(recommendations, 1):
            context_block += (
                f"#{i} [{rec.get('priority','').upper()}] {rec.get('title','')}\n"
                f"   Проблема: {rec.get('problem','')}\n"
                f"   Действие: {rec.get('action','')}\n\n"
            )

    full_system = system_prompt + '\n\n' + context_block if context_block else system_prompt

    reply = call_mistral(messages, full_system)

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({'reply': reply, 'default_prompt': DEFAULT_SYSTEM_PROMPT}, ensure_ascii=False),
    }