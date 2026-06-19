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
    """Возвращает comm_id всех звонков с готовым транскриптом (replica_count > 0)."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor()
    cur.execute(
        f"SELECT comm_id, replica_count, operator_replicas, client_replicas "
        f"FROM {SCHEMA}.call_transcripts WHERE replica_count > 0"
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    done = {
        row[0]: {
            'replica_count':     row[1],
            'operator_replicas': row[2],
            'client_replicas':   row[3],
        }
        for row in rows
    }

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({'done': done}, ensure_ascii=False),
    }