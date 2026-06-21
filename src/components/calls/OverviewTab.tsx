import { useState, useMemo } from 'react';
import { formatSec, formatTotalHours, type CallsData } from '@/lib/dataParser';
import Icon from '@/components/ui/icon';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

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

function KPI({ icon, label, value, sub, accent }: {
  icon: string; label: string; value: string; sub?: string; accent?: boolean
}) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon name={icon} size={15} style={{ color: accent ? 'var(--brand-green)' : 'var(--text-muted)' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div className="text-2xl font-black font-mono"
        style={{ color: accent ? 'var(--brand-green)' : 'var(--text-primary)' }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

// ── Пресеты сравнения недель ─────────────────────────────────────────────────
type Preset = '7' | '14' | '30';
const PRESETS: { id: Preset; label: string }[] = [
  { id: '7',  label: '7 дней' },
  { id: '14', label: '14 дней' },
  { id: '30', label: '30 дней' },
];

function toIso(d: string): string {
  if (!d) return '';
  if (d.includes('.')) { const [dd, mm, yyyy] = d.split('.'); return `${yyyy}-${mm}-${dd}`; }
  return d.slice(0, 10);
}

interface Props {
  data: CallsData;
}

export default function OverviewTab({ data }: Props) {
  const maxDay    = Math.max(...data.by_day.map(d => d.count), 1);
  const maxBucket = Math.max(...data.duration_dist.map(d => d.count), 1);
  const [preset, setPreset] = useState<Preset>('7');

  // ── Сравнение периодов по by_day ─────────────────────────────────────────
  const comparison = useMemo(() => {
    const days = parseInt(preset);
    const sorted = [...data.by_day].sort((a, b) => toIso(a.date).localeCompare(toIso(b.date)));
    if (sorted.length < days * 2) return null;

    const curSlice  = sorted.slice(-days);
    const prevSlice = sorted.slice(-days * 2, -days);

    const sum = (arr: typeof sorted) => arr.reduce((s, d) => s + d.count, 0);
    const avgDur = (arr: typeof sorted) => arr.length ? Math.round(arr.reduce((s, d) => s + d.avg_sec, 0) / arr.length) : 0;

    const curCount  = sum(curSlice);
    const prevCount = sum(prevSlice);
    const curAvg    = avgDur(curSlice);
    const prevAvg   = avgDur(prevSlice);

    const pct = (cur: number, prev: number) =>
      prev === 0 ? null : Math.round((cur - prev) / prev * 100);

    return {
      curLabel:  `${curSlice[0]?.date} — ${curSlice[curSlice.length - 1]?.date}`,
      prevLabel: `${prevSlice[0]?.date} — ${prevSlice[prevSlice.length - 1]?.date}`,
      curCount, prevCount, deltaCount: pct(curCount, prevCount),
      curAvg,   prevAvg,  deltaAvg:   pct(curAvg,   prevAvg),
      chartData: curSlice.map((d, i) => ({
        date: d.date,
        current:  d.count,
        previous: prevSlice[i]?.count ?? 0,
      })),
    };
  }, [data.by_day, preset]);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPI icon="PhoneCall" label="Всего звонков" value={data.total.toLocaleString('ru-RU')} accent />
        <KPI icon="Clock" label="Средняя длительность"
          value={formatSec(data.avg_duration_sec)} sub="время разговора" />
        <KPI icon="Timer" label="Суммарное время"
          value={formatTotalHours(data.total_talk_sec)} sub="часов разговоров" />
        <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Icon name="PhoneOutgoing" size={15} style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Направление / статус</span>
          </div>
          {(() => {
            const callTypes: Record<string, number> = {};
            for (const c of data.calls) {
              if (c.call_type) callTypes[c.call_type] = (callTypes[c.call_type] || 0) + 1;
            }
            return (
              <div className="space-y-1.5">
                {Object.entries(callTypes).sort(([, a], [, b]) => b - a).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{type}</span>
                    <span className="text-xs font-mono shrink-0" style={{ color: 'var(--brand-green)' }}>
                      {count.toLocaleString('ru-RU')}
                    </span>
                  </div>
                ))}
                <div className="pt-1.5 mt-1.5 space-y-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  {Object.entries(data.statuses).sort(([, a], [, b]) => b - a).map(([st, count]) => (
                    <div key={st} className="flex items-center justify-between gap-2">
                      <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{st}</span>
                      <span className="text-xs font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>
                        {count.toLocaleString('ru-RU')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Динамика по дням */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="mb-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Динамика звонков по дням
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {data.by_day.length > 0
              ? `${data.by_day[0].date} — ${data.by_day[data.by_day.length - 1].date}`
              : 'Нет данных'}
          </p>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.by_day} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false}
              interval={Math.floor(data.by_day.length / 8)} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<BarTip />} cursor={false} />
            <Bar dataKey="count" name="Звонков" radius={[3, 3, 0, 0]}>
              {data.by_day.map((d, i) => (
                <Cell key={i} fill={`rgba(0,255,136,${0.25 + (d.count / maxDay) * 0.75})`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Сравнение периодов */}
      {data.by_day.length >= 14 && (
        <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Сравнение периодов
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Последние {preset} дней vs предыдущие {preset} дней
              </p>
            </div>
            <div className="flex gap-1">
              {PRESETS.map(p => (
                <button key={p.id} onClick={() => setPreset(p.id)}
                  className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: preset === p.id ? 'rgba(0,255,136,0.15)' : 'var(--bg-elevated)',
                    border: `1px solid ${preset === p.id ? 'rgba(0,255,136,0.4)' : 'var(--border-default)'}`,
                    color: preset === p.id ? 'var(--brand-green)' : 'var(--text-muted)',
                  }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {comparison ? (
            <>
              {/* Легенда периодов */}
              <div className="flex gap-4 mb-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(0,255,136,0.8)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                    Текущий период
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({comparison.curLabel})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(96,165,250,0.6)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                    Предыдущий период
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({comparison.prevLabel})</span>
                </div>
              </div>

              {/* График сравнения */}
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={comparison.chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false}
                    interval={Math.floor(comparison.chartData.length / 6)} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="px-3 py-2 rounded-lg text-xs border"
                          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
                          <div className="font-semibold mb-1">{label}</div>
                          {payload.map((p, i) => (
                            <div key={i} style={{ color: p.color }}>{p.name}: {p.value}</div>
                          ))}
                        </div>
                      );
                    }}
                    cursor={false}
                  />
                  <Bar dataKey="current"  name="Текущий"    radius={[3,3,0,0]} fill="rgba(0,255,136,0.8)" />
                  <Bar dataKey="previous" name="Предыдущий" radius={[3,3,0,0]} fill="rgba(96,165,250,0.5)" />
                </BarChart>
              </ResponsiveContainer>

              {/* Итоговые карточки */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                {[
                  {
                    label: 'Звонков за период',
                    cur: comparison.curCount.toLocaleString('ru-RU'),
                    prev: comparison.prevCount.toLocaleString('ru-RU'),
                    delta: comparison.deltaCount,
                    icon: 'PhoneCall',
                  },
                  {
                    label: 'Средняя длительность',
                    cur: formatSec(comparison.curAvg),
                    prev: formatSec(comparison.prevAvg),
                    delta: comparison.deltaAvg,
                    icon: 'Clock',
                  },
                ].map((card, i) => {
                  const d = card.delta;
                  const isUp   = d != null && d > 0;
                  const isDown = d != null && d < 0;
                  return (
                    <div key={i} className="rounded-xl p-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Icon name={card.icon} size={12} style={{ color: 'var(--text-muted)' }} />
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{card.label}</span>
                      </div>
                      <div className="text-lg font-black font-mono" style={{ color: 'var(--text-primary)' }}>
                        {card.cur}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          было: {card.prev}
                        </span>
                        {d != null && (
                          <span className="flex items-center gap-0.5 text-xs font-semibold"
                            style={{ color: isUp ? 'var(--brand-green)' : isDown ? '#ff4444' : 'var(--text-muted)' }}>
                            <Icon name={isUp ? 'TrendingUp' : isDown ? 'TrendingDown' : 'Minus'} size={10} />
                            {isUp ? '+' : ''}{d}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
              Недостаточно данных для сравнения {preset} + {preset} дней
            </p>
          )}
        </div>
      )}

      {/* Распределение по длительности */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="mb-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Распределение по длительности
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Сколько звонков в каждом диапазоне
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data.duration_dist} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<BarTip />} cursor={false} />
              <Bar dataKey="count" name="Звонков" radius={[3, 3, 0, 0]}>
                {data.duration_dist.map((d, i) => (
                  <Cell key={i} fill={`rgba(0,170,255,${0.25 + (d.count / maxBucket) * 0.75})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="space-y-2">
            {data.duration_dist.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: 'rgba(0,170,255,0.7)' }} />
                <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>{d.label}</span>
                <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {d.count.toLocaleString('ru-RU')}
                </span>
                <span className="text-xs w-10 text-right" style={{ color: 'var(--text-muted)' }}>{d.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Сводная таблица */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="ShieldCheck" size={14} style={{ color: 'var(--brand-green)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Сводные показатели
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          {[
            { label: 'Всего звонков',               val: data.total.toLocaleString('ru-RU') },
            { label: 'Средняя длительность',         val: formatSec(data.avg_duration_sec) },
            { label: 'Суммарное время разговоров',   val: formatTotalHours(data.total_talk_sec) },
            { label: 'Дней в периоде',               val: data.by_day.length.toString() },
            { label: 'Среднее звонков в день',       val: data.by_day.length > 0 ? Math.round(data.total / data.by_day.length).toString() : '—' },
            { label: 'Источник',                     val: 'CoMagic / Битрикс24' },
          ].map((row, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-lg"
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
