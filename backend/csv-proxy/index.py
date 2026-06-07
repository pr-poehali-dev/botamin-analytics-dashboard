"""
Загружает CSV из Google Sheets, парсит на сервере и возвращает
готовые агрегаты для дашборда. Решает проблему CORS и лимита размера ответа.
"""
import urllib.request
import csv
import io
import json
import re
from collections import defaultdict
from datetime import datetime


MEETING_KEYWORDS = [
    'понедельник', 'вторник', 'среда', 'среду', 'четверг', 'четверга',
    'пятница', 'пятницу', 'суббота', 'воскресенье',
    'завтра', 'послезавтра',
    'утром', 'вечером',
    'в два', 'в три', 'в четыре', 'в пять', 'в шесть',
    'в семь', 'в восемь', 'в девять', 'в десять', 'в одиннадцать', 'в двенадцать',
    'записал', 'договорились', 'встречаемся', 'встретимся',
    'записываю', 'на встречу',
]

QUALIFICATION_KEYWORDS = [
    'квалифицир', 'сколько человек', 'сколько менеджеров', 'оборот',
    'бюджет', 'решение принимает', 'лицо принимающее',
]


def contains_any(text: str, keywords: list) -> bool:
    lower = text.lower()
    return any(kw.lower() in lower for kw in keywords)


def classify_stage(dialogue: str) -> int:
    """
    0 = нет диалога (пустой транскрипт)
    1 = только бот говорил, клиент не ответил
    2 = клиент ответил (что-то сказал)
    3 = согласился на встречу (слова встречи + ответ клиента)
    4 = квалифицирован (глубокая беседа с квалификацией)
    """
    if not dialogue or not dialogue.strip():
        return 0

    lines = [l.strip() for l in dialogue.split('\n') if l.strip()]
    # Реальные данные используют "user:" или "client:" для клиента
    client_lines = [l for l in lines if l.lower().startswith('user:') or l.lower().startswith('client:')]
    bot_lines = [l for l in lines if l.lower().startswith('bot:')]

    full_text = dialogue.lower()

    if contains_any(full_text, QUALIFICATION_KEYWORDS) and len(client_lines) > 0:
        return 4

    if contains_any(full_text, MEETING_KEYWORDS) and len(client_lines) > 0:
        return 3

    if len(client_lines) > 0:
        return 2

    if len(bot_lines) >= 1:
        return 1

    return 1


def parse_duration(raw: str) -> int:
    if not raw:
        return 0
    parts = raw.strip().split(':')
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    except (ValueError, IndexError):
        pass
    return 0


def extract_industry(text: str) -> str:
    match = re.search(r'кейс по ([^,.]+)', text, re.IGNORECASE)
    if match and match.group(1).strip():
        return match.group(1).strip()
    return ''


def extract_last_client_phrase(dialogue: str) -> str:
    if not dialogue:
        return ''
    lines = [l.strip() for l in dialogue.split('\n') if l.strip()]
    client_lines = [l for l in lines if l.lower().startswith('user:') or l.lower().startswith('client:')]
    if not client_lines:
        return ''
    last = client_lines[-1]
    last = re.sub(r'^(user|client):\s*', '', last, flags=re.IGNORECASE)
    return last.strip()


def handler(event: dict, context) -> dict:
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    params = event.get('queryStringParameters') or {}
    sheet_id = params.get('sheet_id', '18lZSxc5G6lhj9hoDgVZKMtrYDYzr2tJ692txym3L7oI')
    gid = params.get('gid', '1903196005')

    url = f'https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read().decode('utf-8')

    reader = csv.reader(io.StringIO(raw))
    rows = list(reader)

    if len(rows) < 2:
        return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'No data'})}

    total = 0
    with_dialogue = 0
    stage_counts = [0, 0, 0, 0, 0]
    end_reasons = defaultdict(int)
    duration_total = 0
    hour_calls = defaultdict(int)
    hour_leads = defaultdict(int)
    day_calls = defaultdict(int)
    day_leads = defaultdict(int)
    industry_calls = defaultdict(int)
    industry_leads = defaultdict(int)
    refusal_phrases = defaultdict(int)
    success_phrases = defaultdict(int)
    duration_buckets = [0, 0, 0, 0, 0, 0, 0]
    bucket_bounds = [(0, 5), (5, 15), (15, 30), (30, 60), (60, 120), (120, 300), (300, 999999)]
    day_names = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
    sample_records = []

    for row in rows[1:]:
        if len(row) < 4:
            continue

        total += 1
        phone = row[0] if len(row) > 0 else ''
        dt_str = row[1] if len(row) > 1 else ''
        dur_raw = row[2] if len(row) > 2 else '0:00'
        end_reason = row[5] if len(row) > 5 else ''
        dialogue = row[6] if len(row) > 6 else ''

        dur_sec = parse_duration(dur_raw)
        duration_total += dur_sec

        for bi, (mn, mx) in enumerate(bucket_bounds):
            if mn <= dur_sec < mx:
                duration_buckets[bi] += 1
                break

        end_reasons[end_reason or 'unknown'] += 1

        try:
            dt = datetime.strptime(dt_str.strip(), '%Y-%m-%d %H:%M:%S')
            h = dt.hour
            d = day_names[dt.weekday() + 1 if dt.weekday() < 6 else 0]
        except (ValueError, IndexError):
            h = -1
            d = ''

        has_dialogue = bool(dialogue and dialogue.strip())
        if has_dialogue:
            with_dialogue += 1

        stage = classify_stage(dialogue)
        stage_counts[stage] += 1
        is_lead = stage >= 3

        if h >= 0:
            hour_calls[h] += 1
            if is_lead:
                hour_leads[h] += 1

        if d:
            day_calls[d] += 1
            if is_lead:
                day_leads[d] += 1

        if dialogue:
            industry = extract_industry(dialogue)
            if industry:
                industry_calls[industry] += 1
                if is_lead:
                    industry_leads[industry] += 1

        last_phrase = extract_last_client_phrase(dialogue)
        if last_phrase:
            phrase_key = last_phrase[:60]
            if stage <= 1:
                refusal_phrases[phrase_key] += 1
            elif is_lead:
                success_phrases[phrase_key] += 1

        if len(sample_records) < 500:
            sample_records.append({
                'phone': phone[-4:] if len(phone) >= 4 else phone,
                'datetime': dt_str,
                'durationSec': dur_sec,
                'endReason': end_reason,
                'dialogue': dialogue[:800] if dialogue else '',
                'stage': stage,
                'industry': extract_industry(dialogue) if dialogue else '',
                'lastClientPhrase': last_phrase,
            })

    avg_dur = round(duration_total / total) if total > 0 else 0
    leads = stage_counts[3] + stage_counts[4]

    funnel = [
        {'stage': 0, 'label': 'Все звонки',            'count': total},
        {'stage': 1, 'label': 'Вступили в диалог',      'count': total - stage_counts[0]},
        {'stage': 2, 'label': 'Клиент ответил',         'count': stage_counts[2] + stage_counts[3] + stage_counts[4]},
        {'stage': 3, 'label': 'Согласился на встречу',  'count': stage_counts[3] + stage_counts[4]},
        {'stage': 4, 'label': 'Квалифицирован (лид)',   'count': stage_counts[4]},
    ]
    colors = ['#555555', '#ff4444', '#ff8c00', '#00aaff', '#00ff88']
    for i, f in enumerate(funnel):
        f['color'] = colors[i]
        f['pct'] = round(f['count'] / total * 100, 2) if total > 0 else 0
        prev = funnel[i - 1]['count'] if i > 0 else total
        f['dropPct'] = round((prev - f['count']) / prev * 100, 2) if prev > 0 else 0

    hourly = []
    for h in sorted(hour_calls.keys()):
        c = hour_calls[h]
        lv = hour_leads[h]
        hourly.append({'hour': h, 'label': f'{h}:00', 'calls': c, 'converted': lv,
                       'cr': round(lv / c * 100, 2) if c > 0 else 0})

    by_day = []
    for d in ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']:
        c = day_calls.get(d, 0)
        if c > 0:
            lv = day_leads.get(d, 0)
            by_day.append({'day': d, 'calls': c, 'converted': lv,
                           'cr': round(lv / c * 100, 2) if c > 0 else 0})

    by_industry = sorted(
        [{'industry': k, 'calls': v, 'converted': industry_leads.get(k, 0),
          'cr': round(industry_leads.get(k, 0) / v * 100, 2) if v > 0 else 0}
         for k, v in industry_calls.items()],
        key=lambda x: -x['calls']
    )[:10]

    reason_colors = {
        'bot_hangup': '#00ff88', 'client_hangup': '#ff4444',
        'elevenlabs_hangup': '#ff8c00', 'timeout': '#ff8c00',
        'hangup': '#888888', 'no_answer': '#555555',
        'queue_timeout': '#666666', 'no_user_speech': '#444444',
    }
    end_reason_breakdown = [
        {'name': k, 'value': v, 'color': reason_colors.get(k, '#444444')}
        for k, v in sorted(end_reasons.items(), key=lambda x: -x[1])
    ]

    refusal_list = sorted(
        [{'phrase': k, 'count': v, 'stage': 1} for k, v in refusal_phrases.items()],
        key=lambda x: -x['count']
    )[:12]
    success_list = sorted(
        [{'phrase': k, 'count': v, 'stage': 3} for k, v in success_phrases.items()],
        key=lambda x: -x['count']
    )[:12]

    bucket_labels = ['0–5 сек', '5–15 сек', '15–30 сек', '30–60 сек', '1–2 мин', '2–5 мин', '5+ мин']
    duration_bucket_data = [{'label': bucket_labels[i], 'count': duration_buckets[i]} for i in range(7)]

    result = {
        'total': total,
        'withDialogue': with_dialogue,
        'leads': leads,
        'overallCR': round(leads / total * 100, 4) if total > 0 else 0,
        'avgDurationSec': avg_dur,
        'stageCounts': stage_counts,
        'funnel': funnel,
        'hourly': hourly,
        'byDay': by_day,
        'byIndustry': by_industry,
        'endReasonBreakdown': end_reason_breakdown,
        'durationBuckets': duration_bucket_data,
        'refusalPhrases': refusal_list,
        'successPhrases': success_list,
        'records': sample_records,
    }

    return {
        'statusCode': 200,
        'headers': {**cors, 'Content-Type': 'application/json'},
        'body': json.dumps(result, ensure_ascii=False),
    }
