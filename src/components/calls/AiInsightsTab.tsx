import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';

const AI_STATS_URL = 'https://functions.poehali.dev/db240be1-ed61-46d9-bcbf-59bbc6130fea';

interface AiStats {
  total: number;
  empty: boolean;
  target_count: number;
  target_rate: number;
  qualified_count: number;
  qualification_rate: number;
  success_count: number;
  conversion_rate: number;
  avg_operator_score: number;
  script_rate: number;
  objection_rate: number;
  call_types: Record<string, number>;
  interests: Record<string, number>;
  outcomes: Record<string, number>;
  score_distribution: { score: number; count: number }[];
  top_fail_reasons: { reason: string; count: number }[];
  top_success_factors: { factor: string; count: number }[];
  top_phrases_client: { phrase: string; count: number }[];
  top_phrases_operator: { phrase: string; count: number }[];
  by_date: { date: string; count: number }[];
}

interface TipProps { active?: boolean; payload?: { name: string; value: number }[]; label?: string }
const BarTip = ({ active, payload, label }: TipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-lg text-xs border"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
      <div className="font-semibold mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: 'var(--brand-green)' }}>{p.name}: {p.value}</div>
      ))}
    </div>
  );
};

function StatCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon name={icon} size={14} style={{ color: color || 'var(--text-muted)' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div className="text-2xl font-black font-mono" style={{ color: color || 'var(--text-primary)' }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

function ScoreBar({ score, count, max }: { score: number; count: number; max: number }) {
  const color = score >= 8 ? 'var(--brand-green)' : score >= 6 ? '#ff8c00' : '#ff4444';
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-mono w-4 text-right" style={{ color: 'var(--text-muted)' }}>{score}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${max > 0 ? (count / max) * 100 : 0}%`, background: color }} />
      </div>
      <span className="text-xs font-mono w-8 text-right" style={{ color: 'var(--text-primary)' }}>{count}</span>
    </div>
  );
}

export default function AiInsightsTab() {
  const [stats, setStats] = useState<AiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(AI_STATS_URL);
      const data = await res.json();
      setStats(data);
    } catch {
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ background: 'var(--brand-green)', animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Загружаю аналитику…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Icon name="AlertTriangle" size={32} style={{ color: '#ff4444' }} />
        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{error}</p>
        <button onClick={load} className="px-4 py-2 rounded-lg text-xs"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
          Повторить
        </button>
      </div>
    );
  }

  if (!stats || stats.empty || stats.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--brand-green-muted)' }}>
          <Icon name="Sparkles" size={28} style={{ color: 'var(--brand-green)' }} />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            Пока нет проанализированных звонков
          </p>
          <p className="text-xs max-w-sm" style={{ color: 'var(--text-muted)' }}>
            Перейдите во вкладку «Транскрибация», выберите звонок, дождитесь транскрипта
            и нажмите «Анализировать через ИИ». После этого данные появятся здесь.
          </p>
        </div>
      </div>
    );
  }

  const scoreMax = Math.max(...stats.score_distribution.map(s => s.count), 1);
  const maxFail = Math.max(...stats.top_fail_reasons.map(f => f.count), 1);

  const pieData = [
    { name: 'Целевые', value: stats.call_types['target'] || 0, fill: 'var(--brand-green)' },
    { name: 'Нецелевые', value: stats.call_types['non_target'] || 0, fill: '#334155' },
  ];

  const outcomePie = [
    { name: 'Успех', value: stats.outcomes['success'] || 0, fill: 'var(--brand-green)' },
    { name: 'Отказ', value: stats.outcomes['failure'] || 0, fill: '#ff4444' },
    { name: 'В работе', value: stats.outcomes['pending'] || 0, fill: '#ff8c00' },
  ];

  const interestColors: Record<string, string> = { high: 'var(--brand-green)', medium: '#ff8c00', low: '#ff4444' };
  const interestLabels: Record<string, string> = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            Аналитика ИИ
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            На основе {stats.total} проанализированных звонков
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
          <Icon name="RefreshCw" size={12} />
          Обновить
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon="Target" label="Целевых звонков" value={`${stats.target_rate}%`}
          sub={`${stats.target_count} из ${stats.total}`} color="var(--brand-green)" />
        <StatCard icon="UserCheck" label="Квалифицировано" value={`${stats.qualification_rate}%`}
          sub={`${stats.qualified_count} клиентов`} color="#00aaff" />
        <StatCard icon="TrendingUp" label="Конверсия в успех" value={`${stats.conversion_rate}%`}
          sub={`${stats.success_count} успешных`}
          color={stats.conversion_rate >= 20 ? 'var(--brand-green)' : stats.conversion_rate >= 10 ? '#ff8c00' : '#ff4444'} />
        <StatCard icon="Star" label="Ср. оценка оператора" value={`${stats.avg_operator_score}/10`}
          sub={`скрипт: ${stats.script_rate}%`}
          color={stats.avg_operator_score >= 8 ? 'var(--brand-green)' : stats.avg_operator_score >= 6 ? '#ff8c00' : '#ff4444'} />
      </div>

      {/* Диаграммы */}
      <div className="grid sm:grid-cols-3 gap-4">

        {/* Типы звонков */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <h3 className="text-xs font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Типы звонков
          </h3>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55}
                dataKey="value" paddingAngle={3}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [v, '']} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Итоги звонков */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <h3 className="text-xs font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Итоги звонков
          </h3>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={outcomePie} cx="50%" cy="50%" innerRadius={35} outerRadius={55}
                dataKey="value" paddingAngle={3}>
                {outcomePie.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [v, '']} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Интерес клиентов */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <h3 className="text-xs font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Интерес клиентов
          </h3>
          <div className="space-y-3 mt-2">
            {['high', 'medium', 'low'].map(key => {
              const count = stats.interests[key] || 0;
              const pct = stats.total > 0 ? Math.round(count / stats.total * 100) : 0;
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: interestColors[key] }}>{interestLabels[key]}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'var(--bg-elevated)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: interestColors[key] }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex justify-between text-xs">
              <span style={{ color: 'var(--text-muted)' }}>Обработка возражений</span>
              <span style={{ color: stats.objection_rate >= 70 ? 'var(--brand-green)' : '#ff8c00' }}>
                {stats.objection_rate}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Динамика по датам */}
      {stats.by_date.length > 1 && (
        <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Динамика анализов по датам
          </h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={stats.by_date} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<BarTip />} cursor={false} />
              <Bar dataKey="count" name="Анализов" radius={[3, 3, 0, 0]} fill="rgba(0,255,136,0.6)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Топ причин отказов */}
      {stats.top_fail_reasons.length > 0 && (
        <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(255,68,68,0.12)' }}>
              <Icon name="XCircle" size={14} style={{ color: '#ff4444' }} />
            </div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Топ причин отказов
            </h3>
          </div>
          <div className="space-y-3">
            {stats.top_fail_reasons.map((f, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-xs font-black font-mono w-5 shrink-0 mt-0.5"
                  style={{ color: '#ff4444' }}>#{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                      <div className="h-full rounded-full" style={{ width: `${(f.count / maxFail) * 100}%`, background: '#ff4444' }} />
                    </div>
                    <span className="text-xs font-mono shrink-0" style={{ color: '#ff6666' }}>{f.count}×</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Топ факторов успеха */}
      {stats.top_success_factors.length > 0 && (
        <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(0,255,136,0.12)' }}>
              <Icon name="CheckCircle" size={14} style={{ color: 'var(--brand-green)' }} />
            </div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Что приводит к успеху
            </h3>
          </div>
          <div className="space-y-2">
            {stats.top_success_factors.map((f, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(0,255,136,0.05)' }}>
                <Icon name="Sparkles" size={13} style={{ color: 'var(--brand-green)', marginTop: 1, flexShrink: 0 }} />
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.factor}</p>
                {f.count > 1 && (
                  <span className="text-xs font-mono shrink-0" style={{ color: 'var(--brand-green)' }}>{f.count}×</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Два блока: фразы + оценки */}
      <div className="grid sm:grid-cols-2 gap-4">

        {/* Оценки операторов */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Icon name="Star" size={14} style={{ color: '#ff8c00' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Распределение оценок операторов
            </h3>
          </div>
          <div className="space-y-2">
            {stats.score_distribution.filter(s => s.count > 0).reverse().map(s => (
              <ScoreBar key={s.score} score={s.score} count={s.count} max={scoreMax} />
            ))}
          </div>
          <div className="mt-4 pt-3 border-t flex justify-between text-xs"
            style={{ borderColor: 'var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Средняя оценка</span>
            <span className="font-bold font-mono"
              style={{ color: stats.avg_operator_score >= 8 ? 'var(--brand-green)' : '#ff8c00' }}>
              {stats.avg_operator_score}/10
            </span>
          </div>
        </div>

        {/* Топ фраз клиентов */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Icon name="MessageSquare" size={14} style={{ color: '#00aaff' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Топ фраз клиентов
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.top_phrases_client.map((p, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(0,170,255,0.1)', color: '#00aaff' }}>
                «{p.phrase}»
                {p.count > 1 && <span className="ml-1 opacity-60">{p.count}×</span>}
              </span>
            ))}
          </div>
          {stats.top_phrases_operator.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-4 mb-3">
                <Icon name="Headphones" size={14} style={{ color: 'var(--brand-green)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Топ фраз операторов
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {stats.top_phrases_operator.map((p, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--brand-green)' }}>
                    «{p.phrase}»
                    {p.count > 1 && <span className="ml-1 opacity-60">{p.count}×</span>}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
