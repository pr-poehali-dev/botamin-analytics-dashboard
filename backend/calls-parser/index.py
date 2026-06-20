"""
Парсит Excel-файл со звонками CoMagic/Bitrix24.
Принимает файл через POST (base64) или URL через GET.
Возвращает KPI, динамику по дням, распределение по часам, длительностям, таблицу звонков.
"""
import json
import io
import base64
import re
import urllib.request
from collections import defaultdict, Counter
from datetime import datetime


def parse_duration(dur_str: str) -> int:
    """HH:MM:SS -> секунды"""
    m = re.match(r'(\d+):(\d+):(\d+)', str(dur_str))
    if m:
        return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3))
    return 0


def parse_excel(data: bytes) -> list:
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    ws = wb.active
    rows_raw = list(ws.iter_rows(values_only=True))

    data_start = 0
    for i, row in enumerate(rows_raw):
        if row[0] and str(row[0]).startswith('Дата'):
            data_start = i + 1
            break

    calls = []
    for row in rows_raw[data_start:]:
        if not any(c is not None for c in row):
            continue
        date_str = str(row[0]) if row[0] else ''
        dur_str = str(row[1]) if len(row) > 1 and row[1] else '00:00:00'
        detail_str = str(row[2]) if len(row) > 2 and row[2] else ''
        record_url = str(row[3]) if len(row) > 3 and row[3] else ''
        status = str(row[4]) if len(row) > 4 and row[4] else ''

        # Парсим communication_id из детализации
        comm_id_match = re.search(r"'communication_id': (\d+)", detail_str)
        comm_id = comm_id_match.group(1) if comm_id_match else ''

        # Парсим call_type_name
        type_match = re.search(r"'call_type_name': '([^']+)'", detail_str)
        call_type = type_match.group(1) if type_match else 'Неизвестно'

        dur_sec = parse_duration(dur_str)

        # Пробуем парсить дату
        date_obj = None
        for fmt in ('%d.%m.%Y', '%Y-%m-%d'):
            try:
                date_obj = datetime.strptime(date_str, fmt)
                break
            except ValueError:
                continue

        calls.append({
            'date': date_str,
            'date_obj': date_obj,
            'duration': dur_str,
            'duration_sec': dur_sec,
            'call_type': call_type,
            'record_url': record_url,
            'status': status,
            'comm_id': comm_id,
        })

    return calls


def build_analytics(calls: list) -> dict:
    total = len(calls)
    if total == 0:
        return {'total': 0}

    durations = [c['duration_sec'] for c in calls]
    avg_dur = sum(durations) / total
    total_talk_sec = sum(durations)

    # Статусы
    status_counter = Counter(c['status'] for c in calls)

    # По дням
    by_day = defaultdict(lambda: {'count': 0, 'total_sec': 0})
    for c in calls:
        day = c['date']
        by_day[day]['count'] += 1
        by_day[day]['total_sec'] += c['duration_sec']

    def day_sort_key(item):
        """Сортировка дат формата dd.mm.yyyy как дат, а не строк"""
        day = item[0]
        try:
            return datetime.strptime(day, '%d.%m.%Y')
        except ValueError:
            return datetime.min

    by_day_list = [
        {
            'date': day,
            'count': v['count'],
            'avg_sec': round(v['total_sec'] / v['count']) if v['count'] else 0,
        }
        for day, v in sorted(by_day.items(), key=day_sort_key)
    ]

    # По часам (из длительности нет времени, нет поля — пропускаем)
    # Распределение по длительности
    buckets = [
        ('0–30 сек', 0, 30),
        ('30–60 сек', 30, 60),
        ('1–3 мин', 60, 180),
        ('3–5 мин', 180, 300),
        ('5–10 мин', 300, 600),
        ('10+ мин', 600, 99999),
    ]
    duration_dist = []
    for label, lo, hi in buckets:
        cnt = sum(1 for d in durations if lo <= d < hi)
        duration_dist.append({'label': label, 'count': cnt, 'pct': round(cnt / total * 100, 1)})

    # Рекомендации на основе данных
    short_calls = sum(1 for d in durations if d < 30)
    long_calls = sum(1 for d in durations if d >= 300)
    short_pct = round(short_calls / total * 100, 1)
    long_pct = round(long_calls / total * 100, 1)

    recommendations = []
    if short_pct > 20:
        recommendations.append({
            'priority': 'high',
            'title': 'Высокий процент коротких звонков',
            'desc': f'{short_pct}% звонков длятся менее 30 секунд. Вероятно, клиенты кладут трубку до разговора.',
            'action': 'Проверьте IVR-меню и скорость ответа оператора. Цель — снизить до <10%.',
        })
    if long_pct > 15:
        recommendations.append({
            'priority': 'medium',
            'title': 'Много длинных звонков (5+ мин)',
            'desc': f'{long_pct}% звонков длятся более 5 минут.',
            'action': 'Изучите скрипты — возможно, операторы теряют время на поиск информации.',
        })
    if avg_dur < 60:
        recommendations.append({
            'priority': 'high',
            'title': 'Низкая средняя длительность разговора',
            'desc': f'Средний разговор — {round(avg_dur)} сек. Клиенты быстро завершают звонок.',
            'action': 'Внедрите открытые вопросы в начале разговора для удержания внимания.',
        })
    if avg_dur >= 60:
        recommendations.append({
            'priority': 'low',
            'title': 'Средняя длительность в норме',
            'desc': f'Средний разговор — {round(avg_dur)} сек. Это хороший показатель вовлечённости.',
            'action': 'Анализируйте лучшие звонки и масштабируйте успешные скрипты.',
        })

    # Таблица звонков (все, без date_obj)
    calls_table = [
        {
            'date': c['date'],
            'duration': c['duration'],
            'duration_sec': c['duration_sec'],
            'call_type': c['call_type'],
            'record_url': c['record_url'],
            'status': c['status'],
            'comm_id': c['comm_id'],
        }
        for c in calls
    ]

    return {
        'total': total,
        'avg_duration_sec': round(avg_dur),
        'total_talk_sec': total_talk_sec,
        'statuses': dict(status_counter),
        'by_day': by_day_list,
        'duration_dist': duration_dist,
        'recommendations': recommendations,
        'calls': calls_table,
    }


def handler(event: dict, context) -> dict:
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}

    # GET с URL
    if method == 'GET' and params.get('url'):
        url = params['url']
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30) as resp:
            file_data = resp.read()

    # POST с base64 телом
    elif method == 'POST':
        body_raw = event.get('body', '')
        if event.get('isBase64Encoded'):
            body_raw = base64.b64decode(body_raw).decode('utf-8')
        body = json.loads(body_raw)
        file_b64 = body.get('file_base64', '')
        file_data = base64.b64decode(file_b64)

    else:
        return {
            'statusCode': 400,
            'headers': cors,
            'body': json.dumps({'error': 'Нужен POST с file_base64 или GET с ?url='})
        }

    calls = parse_excel(file_data)
    result = build_analytics(calls)

    return {
        'statusCode': 200,
        'headers': {**cors, 'Content-Type': 'application/json'},
        'body': json.dumps(result, ensure_ascii=False),
    }