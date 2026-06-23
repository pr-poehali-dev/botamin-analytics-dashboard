import { useState, useEffect } from 'react';
import { formatSec, formatTotalHours, type CallsData } from '@/lib/dataParser';
import Icon from '@/components/ui/icon';
import RecommendationsChat from '@/components/calls/RecommendationsChat';

const AI_REC_URL = 'https://functions.poehali.dev/d671000f-9e45-471d-870d-789e1dd542c6?action=recs';

const priorityColor = { high: '#ff4444', medium: '#ff8c00', low: 'var(--brand-green)' };
const priorityLabel = { high: 'Срочно', medium: 'Важно', low: 'Совет' };
const priorityBg    = { high: 'rgba(255,68,68,0.08)', medium: 'rgba(255,140,0,0.08)', low: 'rgba(0,255,136,0.08)' };
const priorityBorder = { high: 'rgba(255,68,68,0.2)', medium: 'rgba(255,140,0,0.2)', low: 'rgba(0,255,136,0.2)' };

interface AiRec {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  icon: string;
  title: string;
  problem: string;
  action: string;
  metric: string;
  target: string;
}

interface AiRecsData {
  total: number;
  target_rate: number;
  conversion_rate: number;
  avg_score: number;
  script_rate: number;
  objection_rate: number;
  recommendations: AiRec[];
}

export default function RecommendationsBlock({ data }: { data: CallsData }) {
  const [aiRecs, setAiRecs]   = useState<AiRecsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<'all' | 'high' | 'medium' | 'low'>('all');

  useEffect(() => {
    fetch(AI_REC_URL)
      .then(r => r.json())
      .then(d => setAiRecs(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const recs = aiRecs?.recommendations || [];
  const filtered = filter === 'all' ? recs : recs.filter(r => r.priority === filter);

  const highCount   = recs.filter(r => r.priority === 'high').length;
  const mediumCount = recs.filter(r => r.priority === 'medium').length;
  const lowCount    = recs.filter(r => r.priority === 'low').length;

  return (
    <div className="space-y-6">

      {/* Заголовок */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>
            Рекомендации для роста конверсии
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            На основе ИИ-анализа {aiRecs?.total ?? data.total.toLocaleString('ru-RU')} звонков
          </p>
        </div>
        <button
          onClick={() => { setAiRecs(null); setLoading(true); fetch(AI_REC_URL).then(r => r.json()).then(d => setAiRecs(d)).catch(() => {}).finally(() => setLoading(false)); }}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs shrink-0 transition-all hover:opacity-80 disabled:opacity-40"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
          <Icon name="RefreshCw" size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Обновить
        </button>
      </div>

      {/* KPI-сводка из ИИ */}
      {aiRecs && aiRecs.total > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {[
            {
              icon: 'TrendingUp',
              label: 'Конверсия в продажу',
              hint: 'Доля звонков где договорились о сделке',
              value: `${aiRecs.conversion_rate}%`,
              color: aiRecs.conversion_rate >= 20 ? 'var(--brand-green)' : '#ff4444',
            },
            {
              icon: 'Target',
              label: 'Целевые звонки',
              hint: 'Звонки от реальных потенциальных клиентов',
              value: `${aiRecs.target_rate}%`,
              color: aiRecs.target_rate >= 50 ? 'var(--brand-green)' : '#ff8c00',
            },
            {
              icon: 'Star',
              label: 'Качество разговора',
              hint: 'Средняя оценка работы оператора по 10-балльной шкале',
              value: `${aiRecs.avg_score}/10`,
              color: aiRecs.avg_score >= 7 ? 'var(--brand-green)' : aiRecs.avg_score >= 5 ? '#ff8c00' : '#ff4444',
            },
            {
              icon: 'ClipboardList',
              label: 'Соблюдение скрипта',
              hint: 'Как часто оператор следовал утверждённому сценарию продаж',
              value: `${aiRecs.script_rate}%`,
              color: aiRecs.script_rate >= 70 ? 'var(--brand-green)' : '#ff8c00',
            },
            {
              icon: 'ShieldCheck',
              label: 'Отработка возражений',
              hint: 'Как часто оператор успешно отвечал на отказы и сомнения клиента',
              value: `${aiRecs.objection_rate}%`,
              color: aiRecs.objection_rate >= 60 ? 'var(--brand-green)' : '#ff4444',
            },
          ].map((kpi, i) => (
            <div key={i} className="rounded-xl px-4 py-3"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Icon name={kpi.icon} size={13} style={{ color: kpi.color, flexShrink: 0 }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{kpi.label}</span>
              </div>
              <div className="text-2xl font-black font-mono mb-1" style={{ color: kpi.color }}>{kpi.value}</div>
              <div className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{kpi.hint}</div>
            </div>
          ))}
        </div>
      )}

      {/* Фильтры */}
      {recs.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {([['all', 'Все', recs.length], ['high', 'Срочно', highCount], ['medium', 'Важно', mediumCount], ['low', 'Советы', lowCount]] as const).map(([val, label, count]) => (
            count > 0 || val === 'all' ? (
              <button key={val} onClick={() => setFilter(val)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: filter === val
                    ? val === 'all' ? 'var(--brand-green)' : val === 'high' ? '#ff4444' : val === 'medium' ? '#ff8c00' : 'var(--brand-green)'
                    : 'var(--bg-elevated)',
                  color: filter === val ? '#000' : 'var(--text-secondary)',
                  border: '1px solid var(--border-default)',
                }}>
                {label}
                <span className="px-1.5 rounded-full text-xs"
                  style={{ background: 'rgba(0,0,0,0.2)', color: 'inherit' }}>
                  {count}
                </span>
              </button>
            ) : null
          ))}
        </div>
      )}

      {/* Загрузка */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="flex gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className="w-2.5 h-2.5 rounded-full animate-pulse"
                style={{ background: 'var(--brand-green)', animationDelay: `${i*0.2}s` }} />
            ))}
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Анализирую данные…</p>
        </div>
      )}

      {/* Нет ИИ-данных — базовые рекомендации */}
      {!loading && recs.length === 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-4 rounded-xl"
            style={{ background: 'rgba(255,140,0,0.08)', border: '1px solid rgba(255,140,0,0.2)' }}>
            <Icon name="Info" size={16} style={{ color: '#ff8c00' }} />
            <p className="text-sm" style={{ color: '#ff8c00' }}>
              Сначала проанализируйте звонки через ИИ во вкладке «Транскрибация» — тогда рекомендации станут персональными.
            </p>
          </div>
          {data.recommendations.map((r, i) => (
            <div key={i} className="rounded-2xl p-5"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: 'rgba(0,255,136,0.12)' }}>
                  <Icon name="Lightbulb" size={16} style={{ color: 'var(--brand-green)' }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{r.title}</p>
                  <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{r.desc}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.action}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ИИ-рекомендации */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map((rec, i) => (
            <div key={rec.id}
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--bg-card)', border: `1px solid ${priorityBorder[rec.priority]}` }}>

              {/* Шапка карточки */}
              <div className="flex items-start gap-4 p-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: priorityBg[rec.priority] }}>
                  <Icon name={rec.icon} size={18} style={{ color: priorityColor[rec.priority] }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: priorityBg[rec.priority], color: priorityColor[rec.priority] }}>
                      {priorityLabel[rec.priority]}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{rec.category}</span>
                  </div>
                  <p className="text-sm font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>
                    {rec.title}
                  </p>
                </div>
                <span className="text-xs font-black font-mono shrink-0"
                  style={{ color: 'var(--text-muted)', opacity: 0.4 }}>
                  #{i + 1}
                </span>
              </div>

              {/* Проблема */}
              <div className="px-5 pb-3">
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {rec.problem}
                </p>
              </div>

              {/* Действие */}
              <div className="mx-5 mb-4 p-4 rounded-xl"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: priorityBg[rec.priority] }}>
                    <Icon name="ArrowRight" size={11} style={{ color: priorityColor[rec.priority] }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>ЧТО ДЕЛАТЬ</p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                      {rec.action}
                    </p>
                  </div>
                </div>
              </div>

              {/* Метрика + цель */}
              <div className="flex items-center justify-between px-5 py-3"
                style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-1.5">
                  <Icon name="BarChart2" size={12} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Сейчас: </span>
                  <span className="text-xs font-semibold" style={{ color: priorityColor[rec.priority] }}>
                    {rec.metric}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Icon name="Target" size={12} style={{ color: 'var(--brand-green)' }} />
                  <span className="text-xs" style={{ color: 'var(--brand-green)' }}>{rec.target}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Чат с советником */}
      {!loading && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Icon name="Bot" size={14} style={{ color: '#ff8c00' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Обсудить с советником
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,140,0,0.12)', color: '#ff8c00' }}>
              объективный ИИ
            </span>
          </div>
          <RecommendationsChat recommendations={recs} />
        </div>
      )}

      {/* Контекст данных */}
      <div className="rounded-2xl p-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="BarChart2" size={14} style={{ color: 'var(--brand-green)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            На чём основаны рекомендации
          </span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { label: 'Всего звонков загружено', val: `${data.total.toLocaleString('ru-RU')} звонков` },
            { label: 'Проанализировано ИИ', val: aiRecs ? `${aiRecs.total} звонков` : '—' },
            { label: 'Средняя длительность', val: formatSec(data.avg_duration_sec) },
            { label: 'Суммарное время разговоров', val: formatTotalHours(data.total_talk_sec) },
          ].map((row, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg"
              style={{ background: 'var(--bg-elevated)' }}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.label}</span>
              <span className="text-xs font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>{row.val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}