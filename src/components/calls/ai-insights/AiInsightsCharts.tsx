import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import { type AiStats, type TipProps } from './aiInsightsTypes';
import { type CallRecord } from '@/lib/dataParser';
import PeriodAnalysis from './PeriodAnalysis';

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

const interestColors: Record<string, string> = { high: 'var(--brand-green)', medium: '#ff8c00', low: '#ff4444' };
const interestLabels: Record<string, string> = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };

export default function AiInsightsCharts({ stats, calls }: { stats: AiStats; calls: CallRecord[] }) {
  const pieData = [
    { name: 'Целевые', value: stats.call_types['target'] || 0, fill: 'var(--brand-green)' },
    { name: 'Нецелевые', value: stats.call_types['non_target'] || 0, fill: '#334155' },
  ];

  const outcomePie = [
    { name: 'Успех', value: stats.outcomes['success'] || 0, fill: 'var(--brand-green)' },
    { name: 'Отказ', value: stats.outcomes['failure'] || 0, fill: '#ff4444' },
    { name: 'В работе', value: stats.outcomes['pending'] || 0, fill: '#ff8c00' },
  ];

  return (
    <>
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

      {/* Динамика звонков — все звонки с выбором периода */}
      {calls.length > 0 && <PeriodAnalysis calls={calls} />}

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

      {/* Динамика качества по дням */}
      {stats.quality_by_date && stats.quality_by_date.length > 1 && (
        <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Динамика качества по дням</h3>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Средняя оценка оператора и % целевых звонков</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.quality_by_date} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} domain={[0, 10]} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="px-3 py-2 rounded-lg text-xs border"
                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
                    <div className="font-semibold mb-1">{label}</div>
                    <div style={{ color: 'var(--brand-green)' }}>Оценка: {payload[0]?.value}</div>
                    <div style={{ color: '#00aaff' }}>Целевых: {payload[1]?.value}%</div>
                  </div>
                );
              }} cursor={false} />
              <Bar dataKey="avg_score" name="Оценка" radius={[3,3,0,0]} fill="rgba(0,255,136,0.7)" />
              <Bar dataKey="target_rate" name="% целевых" radius={[3,3,0,0]} fill="rgba(0,170,255,0.5)" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-end">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(0,255,136,0.7)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Оценка /10</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(0,170,255,0.5)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>% целевых</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}