import type { DashboardData } from '@/lib/dataParser';

interface Props {
  data: DashboardData;
}

export default function AbTestCard({ data }: Props) {
  const greetingDropPct = data.funnel[1]?.dropPct ?? 0;
  const silentPct = data.total > 0 ? ((data.total - data.withDialogue) / data.total * 100) : 0;

  // Выбираем узкое место по максимальным потерям в воронке
  // funnel[2].dropPct = потери "Вступили в диалог → Клиент ответил" (этап 1→2)
  // funnel[3].dropPct = потери "Клиент ответил → Встреча" (этап 2→3)
  const responseDropPct = data.funnel[2]?.dropPct ?? 0;
  const meetingDropPct  = data.funnel[3]?.dropPct ?? 0;

  const bottleneck = responseDropPct > meetingDropPct && responseDropPct > greetingDropPct
    ? 'offer'        // Клиент ответил, но не дошёл до встречи — слабый оффер
    : meetingDropPct > greetingDropPct
    ? 'offer'        // Главные потери на переходе к встрече
    : greetingDropPct > 30
    ? 'greeting'     // Много уходят на приветствии
    : silentPct > 40
    ? 'silent'       // Много сбросов до слова
    : 'offer';

  const hypotheses = {
    greeting: {
      title: 'Сменить первую фразу',
      problem: `${greetingDropPct.toFixed(0)}% клиентов уходят сразу после приветствия — скрипт распознаётся как спам`,
      variantA: 'Текущий: «[Имя], добрый день! Звоню насчёт ИИ в вашем отделе продаж — у нас есть кейс по [Отрасль], хотела показать. 30 секунд займёт, ладно?»',
      variantB: 'Тест: «[Имя], добрый день! Вы отвечаете за продажи в компании?» → пауза → «Отлично, у меня есть конкретный кейс для вашей сферы — одна минута?»',
      metric: 'CR1 — % клиентов, давших согласие продолжить',
      volume: '2 × 500 звонков',
      hypothesis: 'Разговорный вопрос вместо монолога снизит рефлекторный отказ на 15–25%',
    },
    silent: {
      title: 'Оптимизировать время звонка',
      problem: `${silentPct.toFixed(0)}% звонков без диалога — клиент сбрасывает до первого слова`,
      variantA: 'Текущее: звонки в рабочее время без ротации',
      variantB: 'Тест: звонки в 10:00–11:00 и 15:00–16:00 (пики доступности B2B по исследованиям)',
      metric: 'CR0 — % звонков с хотя бы одной репликой клиента',
      volume: '2 × 500 звонков',
      hypothesis: 'Смена времени звонка поднимет дозвон на 10–20% без изменений скрипта',
    },
    offer: {
      title: 'Усилить оффер',
      problem: 'Клиент слышит оффер, но не доходит до этапа встречи',
      variantA: 'Текущий: абстрактные проценты («выросла конверсия на 22%»)',
      variantB: 'Тест: конкретная денежная выгода («сэкономили 1.2 млн рублей за квартал на обработке заявок»)',
      metric: 'CR2→CR3 — % перехода от оффера к согласию на встречу',
      volume: '2 × 300 звонков',
      hypothesis: 'Конкретные деньги убедительнее абстрактных процентов',
    },
  };

  const h = hypotheses[bottleneck];

  return (
    <div className="card-glass p-6" style={{ border: '1px solid rgba(0,255,136,0.2)' }}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full animate-pulse-green" style={{ background: 'var(--brand-green)' }} />
            <span className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--brand-green)' }}>
              Рекомендация аналитика
            </span>
          </div>
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            A/B-тест #{'\u00A0'}1 — {h.title}
          </h2>
        </div>
        <div className="text-right">
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Приоритет</div>
          <div className="text-sm font-bold" style={{ color: '#ff8c00' }}>🔥 Высокий</div>
        </div>
      </div>

      <div className="p-3 rounded-lg mb-4" style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.15)' }}>
        <span className="text-xs font-semibold" style={{ color: '#ff6666' }}>Проблема: </span>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{h.problem}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
          <div className="text-xs font-semibold mb-2" style={{ color: '#888' }}>Вариант A (текущий)</div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{h.variantA}</p>
        </div>
        <div className="p-3 rounded-lg" style={{ background: 'var(--brand-green-muted)', border: '1px solid rgba(0,255,136,0.2)' }}>
          <div className="text-xs font-semibold mb-2" style={{ color: 'var(--brand-green)' }}>Вариант B (гипотеза)</div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{h.variantB}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg-elevated)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Метрика успеха</div>
          <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{h.metric}</div>
        </div>
        <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg-elevated)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Объём теста</div>
          <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{h.volume}</div>
        </div>
        <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg-elevated)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Ожидаемый эффект</div>
          <div className="text-xs font-semibold" style={{ color: 'var(--brand-green)' }}>+15–25%</div>
        </div>
      </div>

      <div className="mt-4 p-3 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>💡 Гипотеза: </span>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{h.hypothesis}</span>
      </div>
    </div>
  );
}