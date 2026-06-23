"""
Объединённый AI-инсайт эндпоинт.
GET ?action=stats  — агрегированная статистика по всем звонкам (бывший ai-stats)
GET ?action=recs   — рекомендации на основе аналитики (бывший ai-recommendations)
"""
import json
import os
import psycopg2
from collections import Counter

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA       = os.environ.get('MAIN_DB_SCHEMA', 't_p87080492_botamin_analytics_da')

CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


def get_db():
    return psycopg2.connect(DATABASE_URL)


def build_stats(rows):
    total = len(rows)
    if total == 0:
        return {'total': 0, 'empty': True}

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
    by_date_scores = {}
    by_date_targets = {}
    best_calls = []
    worst_calls = []

    for row in rows:
        comm_id, call_type, qualification, interest, outcome, fail_reason, success_factor, \
        score, script, objections, phrases_client, phrases_operator, dur_sec, date, summary = row

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
            call_info = {'comm_id': comm_id, 'score': score, 'date': str(date) if date else '',
                         'summary': summary or '', 'outcome': outcome or ''}
            if score >= 8:
                best_calls.append(call_info)
            elif score <= 4:
                worst_calls.append(call_info)
        if script:
            followed_script += 1
        if objections:
            handled_objections += 1

        if phrases_client:
            for ph in (phrases_client if isinstance(phrases_client, list) else json.loads(phrases_client)):
                all_phrases_client[ph] += 1
        if phrases_operator:
            for ph in (phrases_operator if isinstance(phrases_operator, list) else json.loads(phrases_operator)):
                all_phrases_operator[ph] += 1

        if date:
            d = str(date)
            by_date[d] += 1
            if score:
                by_date_scores.setdefault(d, []).append(score)
            by_date_targets.setdefault(d, []).append(1 if call_type == 'target' else 0)

    target_count = call_types.get('target', 0)
    qualified_count = qualifications.get('qualified', 0)
    success_count = outcomes.get('success', 0)
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0
    conversion_rate = round(success_count / total * 100, 1) if total else 0
    target_rate = round(target_count / total * 100, 1) if total else 0
    qualification_rate = round(qualified_count / total * 100, 1) if total else 0
    script_rate = round(followed_script / total * 100, 1) if total else 0
    objection_rate = round(handled_objections / total * 100, 1) if total else 0

    fail_counter = Counter(fail_reasons)
    success_counter = Counter(success_factors)
    top_fails = [{'reason': r, 'count': c} for r, c in fail_counter.most_common(10)]
    top_success = [{'factor': f, 'count': c} for f, c in success_counter.most_common(5)]
    top_phrases_client = [{'phrase': p, 'count': c} for p, c in all_phrases_client.most_common(10)]
    top_phrases_operator = [{'phrase': p, 'count': c} for p, c in all_phrases_operator.most_common(10)]

    by_date_list = [{'date': d, 'count': c} for d, c in sorted(by_date.items())]

    quality_by_date = []
    for d in sorted(by_date_scores.keys()):
        day_scores = by_date_scores[d]
        day_targets = by_date_targets.get(d, [])
        quality_by_date.append({
            'date': d,
            'avg_score': round(sum(day_scores) / len(day_scores), 1) if day_scores else 0,
            'target_rate': round(sum(day_targets) / len(day_targets) * 100, 1) if day_targets else 0,
            'count': by_date[d],
        })

    best_calls.sort(key=lambda x: -x['score'])
    worst_calls.sort(key=lambda x: x['score'])
    score_dist = Counter(scores)
    score_distribution = [{'score': s, 'count': score_dist[s]} for s in range(1, 11)]

    return {
        'total': total, 'empty': False,
        'target_count': target_count, 'target_rate': target_rate,
        'qualified_count': qualified_count, 'qualification_rate': qualification_rate,
        'success_count': success_count, 'conversion_rate': conversion_rate,
        'avg_operator_score': avg_score, 'script_rate': script_rate,
        'objection_rate': objection_rate,
        'call_types': dict(call_types), 'interests': dict(interests), 'outcomes': dict(outcomes),
        'score_distribution': score_distribution,
        'top_fail_reasons': top_fails, 'top_success_factors': top_success,
        'top_phrases_client': top_phrases_client, 'top_phrases_operator': top_phrases_operator,
        'by_date': by_date_list, 'quality_by_date': quality_by_date,
        'top_best_calls': best_calls[:5], 'top_worst_calls': worst_calls[:5],
    }


def build_recs(rows):
    total = len(rows)
    if total == 0:
        return {'total': 0, 'recommendations': []}

    target_count    = sum(1 for r in rows if r[0] == 'target')
    qualified_count = sum(1 for r in rows if r[1])
    success_count   = sum(1 for r in rows if r[3] == 'success')
    failure_count   = sum(1 for r in rows if r[3] == 'failure')
    scores          = [r[6] for r in rows if r[6]]
    script_count    = sum(1 for r in rows if r[7])
    objection_count = sum(1 for r in rows if r[8])
    interests       = Counter(r[2] for r in rows if r[2])
    fail_reasons    = [r[4] for r in rows if r[4]]
    success_factors = [r[5] for r in rows if r[5]]
    phrases_client  = []
    for r in rows:
        if r[9]:
            phrases_client.extend(r[9] if isinstance(r[9], list) else json.loads(r[9]))

    avg_score          = round(sum(scores) / len(scores), 1) if scores else 0
    target_rate        = round(target_count / total * 100, 1)
    conversion_rate    = round(success_count / total * 100, 1)
    qualification_rate = round(qualified_count / total * 100, 1)
    script_rate        = round(script_count / total * 100, 1)
    objection_rate     = round(objection_count / total * 100, 1)
    low_interest_pct   = round(interests.get('low', 0) / total * 100, 1)
    high_interest_pct  = round(interests.get('high', 0) / total * 100, 1)
    low_score_count    = sum(1 for s in scores if s <= 4)
    high_score_count   = sum(1 for s in scores if s >= 8)

    fail_counter    = Counter(fail_reasons)
    success_counter = Counter(success_factors)
    phrase_counter  = Counter(phrases_client)
    top_fail        = fail_counter.most_common(3)
    top_success     = success_counter.most_common(2)
    top_phrases     = phrase_counter.most_common(5)

    recs = []

    if conversion_rate == 0:
        recs.append({'id': 'conversion_zero', 'priority': 'high', 'category': 'Конверсия', 'icon': 'TrendingUp',
            'title': f'Пока нет успешных звонков из {total} проанализированных',
            'problem': 'В B2B холодных продажах это нормально на старте — конверсия в сделку обычно 1–3%.',
            'action': 'Сфокусируйтесь на промежуточной метрике — договорённостях о следующем шаге.',
            'metric': f'{conversion_rate}% конверсия', 'target': 'Реалистичная цель B2B: 1–3%'})
    elif conversion_rate < 3:
        recs.append({'id': 'conversion_low', 'priority': 'medium', 'category': 'Конверсия', 'icon': 'TrendingUp',
            'title': f'Конверсия {conversion_rate}% — в норме для холодных B2B',
            'problem': f'{success_count} успешных из {total} звонков.',
            'action': 'Для роста ключевое — качество выхода на ЛПР и оффер в первые 20 секунд.',
            'metric': f'{conversion_rate}% конверсия', 'target': 'Цель роста: 3–5%'})
    elif conversion_rate < 8:
        recs.append({'id': 'conversion_good', 'priority': 'low', 'category': 'Конверсия', 'icon': 'TrendingUp',
            'title': f'Конверсия {conversion_rate}% — выше среднего для B2B',
            'problem': f'Хороший результат. {success_count} сделок из {total}.',
            'action': 'Зафиксируйте что работает и масштабируйте на всю команду.',
            'metric': f'{conversion_rate}% конверсия', 'target': 'Отличный результат: 8–10%'})

    if target_rate < 10:
        recs.append({'id': 'target_very_low', 'priority': 'high', 'category': 'Качество базы', 'icon': 'Target',
            'title': f'Только {target_rate}% звонков с потенциалом — проверьте базу',
            'problem': f'{total - target_count} из {total} контактов нерелевантны.',
            'action': 'Проверьте источник и фильтры базы: отрасль, размер компании, должность ЛПР.',
            'metric': f'{target_rate}% целевых', 'target': 'Реалистичная цель B2B: 15–25%'})
    elif target_rate < 20:
        recs.append({'id': 'target_low', 'priority': 'medium', 'category': 'Качество базы', 'icon': 'Target',
            'title': f'{target_rate}% целевых — норма, но база требует чистки',
            'problem': 'Можно улучшить качество сегментации.',
            'action': 'Добавьте фильтр по должности и размеру компании.',
            'metric': f'{target_rate}% целевых', 'target': 'Хорошая цель: 25–35%'})

    if script_rate < 40:
        recs.append({'id': 'script_low', 'priority': 'high', 'category': 'Работа операторов', 'icon': 'ClipboardList',
            'title': f'Скрипт соблюдают только {script_rate}% операторов',
            'problem': 'Без скрипта операторы теряют инициативу в ключевых моментах.',
            'action': 'Проведите разбор лучших звонков, сделайте скрипт доступным прямо в CRM.',
            'metric': f'{script_rate}% соблюдение скрипта', 'target': 'Реалистичная цель: 60–70%'})
    elif script_rate < 60:
        recs.append({'id': 'script_medium', 'priority': 'medium', 'category': 'Работа операторов', 'icon': 'ClipboardList',
            'title': f'Скрипт соблюдается в {script_rate}% — есть резерв',
            'problem': 'Скрипт особенно важен при проходе секретаря.',
            'action': 'Выясните какие этапы пропускаются, обновите скрипт под реальные возражения.',
            'metric': f'{script_rate}%', 'target': '70–80%'})

    if objection_rate < 20:
        recs.append({'id': 'objections_low', 'priority': 'high', 'category': 'Работа с возражениями', 'icon': 'ShieldCheck',
            'title': f'Возражения отрабатываются в {objection_rate}% звонков',
            'problem': 'Операторы не доходят до ЛПР или сдаются при первом «не интересно».',
            'action': 'Составьте банк ответов на топ-3 возражения секретаря.',
            'metric': f'{objection_rate}% отработка', 'target': '30–50%'})
    elif objection_rate < 40:
        recs.append({'id': 'objections_medium', 'priority': 'low', 'category': 'Работа с возражениями', 'icon': 'ShieldCheck',
            'title': f'Возражения — {objection_rate}%, норма для холодных звонков',
            'problem': 'Показатель в норме.',
            'action': 'Проверьте качество отработки — используют ли операторы «присоединение + вопрос».',
            'metric': f'{objection_rate}%', 'target': '50%+'})

    if avg_score < 4:
        recs.append({'id': 'score_critical', 'priority': 'high', 'category': 'Качество операторов', 'icon': 'Star',
            'title': f'Оценка операторов {avg_score}/10 — требует срочного внимания',
            'problem': f'{low_score_count} звонков получили оценку 1–4.',
            'action': f'Прослушайте {min(low_score_count, 5)} худших звонков вместе с командой.',
            'metric': f'{avg_score}/10', 'target': '5–6/10'})
    elif avg_score < 6:
        recs.append({'id': 'score_low', 'priority': 'medium', 'category': 'Качество операторов', 'icon': 'Star',
            'title': f'Оценка операторов {avg_score}/10 — средний уровень',
            'problem': f'Есть потенциал роста через улучшение открытия звонка.',
            'action': f'Изучите {high_score_count} лучших звонков — что делают операторы с оценкой 7+?',
            'metric': f'{avg_score}/10', 'target': '6–7/10'})

    if low_interest_pct > 80:
        recs.append({'id': 'interest_low', 'priority': 'high', 'category': 'Вовлечённость', 'icon': 'UserX',
            'title': f'{low_interest_pct}% звонков — клиент не заинтересован',
            'problem': '80%+ говорит о проблеме с базой или оффером.',
            'action': 'Протестируйте 3 разных открытия звонка с разными офферами.',
            'metric': f'{low_interest_pct}% низкий интерес', 'target': 'Снизить до 60–70%'})
    elif high_interest_pct < 5:
        recs.append({'id': 'interest_high_low', 'priority': 'medium', 'category': 'Вовлечённость', 'icon': 'Flame',
            'title': f'Высокий интерес только у {high_interest_pct}% — проверьте оффер',
            'problem': 'Ниже 5% — возможно оффер слабый или база нерелевантная.',
            'action': 'Протестируйте формулировку с конкретной цифрой или кейсом.',
            'metric': f'{high_interest_pct}% высокий интерес', 'target': '8–15%'})

    if qualification_rate < 3:
        recs.append({'id': 'qualification_low', 'priority': 'medium', 'category': 'Квалификация', 'icon': 'UserCheck',
            'title': f'Квалифицировано {qualification_rate}% — типично для холодных B2B',
            'problem': 'Секретарский барьер и нецелевые контакты снижают показатель.',
            'action': 'Добавьте 1–2 квалифицирующих вопроса сразу после прохода секретаря.',
            'metric': f'{qualification_rate}%', 'target': '3–8%'})

    if top_fail:
        top_reason = top_fail[0][0] if top_fail else ''
        is_secretary = any(k in top_reason.lower() for k in
            ['секретар', 'почту', 'пришлите', 'не нужно', 'не интересно', 'занят', 'перезвоните'])
        if is_secretary:
            recs.append({'id': 'fail_secretary', 'priority': 'high', 'category': 'Проход секретаря', 'icon': 'DoorClosed',
                'title': 'Главный барьер — секретарский фильтр',
                'problem': f'Большинство отказов до выхода на ЛПР. «{top_reason[:60]}».',
                'action': 'Отработайте 3 техники: метод «своего», называть ЛПР по имени, ссылаться на договорённость.',
                'metric': f'{failure_count} отказов', 'target': 'Выход на ЛПР 15–20%'})
        else:
            reason_text = '; '.join([f'«{r[:50]}»' for r, c in top_fail[:2]])
            recs.append({'id': 'fail_reasons', 'priority': 'medium', 'category': 'Причины отказов', 'icon': 'XCircle',
                'title': 'Повторяющиеся причины отказов — нужны скрипты отработки',
                'problem': f'Чаще всего: {reason_text}.',
                'action': 'Создайте карточку с 3 вариантами ответа на каждую топ-причину.',
                'metric': f'{failure_count} отказов из {total}', 'target': 'Снизить отказы на 30% за 2 недели'})

    if top_success and success_count > 0:
        factor_text = top_success[0][0] if top_success else ''
        recs.append({'id': 'success_scale', 'priority': 'medium', 'category': 'Что работает', 'icon': 'Trophy',
            'title': 'Есть успешные звонки — разберите их детально',
            'problem': f'Общий фактор успеха: «{factor_text[:80]}».',
            'action': 'Запишите разбор каждого успешного звонка и сделайте шаблон.',
            'metric': f'{success_count} успешных из {total}', 'target': 'Масштабировать паттерн на 50% звонков'})

    if top_phrases and len(top_phrases) >= 3:
        phrases_text = ', '.join([f'«{p}»' for p, _ in top_phrases[:3]])
        recs.append({'id': 'client_phrases', 'priority': 'low', 'category': 'Язык клиента', 'icon': 'MessageSquare',
            'title': 'Клиенты сами подсказывают как говорить с ними',
            'problem': f'Клиенты используют: {phrases_text}.',
            'action': 'Внедрите эти формулировки в скрипт открытия звонка.',
            'metric': f'{len(phrases_client)} фраз', 'target': 'Протестировать на 20 звонках'})

    if total < 50:
        recs.append({'id': 'more_data', 'priority': 'low', 'category': 'Аналитика', 'icon': 'BarChart2',
            'title': f'Проанализировано {total} звонков — нужно больше для точных выводов',
            'problem': 'Для надёжных выводов нужно 100–150 звонков.',
            'action': 'Запустите авто-режим чтобы транскрибировать все доступные звонки.',
            'metric': f'{total} звонков', 'target': '150+ звонков'})

    priority_order = {'high': 0, 'medium': 1, 'low': 2}
    recs.sort(key=lambda x: priority_order[x['priority']])

    return {
        'total': total, 'target_rate': target_rate,
        'conversion_rate': conversion_rate, 'avg_score': avg_score,
        'script_rate': script_rate, 'objection_rate': objection_rate,
        'recommendations': recs[:8],
    }


def handler(event: dict, context) -> dict:
    """ai-insights: action=stats — статистика, action=recs — рекомендации."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    action = (event.get('queryStringParameters') or {}).get('action', 'stats')

    conn = get_db()
    cur  = conn.cursor()

    if action == 'recs':
        cur.execute(f"""
            SELECT a.call_type, a.qualification, a.client_interest, a.outcome,
                   a.fail_reason, a.success_factor, a.operator_score,
                   a.operator_followed_script, a.operator_handled_objections,
                   a.key_phrases_client, a.summary
            FROM {SCHEMA}.call_analyses a
            LEFT JOIN {SCHEMA}.call_transcripts t ON a.comm_id = t.comm_id
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        result = build_recs(rows)
    else:
        cur.execute(f"""
            SELECT a.comm_id, a.call_type, a.qualification, a.client_interest, a.outcome,
                   a.fail_reason, a.success_factor, a.operator_score,
                   a.operator_followed_script, a.operator_handled_objections,
                   a.key_phrases_client, a.key_phrases_operator,
                   t.duration_sec, t.date, a.summary
            FROM {SCHEMA}.call_analyses a
            LEFT JOIN {SCHEMA}.call_transcripts t ON a.comm_id = t.comm_id
            ORDER BY t.date DESC
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        result = build_stats(rows)

    return {
        'statusCode': 200,
        'headers': {**CORS, 'Content-Type': 'application/json'},
        'body': json.dumps(result, ensure_ascii=False),
    }
