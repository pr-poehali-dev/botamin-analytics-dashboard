"""
Читает Excel файл CoMagic по URL, возвращает статистику: статусы, длительности, даты, примеры строк.
"""
import urllib.request
import json
import io
from collections import Counter
import re


def handler(event: dict, context) -> dict:
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    import openpyxl

    url = (event.get('queryStringParameters') or {}).get(
        'url',
        'https://cdn.poehali.dev/projects/6a84af2c-c107-4039-b71a-e57da70119f0/bucket/f46cc9cf-190b-4379-8e94-6225cc11ec61.xlsx'
    )

    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()

    wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    ws = wb.active
    rows_raw = list(ws.iter_rows(values_only=True))

    # Найдём строку заголовков
    header_row = None
    data_start = 0
    for i, row in enumerate(rows_raw):
        if row[0] and str(row[0]).startswith('Дата'):
            header_row = [str(c) if c is not None else '' for c in row]
            data_start = i + 1
            break

    if not header_row:
        return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'header not found'})}

    data_rows = []
    for row in rows_raw[data_start:]:
        if any(c is not None for c in row):
            data_rows.append([str(c) if c is not None else '' for c in row])

    total = len(data_rows)
    statuses = Counter()
    durations_sec = []
    dates = []

    for row in data_rows:
        date = row[0] if len(row) > 0 else ''
        dur = row[1] if len(row) > 1 else ''
        status = row[4] if len(row) > 4 else ''
        statuses[status] += 1
        if date:
            dates.append(date)
        m = re.match(r'(\d+):(\d+):(\d+)', str(dur))
        if m:
            sec = int(m.group(1))*3600 + int(m.group(2))*60 + int(m.group(3))
            durations_sec.append(sec)

    avg_dur = sum(durations_sec) / len(durations_sec) if durations_sec else 0

    return {
        'statusCode': 200,
        'headers': {**cors, 'Content-Type': 'application/json'},
        'body': json.dumps({
            'headers': header_row,
            'total_rows': total,
            'statuses': dict(statuses),
            'avg_duration_sec': round(avg_dur),
            'date_range': {'min': min(dates) if dates else '', 'max': max(dates) if dates else ''},
            'samples': data_rows[:10],
        }, ensure_ascii=False)
    }