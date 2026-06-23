"""
Объединённый batch-эндпоинт.
GET ?action=status  — список comm_id уже транскрибированных (бывший batch-status)
GET ?action=pending — список транскриптов без анализа (бывший batch-analyze)
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
    """batch-api: action=status возвращает готовые транскрипты, action=pending — без анализа."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    action = (event.get('queryStringParameters') or {}).get('action', 'status')

    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor()

    if action == 'pending':
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
        pending = [{'comm_id': r[0], 'full_text': r[1], 'duration_sec': r[2] or 0} for r in rows]
        return {
            'statusCode': 200,
            'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps({'pending': pending, 'count': len(pending)}, ensure_ascii=False),
        }

    # action == 'status' (default)
    cur.execute(
        f"SELECT comm_id, replica_count, operator_replicas, client_replicas "
        f"FROM {SCHEMA}.call_transcripts WHERE jsonb_array_length(replicas) > 0"
    )
    transcripts = {row[0]: {'replica_count': row[1], 'operator_replicas': row[2], 'client_replicas': row[3]}
                   for row in cur.fetchall()}

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
        'headers': {**CORS, 'Content-Type': 'application/json'},
        'body': json.dumps({'done': done}, ensure_ascii=False),
    }
