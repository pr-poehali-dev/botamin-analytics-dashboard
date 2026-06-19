"""
Генерирует умные рекомендации на основе данных ИИ-аналитики из БД.
Без внешних LLM — чистая бизнес-логика на реальных числах.
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


def handler(event: dict, context) -> dict:
    """Возвращает список конкретных рекомендаций на основе ИИ-аналитики звонков."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    conn = get_db()
    cur  = conn.cursor()
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

    total = len(rows)
    if total == 0:
        return {'statusCode': 200, 'headers': CORS,
                'body': json.dumps({'total': 0, 'recommendations': []}, ensure_ascii=False)}

    # Агрегация
    target_count     = sum(1 for r in rows if r[0] == 'target')
    qualified_count  = sum(1 for r in rows if r[1])
    success_count    = sum(1 for r in rows if r[3] == 'success')
    failure_count    = sum(1 for r in rows if r[3] == 'failure')
    scores           = [r[6] for r in rows if r[6]]
    script_count     = sum(1 for r in rows if r[7])
    objection_count  = sum(1 for r in rows if r[8])
    interests        = Counter(r[2] for r in rows if r[2])
    fail_reasons     = [r[4] for r in rows if r[4]]
    success_factors  = [r[5] for r in rows if r[5]]
    phrases_client   = []
    for r in rows:
        if r[9]:
            phrases_client.extend(r[9] if isinstance(r[9], list) else json.loads(r[9]))

    avg_score        = round(sum(scores) / len(scores), 1) if scores else 0
    target_rate      = round(target_count / total * 100, 1)
    conversion_rate  = round(success_count / total * 100, 1)
    qualification_rate = round(qualified_count / total * 100, 1)
    script_rate      = round(script_count / total * 100, 1)
    objection_rate   = round(objection_count / total * 100, 1)
    low_interest_pct = round(interests.get('low', 0) / total * 100, 1)
    high_interest_pct = round(interests.get('high', 0) / total * 100, 1)

    fail_counter    = Counter(fail_reasons)
    success_counter = Counter(success_factors)
    phrase_counter  = Counter(phrases_client)

    top_fail    = fail_counter.most_common(3)
    top_success = success_counter.most_common(2)
    top_phrases = phrase_counter.most_common(5)

    low_score_count  = sum(1 for s in scores if s <= 4)
    high_score_count = sum(1 for s in scores if s >= 8)

    # B2B холодные звонки — реалистичные бенчмарки:
    # Конверсия в сделку: 1–3% от всех звонков (норма для холодных B2B)
    # Конверсия в квал (выход на ЛПР + интерес): 5–10%
    # Целевые звонки (есть потенциал): 10–20%
    # Скрипт: 60–70% (сложно при работе с секретарями)
    # Возражения: 30–50% (большинство не доходит до возражений)
    # Оценка оператора: 5–7/10 норма при холодных звонках

    recs = []

    # ── 1. КОНВЕРСИЯ (B2B холодные) ───────────────────────────────────────
    if conversion_rate == 0:
        recs.append({
            'id': 'conversion_zero',
            'priority': 'high',
            'category': 'Конверсия',
            'icon': 'TrendingUp',
            'title': f'Пока нет успешных звонков из {total} проанализированных',
            'problem': f'В B2B холодных продажах это нормально на старте — '
                       f'конверсия в сделку обычно 1–3% от всех звонков. '
                       f'Важнее сейчас считать квалификацию (выход на ЛПР).',
            'action': 'Сфокусируйтесь на промежуточной метрике — количестве договорённостей '
                      'о следующем шаге (КП, встреча, повторный звонок). '
                      'Прослушайте 5 звонков где секретарь пропустил к ЛПР — что сработало?',
            'metric': f'{conversion_rate}% конверсия в сделку',
            'target': 'Реалистичная цель B2B: 1–3%',
        })
    elif conversion_rate < 3:
        recs.append({
            'id': 'conversion_low',
            'priority': 'medium',
            'category': 'Конверсия',
            'icon': 'TrendingUp',
            'title': f'Конверсия {conversion_rate}% — в норме для холодных B2B',
            'problem': f'{success_count} успешных из {total} звонков. '
                       f'Для холодных B2B-продаж это рабочий показатель.',
            'action': 'Для роста с 1→3% ключевое — качество выхода на ЛПР и оффер в первые 20 секунд. '
                      'Протестируйте 2–3 разных формулировки ценностного предложения.',
            'metric': f'{conversion_rate}% конверсия',
            'target': 'Цель роста: 3–5% (топ-результат для холодных B2B)',
        })
    elif conversion_rate < 8:
        recs.append({
            'id': 'conversion_good',
            'priority': 'low',
            'category': 'Конверсия',
            'icon': 'TrendingUp',
            'title': f'Конверсия {conversion_rate}% — выше среднего для B2B',
            'problem': f'Хороший результат для холодных звонков. {success_count} сделок из {total}.',
            'action': 'Зафиксируйте что работает у лучших операторов и масштабируйте на всю команду. '
                      'Запишите топ-3 успешных звонка как обучающий материал.',
            'metric': f'{conversion_rate}% конверсия',
            'target': 'Отличный результат: 8–10%',
        })

    # ── 2. ЦЕЛЕВЫЕ ЗВОНКИ (B2B) ───────────────────────────────────────────
    if target_rate < 10:
        recs.append({
            'id': 'target_very_low',
            'priority': 'high',
            'category': 'Качество базы',
            'icon': 'Target',
            'title': f'Только {target_rate}% звонков с потенциалом — проверьте базу',
            'problem': f'{total - target_count} из {total} контактов нерелевантны. '
                       f'Проблема скорее всего в качестве базы, а не в скрипте.',
            'action': 'Проверьте источник и фильтры базы: отрасль, размер компании, должность ЛПР. '
                      'Добавьте квалифицирующий вопрос на 10–15 секунде чтобы быстро отсеивать нецелевых.',
            'metric': f'{target_rate}% целевых',
            'target': 'Реалистичная цель B2B: 15–25%',
        })
    elif target_rate < 20:
        recs.append({
            'id': 'target_low',
            'priority': 'medium',
            'category': 'Качество базы',
            'icon': 'Target',
            'title': f'{target_rate}% целевых — норма, но база требует чистки',
            'problem': f'При холодных B2B звонках 15–25% целевых — рабочий показатель. '
                       f'Можно улучшить качество сегментации.',
            'action': 'Добавьте фильтр по должности (только ЛПР/ЛВР) и размеру компании. '
                      'Исключите из базы отрасли где уже много отказов.',
            'metric': f'{target_rate}% целевых',
            'target': 'Хорошая цель: 25–35%',
        })

    # ── 3. СКРИПТ ОПЕРАТОРА ───────────────────────────────────────────────
    if script_rate < 40:
        recs.append({
            'id': 'script_low',
            'priority': 'high',
            'category': 'Работа операторов',
            'icon': 'ClipboardList',
            'title': f'Скрипт соблюдают только {script_rate}% операторов',
            'problem': f'При работе с секретарём и ЛПР важно следовать структуре. '
                       f'Без скрипта операторы теряют инициативу в ключевых моментах.',
            'action': 'Проведите групповой разбор 3–5 лучших звонков где удалось пройти секретаря. '
                      'Сделайте скрипт доступным прямо в CRM.',
            'metric': f'{script_rate}% соблюдение скрипта',
            'target': 'Реалистичная цель: 60–70%',
        })
    elif script_rate < 60:
        recs.append({
            'id': 'script_medium',
            'priority': 'medium',
            'category': 'Работа операторов',
            'icon': 'ClipboardList',
            'title': f'Скрипт соблюдается в {script_rate}% — есть резерв',
            'problem': 'При холодных B2B-звонках скрипт особенно важен на этапе прохода секретаря '
                       'и первых 30 секундах с ЛПР.',
            'action': 'Выясните какие этапы скрипта пропускаются. '
                      'Обновите скрипт под реальные возражения секретарей из топ-причин отказов.',
            'metric': f'{script_rate}% соблюдение скрипта',
            'target': 'Хорошая цель: 70–80%',
        })

    # ── 4. ОБРАБОТКА ВОЗРАЖЕНИЙ ───────────────────────────────────────────
    if objection_rate < 20:
        recs.append({
            'id': 'objections_low',
            'priority': 'high',
            'category': 'Работа с возражениями',
            'icon': 'ShieldCheck',
            'title': f'Возражения отрабатываются в {objection_rate}% звонков',
            'problem': 'Большинство звонков заканчивается до этапа возражений — '
                       'операторы не доходят до ЛПР или сдаются при первом «не интересно».',
            'action': 'Составьте банк ответов на топ-3 возражения секретаря: '
                      '«Пришлите на почту», «Нам не нужно», «Директор занят». '
                      'Цель — продержаться в разговоре ещё 30 секунд.',
            'metric': f'{objection_rate}% отработка возражений',
            'target': 'Реалистичная цель: 30–50%',
        })
    elif objection_rate < 40:
        recs.append({
            'id': 'objections_medium',
            'priority': 'low',
            'category': 'Работа с возражениями',
            'icon': 'ShieldCheck',
            'title': f'Возражения — {objection_rate}%, норма для холодных звонков',
            'problem': 'При холодных B2B-звонках до возражений доходят не всегда — '
                       'часто просто вешают трубку. Показатель в норме.',
            'action': 'Сфокусируйтесь на качестве отработки, а не количестве. '
                      'Проверьте насколько операторы используют технику «присоединение + вопрос».',
            'metric': f'{objection_rate}% отработка возражений',
            'target': 'Хорошая цель: 50%+',
        })

    # ── 5. ОЦЕНКА ОПЕРАТОРОВ ──────────────────────────────────────────────
    if avg_score < 4:
        recs.append({
            'id': 'score_critical',
            'priority': 'high',
            'category': 'Качество операторов',
            'icon': 'Star',
            'title': f'Оценка операторов {avg_score}/10 — требует срочного внимания',
            'problem': f'{low_score_count} звонков получили оценку 1–4. '
                       f'Базовые ошибки: нет представления, нет оффера, сдаётся при первом «нет».',
            'action': f'Прослушайте {min(low_score_count, 5)} худших звонков вместе с командой. '
                      f'Найдите один конкретный момент где разговор ломается и отработайте его.',
            'metric': f'{avg_score}/10 средняя оценка',
            'target': 'Реалистичная цель: 5–6/10',
        })
    elif avg_score < 6:
        recs.append({
            'id': 'score_low',
            'priority': 'medium',
            'category': 'Качество операторов',
            'icon': 'Star',
            'title': f'Оценка операторов {avg_score}/10 — средний уровень',
            'problem': f'Для холодных B2B-звонков {avg_score}/10 — рабочий показатель. '
                       f'Есть потенциал роста через улучшение открытия звонка.',
            'action': f'Изучите {high_score_count} лучших звонков — что делают операторы с оценкой 7+? '
                      f'Обычно это качество оффера в первые 20 секунд.',
            'metric': f'{avg_score}/10 средняя оценка',
            'target': 'Хорошая цель: 6–7/10',
        })

    # ── 6. ИНТЕРЕС КЛИЕНТОВ ───────────────────────────────────────────────
    if low_interest_pct > 80:
        recs.append({
            'id': 'interest_low',
            'priority': 'high',
            'category': 'Вовлечённость',
            'icon': 'UserX',
            'title': f'{low_interest_pct}% звонков — клиент не заинтересован',
            'problem': 'В холодных B2B-продажах это частично норма, но 80%+ говорит о проблеме '
                       'либо с базой (нерелевантные контакты), либо с оффером (не цепляет).',
            'action': 'Протестируйте 3 разных открытия звонка с разными офферами. '
                      'Измерьте в каком проценте случаев клиент остаётся на линии дольше 30 секунд.',
            'metric': f'{low_interest_pct}% низкий интерес',
            'target': 'Реалистичная цель: снизить до 60–70%',
        })
    elif high_interest_pct < 5:
        recs.append({
            'id': 'interest_high_low',
            'priority': 'medium',
            'category': 'Вовлечённость',
            'icon': 'Flame',
            'title': f'Высокий интерес только у {high_interest_pct}% — проверьте оффер',
            'problem': 'В холодных B2B 5–15% высокого интереса — хороший результат. '
                       'Ниже 5% — возможно оффер слабый или база нерелевантная.',
            'action': 'Запишите дословно что говорят операторы в первые 20 секунд. '
                      'Протестируйте формулировку с конкретной цифрой или кейсом клиента из похожей отрасли.',
            'metric': f'{high_interest_pct}% высокий интерес',
            'target': 'Хорошая цель: 8–15%',
        })

    # ── 7. КВАЛИФИКАЦИЯ ───────────────────────────────────────────────────
    if qualification_rate < 3:
        recs.append({
            'id': 'qualification_low',
            'priority': 'medium',
            'category': 'Квалификация',
            'icon': 'UserCheck',
            'title': f'Квалифицировано {qualification_rate}% — типично для холодных B2B',
            'problem': 'При холодных звонках квалификация 2–5% — нормальный показатель. '
                       'Секретарский барьер и нецелевые контакты снижают этот процент.',
            'action': 'Добавьте в скрипт 1–2 квалифицирующих вопроса сразу после прохода секретаря: '
                      '«Вы принимаете решения по [тема]?» и «Насколько это актуально сейчас?»',
            'metric': f'{qualification_rate}% квалификация',
            'target': 'Реалистичная цель: 3–8%',
        })

    # ── 8. ТОП ПРИЧИН ОТКАЗОВ ─────────────────────────────────────────────
    if top_fail:
        reason_text = '; '.join([f'«{r}» ({c}×)' for r, c in top_fail[:2]])
        recs.append({
            'id': 'fail_reasons',
            'priority': 'high' if failure_count > total * 0.5 else 'medium',
            'category': 'Узкие места',
            'icon': 'XCircle',
            'title': f'Топ причины потери клиентов',
            'problem': f'Повторяющиеся причины отказов: {reason_text}.',
            'action': 'Создайте карточку отработки для каждой из топ-3 причин отказа. '
                      'Проведите ролевые игры с операторами по этим сценариям.',
            'metric': f'{failure_count} отказов из {total}',
            'target': 'Снизить повторяющиеся отказы на 50%',
        })

    # ── 9. ФАКТОРЫ УСПЕХА ─────────────────────────────────────────────────
    if top_success and success_count > 0:
        factor_text = top_success[0][0] if top_success else ''
        recs.append({
            'id': 'success_scale',
            'priority': 'medium',
            'category': 'Масштабирование успеха',
            'icon': 'Trophy',
            'title': 'Масштабируйте то, что уже работает',
            'problem': f'Успешные звонки объединяет: «{factor_text[:80]}». '
                       f'Но только {success_count} из {total} достигают успеха.',
            'action': 'Запишите разбор 3 лучших звонков в формате видео-урока для команды. '
                      'Внедрите элементы успешных звонков в стандартный скрипт.',
            'metric': f'{success_count} успешных звонков',
            'target': 'Удвоить количество успехов',
        })

    # ── 10. КЛЮЧЕВЫЕ ФРАЗЫ КЛИЕНТОВ ──────────────────────────────────────
    if top_phrases and len(top_phrases) >= 3:
        phrases_text = ', '.join([f'«{p}»' for p, _ in top_phrases[:3]])
        recs.append({
            'id': 'client_phrases',
            'priority': 'low',
            'category': 'Инсайты',
            'icon': 'MessageSquare',
            'title': 'Клиенты сигнализируют о конкретных потребностях',
            'problem': f'Чаще всего клиенты говорят: {phrases_text}. '
                       f'Это прямые подсказки что их волнует.',
            'action': 'Адаптируйте рекламные офферы и скрипт под эти формулировки. '
                      'Используйте слова клиентов в заголовках сайта и объявлениях.',
            'metric': f'{len(phrases_client)} фраз проанализировано',
            'target': 'Повысить конверсию через язык клиента',
        })

    # Сортируем: high → medium → low
    priority_order = {'high': 0, 'medium': 1, 'low': 2}
    recs.sort(key=lambda x: priority_order[x['priority']])

    return {
        'statusCode': 200,
        'headers': {**CORS, 'Content-Type': 'application/json'},
        'body': json.dumps({
            'total':           total,
            'target_rate':     target_rate,
            'conversion_rate': conversion_rate,
            'avg_score':       avg_score,
            'script_rate':     script_rate,
            'objection_rate':  objection_rate,
            'recommendations': recs,
        }, ensure_ascii=False),
    }