"""
Агрегирует данные по всем проанализированным звонкам из БД.
Возвращает: KPI, конверсия, топ причин отказов, оценки операторов,
распределение по типам/интересу/итогу, топ фраз.
"""
import json
import os
import psycopg2
from collections import Counter

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p87080492_botamin_analytics_da')


def get_db():
    return psycopg2.connect(DATABASE_URL)


def handler(event: dict, context) -> dict:
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    conn = get_db()
    cur = conn.cursor()

    # Все анализы
    cur.execute(f"""
        SELECT a.call_type, a.qualification, a.client_interest, a.outcome,
               a.fail_reason, a.success_factor, a.operator_score,
               a.operator_followed_script, a.operator_handled_objections,
               a.key_phrases_client, a.key_phrases_operator,
               t.duration_sec, t.date
        FROM {SCHEMA}.call_analyses a
        LEFT JOIN {SCHEMA}.call_transcripts t ON a.comm_id = t.comm_id
        ORDER BY t.date DESC
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    total = len(rows)
    if total == 0:
        return {
            'statusCode': 200,
            'headers': {**cors, 'Content-Type': 'application/json'},
            'body': json.dumps({'total': 0, 'empty': True}, ensure_ascii=False),
        }

    # Счётчики
    call_types = Counter()
    qualifications = Counter()
    interests = Counter()
    outcomes = Counter()
    fail_reasons = []
    success_factors = []
    scores = []
    followed_script = 0
    handled_objections = 0
    all_phrases_client = Counter()
    all_phrases_operator = Counter()
    by_date = Counter()

    for row in rows:
        call_type, qualification, interest, outcome, fail_reason, success_factor, \
        score, script, objections, phrases_client, phrases_operator, dur_sec, date = row

        call_types[call_type or 'unknown'] += 1
        qualifications['qualified' if qualification else 'not_qualified'] += 1
        interests[interest or 'unknown'] += 1
        outcomes[outcome or 'unknown'] += 1

        if fail_reason:
            fail_reasons.append(fail_reason)
        if success_factor:
            success_factors.append(success_factor)
        if score:
            scores.append(score)
        if script:
            followed_script += 1
        if objections:
            handled_objections += 1

        # Фразы
        if phrases_client:
            for ph in (phrases_client if isinstance(phrases_client, list) else json.loads(phrases_client)):
                all_phrases_client[ph] += 1
        if phrases_operator:
            for ph in (phrases_operator if isinstance(phrases_operator, list) else json.loads(phrases_operator)):
                all_phrases_operator[ph] += 1

        if date:
            by_date[str(date)] += 1

    # KPI
    target_count = call_types.get('target', 0)
    qualified_count = qualifications.get('qualified', 0)
    success_count = outcomes.get('success', 0)
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0
    conversion_rate = round(success_count / total * 100, 1) if total else 0
    target_rate = round(target_count / total * 100, 1) if total else 0
    qualification_rate = round(qualified_count / total * 100, 1) if total else 0
    script_rate = round(followed_script / total * 100, 1) if total else 0
    objection_rate = round(handled_objections / total * 100, 1) if total else 0

    # Топ причин отказов (группируем похожие)
    fail_counter = Counter(fail_reasons)
    top_fails = [{'reason': r, 'count': c} for r, c in fail_counter.most_common(10)]

    # Топ факторов успеха
    success_counter = Counter(success_factors)
    top_success = [{'factor': f, 'count': c} for f, c in success_counter.most_common(5)]

    # Топ фраз
    top_phrases_client = [{'phrase': p, 'count': c} for p, c in all_phrases_client.most_common(10)]
    top_phrases_operator = [{'phrase': p, 'count': c} for p, c in all_phrases_operator.most_common(10)]

    # Динамика по датам
    by_date_list = [{'date': d, 'count': c} for d, c in sorted(by_date.items())]

    # Распределение оценок операторов
    score_dist = Counter(scores)
    score_distribution = [{'score': s, 'count': score_dist[s]} for s in range(1, 11)]

    result = {
        'total': total,
        'empty': False,

        # KPI
        'target_count': target_count,
        'target_rate': target_rate,
        'qualified_count': qualified_count,
        'qualification_rate': qualification_rate,
        'success_count': success_count,
        'conversion_rate': conversion_rate,
        'avg_operator_score': avg_score,
        'script_rate': script_rate,
        'objection_rate': objection_rate,

        # Распределения
        'call_types': dict(call_types),
        'interests': dict(interests),
        'outcomes': dict(outcomes),
        'score_distribution': score_distribution,

        # Топы
        'top_fail_reasons': top_fails,
        'top_success_factors': top_success,
        'top_phrases_client': top_phrases_client,
        'top_phrases_operator': top_phrases_operator,

        # Динамика
        'by_date': by_date_list,
    }

    return {
        'statusCode': 200,
        'headers': {**cors, 'Content-Type': 'application/json'},
        'body': json.dumps(result, ensure_ascii=False),
    }
