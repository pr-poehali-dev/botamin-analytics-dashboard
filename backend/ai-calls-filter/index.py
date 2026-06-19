"""
Возвращает список звонков с ИИ-анализом по заданному фильтру.
filter= target | non_target | qualified | not_qualified |
        success | failure | pending |
        high_interest | medium_interest | low_interest |
        high_score | low_score | no_script | no_objections
"""
import json
import os
import psycopg2

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA       = os.environ.get('MAIN_DB_SCHEMA', 't_p87080492_botamin_analytics_da')

CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


def handler(event: dict, context) -> dict:
    """Возвращает звонки по фильтру из ИИ-аналитики."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    params = event.get('queryStringParameters') or {}
    f      = params.get('filter', '')

    if not f:
        return {'statusCode': 400, 'headers': CORS,
                'body': json.dumps({'error': 'filter обязателен'}, ensure_ascii=False)}

    # Строим WHERE условие
    conditions = {
        'target':           "a.call_type = 'target'",
        'non_target':       "a.call_type = 'non_target'",
        'qualified':        "a.qualification = true",
        'not_qualified':    "a.qualification = false",
        'success':          "a.outcome = 'success'",
        'failure':          "a.outcome = 'failure'",
        'pending':          "a.outcome = 'pending'",
        'high_interest':    "a.client_interest = 'high'",
        'medium_interest':  "a.client_interest = 'medium'",
        'low_interest':     "a.client_interest = 'low'",
        'high_score':       "a.operator_score >= 8",
        'low_score':        "a.operator_score <= 4",
        'no_script':        "a.operator_followed_script = false",
        'no_objections':    "a.operator_handled_objections = false",
        'has_script':       "a.operator_followed_script = true",
        'has_objections':   "a.operator_handled_objections = true",
    }

    where = conditions.get(f)
    if not where:
        return {'statusCode': 400, 'headers': CORS,
                'body': json.dumps({'error': f'Неизвестный фильтр: {f}'}, ensure_ascii=False)}

    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor()
    cur.execute(f"""
        SELECT a.comm_id, a.call_type_label, a.qualification_label,
               a.client_interest_label, a.outcome_label,
               a.operator_score, a.fail_reason, a.success_factor,
               a.operator_comment, a.summary,
               a.operator_followed_script, a.operator_handled_objections,
               t.date, t.duration, t.duration_sec
        FROM {SCHEMA}.call_analyses a
        LEFT JOIN {SCHEMA}.call_transcripts t ON a.comm_id = t.comm_id
        WHERE {where}
        ORDER BY a.operator_score DESC NULLS LAST, t.date DESC
        LIMIT 100
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    calls = []
    for row in rows:
        calls.append({
            'comm_id':              row[0],
            'call_type_label':      row[1],
            'qualification_label':  row[2],
            'interest_label':       row[3],
            'outcome_label':        row[4],
            'operator_score':       row[5],
            'fail_reason':          row[6],
            'success_factor':       row[7],
            'operator_comment':     row[8],
            'summary':              row[9],
            'followed_script':      row[10],
            'handled_objections':   row[11],
            'date':                 str(row[12]) if row[12] else '',
            'duration':             row[13] or '',
            'duration_sec':         row[14] or 0,
        })

    return {
        'statusCode': 200,
        'headers': {**CORS, 'Content-Type': 'application/json'},
        'body': json.dumps({'filter': f, 'total': len(calls), 'calls': calls}, ensure_ascii=False),
    }
