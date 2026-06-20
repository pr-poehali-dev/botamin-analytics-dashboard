"""
Возвращает список comm_id которые уже транскрибированы в БД.
Используется фронтендом чтобы показать значки готовности в списке звонков.
"""
import json
import os
import psycopg2  # noqa

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA       = os.environ.get('MAIN_DB_SCHEMA', 't_p87080492_botamin_analytics_da')

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


def handler(event: dict, context) -> dict:
    """Возвращает comm_id всех звонков с готовым транскриптом (есть хоть одна реплика)."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor()

    # Транскрипты
    cur.execute(
        f"SELECT comm_id, replica_count, operator_replicas, client_replicas "
        f"FROM {SCHEMA}.call_transcripts WHERE jsonb_array_length(replicas) > 0"
    )
    transcripts = {row[0]: {'replica_count': row[1], 'operator_replicas': row[2], 'client_replicas': row[3]}
                   for row in cur.fetchall()}

    # ИИ-анализы — все поля для фильтрации
    cur.execute(
        f"SELECT comm_id, outcome, call_type, qualification, client_interest, "
        f"operator_score, operator_followed_script, operator_handled_objections "
        f"FROM {SCHEMA}.call_analyses"
    )
    analyses = {row[0]: {
        'outcome': row[1], 'call_type': row[2],
        'qualification': row[3], 'client_interest': row[4],
        'operator_score': row[5],
        'operator_followed_script': row[6],
        'operator_handled_objections': row[7],
    } for row in cur.fetchall()}

    # has_ivr — определяем по наличию реплик с segment='ivr'
    cur.execute(
        f"SELECT comm_id FROM {SCHEMA}.call_transcripts "
        f"WHERE replicas @> '[{{\"segment\": \"ivr\"}}]'::jsonb"
    )
    ivr_ids = {row[0] for row in cur.fetchall()}

    cur.close()
    conn.close()

    done = {}
    for comm_id, tr in transcripts.items():
        entry = dict(tr)
        if comm_id in analyses:
            entry['ai'] = analyses[comm_id]
        if comm_id in ivr_ids:
            entry['has_ivr'] = True
        done[comm_id] = entry

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({'done': done}, ensure_ascii=False),
    }