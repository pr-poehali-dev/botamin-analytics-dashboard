"""
Меняет местами оператора и клиента в транскрипте.
Обновляет replicas, full_text, operator_replicas, client_replicas в БД.
POST { comm_id: string }
"""
import json
import os
import psycopg2

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA       = os.environ.get('MAIN_DB_SCHEMA', 't_p87080492_botamin_analytics_da')

CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


def handler(event: dict, context) -> dict:
    """Меняет оператора и клиента местами в транскрипте звонка."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    body    = json.loads(event.get('body') or '{}')
    comm_id = body.get('comm_id', '')

    if not comm_id:
        return {'statusCode': 400, 'headers': CORS,
                'body': json.dumps({'error': 'comm_id обязателен'}, ensure_ascii=False)}

    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor()

    # Читаем текущий транскрипт
    cur.execute(
        f"SELECT replicas, operator_replicas, client_replicas FROM {SCHEMA}.call_transcripts WHERE comm_id = %s",
        (comm_id,)
    )
    row = cur.fetchone()
    if not row:
        cur.close(); conn.close()
        return {'statusCode': 404, 'headers': CORS,
                'body': json.dumps({'error': 'Транскрипт не найден'}, ensure_ascii=False)}

    replicas_raw, op_count, cl_count = row
    replicas = replicas_raw if isinstance(replicas_raw, list) else (json.loads(replicas_raw) if replicas_raw else [])

    # Меняем роли в каждой реплике
    swapped = []
    for r in replicas:
        r2 = dict(r)
        if r2.get('speaker') == 'operator':
            r2['speaker']       = 'client'
            r2['speaker_label'] = 'Клиент'
        elif r2.get('speaker') == 'client':
            r2['speaker']       = 'operator'
            r2['speaker_label'] = 'Оператор'
        swapped.append(r2)

    # Пересчитываем full_text
    lines = []
    for r in swapped:
        if r.get('segment') != 'ivr':
            lines.append(f"{r.get('speaker_label', '')}: {r.get('text', '')}")
    full_text = '\n'.join(lines)

    # Обновляем в БД
    new_op = cl_count or 0
    new_cl = op_count or 0

    cur.execute(
        f"""UPDATE {SCHEMA}.call_transcripts
            SET replicas=%s, full_text=%s, operator_replicas=%s, client_replicas=%s, updated_at=NOW()
            WHERE comm_id=%s""",
        (json.dumps(swapped, ensure_ascii=False), full_text, new_op, new_cl, comm_id)
    )
    conn.commit()
    cur.close()
    conn.close()

    print(f'[SWAP] comm_id={comm_id} op={new_op} cl={new_cl}')

    return {
        'statusCode': 200,
        'headers': {**CORS, 'Content-Type': 'application/json'},
        'body': json.dumps({
            'ok': True,
            'comm_id':          comm_id,
            'replicas':         swapped,
            'full_text':        full_text,
            'operator_replicas': new_op,
            'client_replicas':   new_cl,
        }, ensure_ascii=False),
    }
