import { useState, useEffect, useCallback } from 'react';
import { loadData, type DashboardData } from '@/lib/dataParser';
import KpiCard from '@/components/dashboard/KpiCard';
import FunnelChart from '@/components/dashboard/FunnelChart';
import TimeHeatmap from '@/components/dashboard/TimeHeatmap';
import PhrasesPanel from '@/components/dashboard/PhrasesPanel';
import IndustryTable from '@/components/dashboard/IndustryTable';
import AbTestCard from '@/components/dashboard/AbTestCard';
import DurationChart from '@/components/dashboard/DurationChart';
import DialoguesTable from '@/components/dashboard/DialoguesTable';
import Icon from '@/components/ui/icon';

type Tab = 'overview' | 'funnel' | 'time' | 'dialogues' | 'abtest';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Обзор', icon: 'LayoutDashboard' },
  { id: 'funnel', label: 'Воронка', icon: 'Filter' },
  { id: 'time', label: 'Время', icon: 'Clock' },
  { id: 'dialogues', label: 'Диалоги', icon: 'MessageSquare' },
  { id: 'abtest', label: 'A/B тест', icon: 'FlaskConical' },
];

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m > 0) return `${m}м ${s}с`;
  return `${s}с`;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6" style={{ background: 'var(--bg-primary)' }}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand-green)' }}>
          <span className="text-black font-bold text-sm">B</span>
        </div>
        <span className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Botamin Analytics</span>
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full animate-pulse-green"
              style={{ background: 'var(--brand-green)', animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Загружаю 11 486 диалогов…</p>
      </div>
    </div>
  );
}

function ErrorScreen({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,68,68,0.15)' }}>
        <Icon name="AlertTriangle" size={24} style={{ color: '#ff4444' }} />
      </div>
      <div className="text-center">
        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Ошибка загрузки данных</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{error}</p>
      </div>
      <button
        onClick={onRetry}
        className="px-4 py-2 rounded-lg text-sm font-medium"
        style={{ background: 'var(--brand-green)', color: '#000' }}
      >
        Попробовать снова
      </button>
    </div>
  );
}

export default function Index() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadData();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingScreen />;
  if (error || !data) return <ErrorScreen error={error ?? 'Нет данных'} onRetry={load} />;

  const silentPct = data.total > 0 ? ((data.total - data.withDialogue) / data.total * 100) : 0;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{ background: 'rgba(10,10,10,0.95)', borderColor: 'var(--border-default)', backdropFilter: 'blur(12px)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-sm"
                style={{ background: 'var(--brand-green)', color: '#000' }}
              >
                B
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Botamin</span>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/</span>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Analytics</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                style={{ background: 'var(--brand-green-muted)', border: '1px solid rgba(0,255,136,0.2)', color: 'var(--brand-green)' }}
              >
                <div className="w-1.5 h-1.5 rounded-full animate-pulse-green" style={{ background: 'var(--brand-green)' }} />
                {data.total.toLocaleString('ru-RU')} звонков
              </div>
              <button
                onClick={load}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
                title="Обновить"
              >
                <Icon name="RefreshCw" size={14} />
              </button>
            </div>
          </div>

          {/* Nav tabs */}
          <div className="flex gap-0.5 pb-0 -mb-px overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-all"
                style={{
                  borderColor: tab === t.id ? 'var(--brand-green)' : 'transparent',
                  color: tab === t.id ? 'var(--brand-green)' : 'var(--text-muted)',
                }}
              >
                <Icon name={t.icon} size={13} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Сводка за неделю</h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Анализ {data.total.toLocaleString('ru-RU')} звонков · Конверсия в лид: <span style={{ color: 'var(--brand-green)' }}>{data.overallCR.toFixed(2)}%</span>
              </p>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard label="Всего звонков" value={data.total.toLocaleString('ru-RU')} sub="за неделю" delay={0} />
              <KpiCard
                label="Вступили в диалог"
                value={`${(100 - silentPct).toFixed(1)}%`}
                sub={`${data.withDialogue.toLocaleString('ru-RU')} звонков`}
                delay={80}
              />
              <KpiCard
                label="Лидов (встреча+)"
                value={data.leads.toLocaleString('ru-RU')}
                sub={`CR = ${data.overallCR.toFixed(2)}%`}
                accent
                delay={160}
              />
              <KpiCard
                label="Средняя длительность"
                value={formatSec(data.avgDurationSec)}
                sub="на звонок"
                delay={240}
              />
            </div>

            {/* Funnel + Duration */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <FunnelChart data={data.funnel} total={data.total} />
              </div>
              <DurationChart buckets={data.durationBuckets} endReasons={data.endReasonBreakdown} />
            </div>

            {/* AB alert */}
            <div
              className="flex items-start gap-3 p-4 rounded-xl"
              style={{ background: 'rgba(255,140,0,0.08)', border: '1px solid rgba(255,140,0,0.2)' }}
            >
              <div className="text-lg shrink-0">🔥</div>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#ff8c00' }}>Узкое место обнаружено</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {data.funnel[1]?.dropPct
                    ? `${data.funnel[1].dropPct.toFixed(0)}% клиентов уходят на этапе приветствия — до того, как услышат оффер. `
                    : ''}
                  Перейдите во вкладку <span style={{ color: '#ff8c00', fontWeight: 600 }}>A/B тест</span> чтобы увидеть рекомендацию.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* FUNNEL TAB */}
        {tab === 'funnel' && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Воронка диалога</h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Где и сколько клиентов теряется на каждом шаге
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <FunnelChart data={data.funnel} total={data.total} />

              <div className="space-y-3">
                {data.funnel.map((item, idx) => (
                  <div
                    key={idx}
                    className="card-glass p-4 animate-fade-in"
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold" style={{ color: item.color }}>
                        Этап {idx} — {item.label}
                      </span>
                      <span className="text-xl font-bold font-mono-data" style={{ color: item.color }}>
                        {item.count.toLocaleString('ru-RU')}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span>Доля от всех: <span style={{ color: 'var(--text-secondary)' }}>{item.pct.toFixed(1)}%</span></span>
                      {idx > 0 && <span>Потери: <span style={{ color: '#ff4444' }}>−{item.dropPct.toFixed(1)}%</span></span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <PhrasesPanel refusalPhrases={data.refusalPhrases} successPhrases={data.successPhrases} />
          </div>
        )}

        {/* TIME TAB */}
        {tab === 'time' && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Время и охват</h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Когда звонить эффективнее всего
              </p>
            </div>

            <TimeHeatmap hourly={data.hourly} byDay={data.byDay} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DurationChart buckets={data.durationBuckets} endReasons={data.endReasonBreakdown} />
              <IndustryTable data={data.byIndustry} />
            </div>

            <div
              className="p-4 rounded-xl"
              style={{ background: 'rgba(0,170,255,0.06)', border: '1px solid rgba(0,170,255,0.15)' }}
            >
              <p className="text-xs font-semibold mb-1" style={{ color: '#00aaff' }}>💡 Инсайт по времени</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                B2B исследования показывают: лучший дозвон в 10:00–11:00 и 14:00–15:00 во вт–чт. Смена расписания —
                самый быстрый тест без изменений скрипта. Ожидаемый прирост CR0: +10–20%.
              </p>
            </div>
          </div>
        )}

        {/* DIALOGUES TAB */}
        {tab === 'dialogues' && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Браузер диалогов</h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Фильтруй по этапам, читай транскрипты, ищи паттерны
              </p>
            </div>
            <PhrasesPanel refusalPhrases={data.refusalPhrases} successPhrases={data.successPhrases} />
            <DialoguesTable records={data.records} />
          </div>
        )}

        {/* AB TEST TAB */}
        {tab === 'abtest' && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>A/B тесты</h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Автоматически найденные точки роста и рекомендации
              </p>
            </div>

            <AbTestCard data={data} />

            <div className="card-glass p-5">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Методология метрик
              </h3>
              <div className="space-y-3">
                {[
                  { name: 'CR0 — Охват', desc: 'Доля звонков с хотя бы одной репликой клиента. Зависит от базы, времени звонка, номера.' },
                  { name: 'CR1 — Согласие', desc: 'Доля клиентов, давших согласие слушать после первой фразы бота. Чувствителен к первому предложению.' },
                  { name: 'CR2 — Интерес', desc: 'Доля клиентов, дождавшихся оффера. Показывает качество зацепки.' },
                  { name: 'CR3 — Встреча', desc: 'Доля клиентов, согласившихся на встречу. Главная конверсия воронки.' },
                  { name: 'CR4 — Лид', desc: 'Квалифицированный лид — клиент прошёл все этапы и готов к передаче в CRM.' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <span
                      className="text-xs font-semibold shrink-0 w-28"
                      style={{ color: 'var(--brand-green)' }}
                    >
                      {item.name}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-glass p-5">
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                Что увидели в данных
              </h3>
              <div className="space-y-2.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                <p>
                  <span className="font-semibold" style={{ color: 'var(--brand-green)' }}>1. Молчаливые звонки (~46%).</span>{' '}
                  Почти половина базы сбрасывает до первого слова. Это сигнал не по скрипту, а по базе:
                  номера нерелевантны, недозвон, автоответчики. Нужна чистка базы и оптимизация расписания.
                </p>
                <p>
                  <span className="font-semibold" style={{ color: '#ff8c00' }}>2. Главный слив — Этап 1.</span>{' '}
                  Из тех, кто поднял трубку, большинство уходят сразу после приветствия.
                  Причина: первая фраза длинная, монолог, слово «ИИ» триггерит защитную реакцию.
                </p>
                <p>
                  <span className="font-semibold" style={{ color: '#00aaff' }}>3. Уточняющий вопрос = горячий сигнал.</span>{' '}
                  Клиенты, задающие вопрос («А это бесплатно?», «Расскажи подробнее», «Откуда узнали?»),
                  конвертируются в лид значительно выше среднего. Это «тёплые» лиды — их стоит выделять.
                </p>
                <p>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>4. Отраслевая релевантность.</span>{' '}
                  Бот упоминает конкретную отрасль в первой фразе. Когда поле пустое («кейс по ,»),
                  доверие падает — это баг, который нужно закрыть немедленно.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
