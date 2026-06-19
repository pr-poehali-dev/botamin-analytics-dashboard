"""
Возвращает список транскриптов которые ещё не проанализированы через ИИ.
Используется фронтендом для батч-анализа всех звонков.
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
    """Возвращает транскрипты без анализа (comm_id, full_text, duration_sec)."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor()

    # Все транскрибированные звонки (есть хоть одна реплика) без анализа
    cur.execute(f"""
        SELECT t.comm_id, t.full_text, t.duration_sec
        FROM {SCHEMA}.call_transcripts t
        LEFT JOIN {SCHEMA}.call_analyses a ON a.comm_id = t.comm_id
        WHERE jsonb_array_length(t.replicas) > 0
          AND a.comm_id IS NULL
          AND t.full_text IS NOT NULL
          AND t.full_text != ''
        ORDER BY t.created_at DESC
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    pending = [
        {'comm_id': r[0], 'full_text': r[1], 'duration_sec': r[2] or 0}
        for r in rows
    ]

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({'pending': pending, 'count': len(pending)}, ensure_ascii=False),
    }