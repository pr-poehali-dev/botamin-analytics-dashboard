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

    recs = []

    # ── 1. КОНВЕРСИЯ ──────────────────────────────────────────────────────
    if conversion_rate < 10:
        recs.append({
            'id': 'conversion_critical',
            'priority': 'high',
            'category': 'Конверсия',
            'icon': 'TrendingUp',
            'title': f'Конверсия критически низкая — {conversion_rate}%',
            'problem': f'Только {success_count} из {total} звонков завершились успехом. '
                       f'Это сигнал системной проблемы в скрипте или квалификации.',
            'action': 'Прослушайте 10 случайных звонков с исходом «Отказ» и найдите момент где клиент «ломается». '
                      'Скорее всего проблема в одном конкретном этапе разговора.',
            'metric': f'{conversion_rate}% конверсия',
            'target': 'Цель: 20–30%',
        })
    elif conversion_rate < 25:
        recs.append({
            'id': 'conversion_low',
            'priority': 'medium',
            'category': 'Конверсия',
            'icon': 'TrendingUp',
            'title': f'Конверсия ниже нормы — {conversion_rate}%',
            'problem': f'{failure_count} звонков завершились отказом. Есть конкретные точки потери.',
            'action': 'Сравните топ факторов успеха со звонками-отказами. '
                      'Внедрите успешные приёмы в скрипт для всех операторов.',
            'metric': f'{conversion_rate}% конверсия',
            'target': 'Цель: 25–35%',
        })

    # ── 2. ЦЕЛЕВЫЕ ЗВОНКИ ─────────────────────────────────────────────────
    if target_rate < 30:
        recs.append({
            'id': 'target_low',
            'priority': 'high',
            'category': 'Качество трафика',
            'icon': 'Target',
            'title': f'Только {target_rate}% звонков целевые',
            'problem': f'{total - target_count} из {total} звонков — нецелевые. '
                       f'Операторы тратят время на нерелевантные обращения.',
            'action': 'Проверьте настройки рекламных кампаний и посадочных страниц. '
                      'Добавьте фильтрующие вопросы в начало скрипта чтобы быстро определять нецелевых.',
            'metric': f'{target_rate}% целевых',
            'target': 'Цель: 50%+',
        })
    elif target_rate < 50:
        recs.append({
            'id': 'target_medium',
            'priority': 'medium',
            'category': 'Качество трафика',
            'icon': 'Target',
            'title': f'Треть звонков нецелевые ({100 - target_rate:.0f}%)',
            'problem': 'Часть рекламного бюджета привлекает нерелевантную аудиторию.',
            'action': 'Изучите из каких источников приходят нецелевые звонки. '
                      'Сузьте таргетинг или уточните офферы на сайте.',
            'metric': f'{target_rate}% целевых',
            'target': 'Цель: 60%+',
        })

    # ── 3. СКРИПТ ОПЕРАТОРА ───────────────────────────────────────────────
    if script_rate < 50:
        recs.append({
            'id': 'script_low',
            'priority': 'high',
            'category': 'Работа операторов',
            'icon': 'ClipboardList',
            'title': f'Скрипт соблюдают только {script_rate}% операторов',
            'problem': f'Больше половины звонков проходит без соблюдения скрипта. '
                       f'Это прямая потеря конверсии.',
            'action': 'Проведите групповой разбор 3–5 лучших звонков. '
                      'Сделайте скрипт доступным прямо в CRM и введите еженедельный контроль качества.',
            'metric': f'{script_rate}% соблюдение скрипта',
            'target': 'Цель: 80%+',
        })
    elif script_rate < 70:
        recs.append({
            'id': 'script_medium',
            'priority': 'medium',
            'category': 'Работа операторов',
            'icon': 'ClipboardList',
            'title': f'Скрипт соблюдается в {script_rate}% случаев',
            'problem': 'Часть операторов отступает от скрипта. Результаты нестабильны.',
            'action': 'Выясните какие этапы скрипта пропускаются чаще всего. '
                      'Возможно скрипт устарел и требует обновления под реальные возражения.',
            'metric': f'{script_rate}% соблюдение скрипта',
            'target': 'Цель: 85%+',
        })

    # ── 4. ОБРАБОТКА ВОЗРАЖЕНИЙ ───────────────────────────────────────────
    if objection_rate < 40:
        recs.append({
            'id': 'objections_low',
            'priority': 'high',
            'category': 'Работа операторов',
            'icon': 'ShieldCheck',
            'title': f'Возражения обрабатываются только в {objection_rate}% звонков',
            'problem': 'Операторы не работают с возражениями клиентов — это главная причина отказов.',
            'action': 'Составьте банк возражений из топ-причин отказов и создайте готовые ответы. '
                      'Проведите тренинг по технике «Выслушать → Согласиться → Аргумент → Вопрос».',
            'metric': f'{objection_rate}% обработка возражений',
            'target': 'Цель: 70%+',
        })

    # ── 5. ОЦЕНКА ОПЕРАТОРОВ ──────────────────────────────────────────────
    if avg_score < 5:
        recs.append({
            'id': 'score_critical',
            'priority': 'high',
            'category': 'Качество операторов',
            'icon': 'Star',
            'title': f'Средняя оценка операторов критически низкая — {avg_score}/10',
            'problem': f'{low_score_count} звонков получили оценку 1–4. '
                       f'Системная проблема с качеством обслуживания.',
            'action': f'Немедленно прослушайте {min(low_score_count, 5)} худших звонков. '
                      f'Определите общий паттерн ошибок и проведите корректирующее обучение.',
            'metric': f'{avg_score}/10 средняя оценка',
            'target': 'Цель: 7+/10',
        })
    elif avg_score < 7:
        recs.append({
            'id': 'score_low',
            'priority': 'medium',
            'category': 'Качество операторов',
            'icon': 'Star',
            'title': f'Оценка операторов {avg_score}/10 — есть куда расти',
            'problem': f'Средний уровень обслуживания. {low_score_count} звонков с оценкой ниже 5.',
            'action': f'Изучите {high_score_count} лучших звонков и выявите что делают операторы с оценкой 8+. '
                      f'Масштабируйте эти приёмы на всю команду.',
            'metric': f'{avg_score}/10 средняя оценка',
            'target': 'Цель: 8+/10',
        })

    # ── 6. ИНТЕРЕС КЛИЕНТОВ ───────────────────────────────────────────────
    if low_interest_pct > 60:
        recs.append({
            'id': 'interest_low',
            'priority': 'high',
            'category': 'Вовлечённость клиентов',
            'icon': 'UserX',
            'title': f'{low_interest_pct}% клиентов с низким интересом',
            'problem': 'Большинство клиентов не вовлечены. Операторы не умеют «зажигать» интерес.',
            'action': 'Измените начало разговора — добавьте цепляющий оффер в первые 15 секунд. '
                      'Протестируйте разные варианты открытия звонка.',
            'metric': f'{low_interest_pct}% низкий интерес',
            'target': 'Цель: снизить до 30%',
        })
    elif high_interest_pct < 20:
        recs.append({
            'id': 'interest_high_low',
            'priority': 'medium',
            'category': 'Вовлечённость клиентов',
            'icon': 'Flame',
            'title': f'Мало клиентов с высоким интересом — {high_interest_pct}%',
            'problem': 'Операторы не выявляют и не усиливают потребность клиента.',
            'action': 'Добавьте в скрипт блок «выявление боли» с открытыми вопросами. '
                      'Например: «Что сейчас мешает вашему росту?»',
            'metric': f'{high_interest_pct}% высокий интерес',
            'target': 'Цель: 35%+',
        })

    # ── 7. КВАЛИФИКАЦИЯ ───────────────────────────────────────────────────
    if qualification_rate < 30 and target_rate > 40:
        recs.append({
            'id': 'qualification_low',
            'priority': 'medium',
            'category': 'Квалификация',
            'icon': 'UserCheck',
            'title': f'Квалифицируется только {qualification_rate}% клиентов',
            'problem': 'Операторы не выясняют бюджет, сроки и полномочия клиента. '
                       'Тратят время на неперспективных.',
            'action': 'Внедрите BANT-квалификацию: Бюджет, Авторитет, Потребность, Сроки. '
                      'Добавьте 2–3 квалифицирующих вопроса в скрипт.',
            'metric': f'{qualification_rate}% квалификация',
            'target': 'Цель: 50%+',
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
