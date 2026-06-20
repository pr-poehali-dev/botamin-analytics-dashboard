"""
CRUD для отчётов: сохранить, получить список, загрузить, удалить, переименовать.
Данные хранятся в PostgreSQL — доступны с любого устройства/домена.
"""
import json
import os
import psycopg2


SCHEMA = 't_p87080492_botamin_analytics_da'
CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Site',
}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def ok(body):
    return {'statusCode': 200, 'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps(body, ensure_ascii=False, default=str)}


def err(msg, code=400):
    return {'statusCode': code, 'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps({'error': msg}, ensure_ascii=False)}


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    headers = event.get('headers') or {}
    site = headers.get('X-Site', '') or params.get('site', '')

    body = {}
    if event.get('body'):
        raw = event['body']
        try:
            body = json.loads(raw)
        except Exception:
            body = {}

    action = params.get('action', '')

    conn = get_conn()
    cur = conn.cursor()

    try:
        # GET ?action=list — список отчётов (без calls)
        if method == 'GET' and action == 'list':
            cur.execute(
                f"SELECT id, name, created_at, total, date_from, date_to, aggregate "
                f"FROM {SCHEMA}.reports WHERE site = %s ORDER BY created_at DESC",
                (site,)
            )
            rows = cur.fetchall()
            reports = []
            for row in rows:
                reports.append({
                    'id': row[0], 'name': row[1],
                    'createdAt': row[2].isoformat() if row[2] else '',
                    'total': row[3], 'dateFrom': row[4], 'dateTo': row[5],
                    'aggregate': row[6],
                })
            return ok({'reports': reports})

        # GET ?action=load&id=... — загрузить один отчёт с calls
        if method == 'GET' and action == 'load':
            report_id = params.get('id', '')
            if not report_id:
                return err('id required')
            cur.execute(
                f"SELECT id, name, created_at, total, date_from, date_to, aggregate, calls "
                f"FROM {SCHEMA}.reports WHERE id = %s AND site = %s",
                (report_id, site)
            )
            row = cur.fetchone()
            if not row:
                return err('not found', 404)
            data = {
                **row[6],  # aggregate
                'calls': row[7] if row[7] else [],
            }
            return ok({'report': {
                'id': row[0], 'name': row[1],
                'createdAt': row[2].isoformat() if row[2] else '',
                'total': row[3], 'dateFrom': row[4], 'dateTo': row[5],
            }, 'data': data})

        # POST ?action=save — сохранить отчёт
        if method == 'POST' and action == 'save':
            report_id = body.get('id', '')
            name = body.get('name', 'Отчёт')
            total = body.get('total', 0)
            date_from = body.get('dateFrom', '')
            date_to = body.get('dateTo', '')
            aggregate = body.get('aggregate', {})
            calls = body.get('calls', [])

            if not report_id:
                return err('id required')

            cur.execute(
                f"INSERT INTO {SCHEMA}.reports (id, site, name, total, date_from, date_to, aggregate, calls) "
                f"VALUES (%s, %s, %s, %s, %s, %s, %s, %s) "
                f"ON CONFLICT (id) DO UPDATE SET name=%s, total=%s, date_from=%s, date_to=%s, aggregate=%s, calls=%s",
                (
                    report_id, site, name, total, date_from, date_to,
                    json.dumps(aggregate, ensure_ascii=False),
                    json.dumps(calls, ensure_ascii=False),
                    name, total, date_from, date_to,
                    json.dumps(aggregate, ensure_ascii=False),
                    json.dumps(calls, ensure_ascii=False),
                )
            )
            conn.commit()
            return ok({'ok': True, 'id': report_id})

        # PUT ?action=patch&id=... — обновить только aggregate (без calls)
        if method == 'PUT' and action == 'patch':
            report_id = params.get('id', '') or body.get('id', '')
            if not report_id:
                return err('id required')
            aggregate = body.get('aggregate', {})
            total = body.get('total', 0)
            date_from = body.get('dateFrom', '')
            date_to = body.get('dateTo', '')
            cur.execute(
                f"UPDATE {SCHEMA}.reports SET aggregate=%s, total=%s, date_from=%s, date_to=%s "
                f"WHERE id=%s AND site=%s",
                (json.dumps(aggregate, ensure_ascii=False), total, date_from, date_to, report_id, site)
            )
            conn.commit()
            return ok({'ok': True})

        # PUT ?action=rename&id=... — переименовать
        if method == 'PUT' and action == 'rename':
            report_id = params.get('id', '') or body.get('id', '')
            name = body.get('name', '')
            if not report_id or not name:
                return err('id and name required')
            cur.execute(
                f"UPDATE {SCHEMA}.reports SET name=%s WHERE id=%s AND site=%s",
                (name, report_id, site)
            )
            conn.commit()
            return ok({'ok': True})

        # DELETE ?action=delete&id=... — удалить
        if method == 'DELETE' and action == 'delete':
            report_id = params.get('id', '') or body.get('id', '')
            if not report_id:
                return err('id required')
            cur.execute(
                f"DELETE FROM {SCHEMA}.reports WHERE id=%s AND site=%s",
                (report_id, site)
            )
            conn.commit()
            return ok({'ok': True})

        return err('unknown action')

    finally:
        cur.close()
        conn.close()