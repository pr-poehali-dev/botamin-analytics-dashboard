import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceArea,
} from 'recharts';
import { type CallRecord } from '@/lib/dataParser';
import Icon from '@/components/ui/icon';

interface Props {
  calls: CallRecord[];
}

interface DayStat {
  date: string;
  count: number;
  avgSec: number;
  withRecord: number;
}

const PRESETS = [
  { label: '7д', days: 7 },
  { label: '14д', days: 14 },
  { label: '30д', days: 30 },
  { label: 'Всё', days: 0 },
];

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}м ${s}с`;
}

function diffLabel(cur: number, prev: number, invert = false) {
  if (!prev) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  const up = pct > 0;
  const good = invert ? !up : up;
  const color = pct === 0 ? 'var(--text-muted)' : good ? 'var(--brand-green)' : '#ff4444';
  const sign = pct > 0 ? '+' : '';
  return { text: `${sign}${pct}%`, color };
}

export default function PeriodAnalysis({ calls }: Props) {
  const [selStart, setSelStart] = useState<string | null>(null);
  const [selEnd, setSelEnd]     = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [preset, setPreset]     = useState(30);

  // Агрегируем все звонки по дате
  const allDays = useMemo<DayStat[]>(() => {
    const map: Record<string, DayStat> = {};
    for (const c of calls) {
      const d = c.date?.slice(0, 10);
      if (!d) continue;
      if (!map[d]) map[d] = { date: d, count: 0, avgSec: 0, withRecord: 0 };
      map[d].count++;
      map[d].avgSec += c.duration_sec || 0;
      if (c.record_url) map[d].withRecord++;
    }
    for (const d of Object.values(map)) {
      d.avgSec = d.count ? Math.round(d.avgSec / d.count) : 0;
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [calls]);

  // Применяем пресет — берём последние N дней
  const days = useMemo(() => {
    if (!preset) return allDays;
    const cutoff = allDays.length > preset ? allDays[allDays.length - preset].date : '';
    return allDays.filter(d => d.date >= cutoff);
  }, [allDays, preset]);

  // Нормализуем выделение
  const selA = selStart && selEnd
    ? (selStart <= selEnd ? selStart : selEnd)
    : null;
  const selB = selStart && selEnd
    ? (selStart <= selEnd ? selEnd : selStart)
    : null;

  // Статистика выделенного периода
  const selDays  = selA && selB ? days.filter(d => d.date >= selA && d.date <= selB) : [];
  const selTotal = selDays.reduce((s, d) => s + d.count, 0);
  const selAvgSec = selDays.length
    ? Math.round(selDays.reduce((s, d) => s + d.avgSec * d.count, 0) / (selTotal || 1))
    : 0;
  const selWithRec = selDays.reduce((s, d) => s + d.withRecord, 0);

  // Предыдущий период той же длины для сравнения
  const selLen = selDays.length;
  let prevDays: DayStat[] = [];
  if (selA && selLen > 0) {
    const startIdx = days.findIndex(d => d.date === selA);
    if (startIdx >= selLen) {
      prevDays = days.slice(startIdx - selLen, startIdx);
    }
  }
  const prevTotal  = prevDays.reduce((s, d) => s + d.count, 0);
  const prevAvgSec = prevDays.length
    ? Math.round(prevDays.reduce((s, d) => s + d.avgSec * d.count, 0) / (prevDays.reduce((s, d) => s + d.count, 0) || 1))
    : 0;

  const maxCount = Math.max(...days.map(d => d.count), 1);

  const handleMouseDown = (e: { activeLabel?: string } | null) => {
    if (!e || !e.activeLabel) return;
    setDragging(e.activeLabel);
    setSelStart(e.activeLabel);
    setSelEnd(e.activeLabel);
  };
  const handleMouseMove = (e: { activeLabel?: string } | null) => {
    if (!e || !dragging || !e.activeLabel) return;
    setSelEnd(e.activeLabel);
  };
  const handleMouseUp = () => setDragging(null);

  const clearSel = () => { setSelStart(null); setSelEnd(null); };

  const formatDate = (d: string) => {
    const [, m, day] = d.split('-');
    return `${day}.${m}`;
  };

  return (
    <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      {/* Шапка */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Динамика звонков по дням
          </h3>
          {days.length > 0 && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {formatDate(days[0].date)} — {formatDate(days[days.length - 1].date)}
              {selA && selB
                ? <span style={{ color: 'var(--brand-green)' }}> · выделено {formatDate(selA)}–{formatDate(selB)}</span>
                : <span> · выделите период для сравнения</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => { setPreset(p.days); clearSel(); }}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: preset === p.days ? 'var(--brand-green)' : 'var(--bg-elevated)',
                color: preset === p.days ? '#000' : 'var(--text-muted)',
                border: `1px solid ${preset === p.days ? 'var(--brand-green)' : 'var(--border-default)'}`,
              }}>
              {p.label}
            </button>
          ))}
          {selA && (
            <button onClick={clearSel} className="px-2 py-1 rounded-lg text-xs ml-1"
              style={{ background: 'rgba(255,68,68,0.1)', color: '#ff6666', border: '1px solid rgba(255,68,68,0.2)' }}>
              ✕ Снять
            </button>
          )}
        </div>
      </div>

      {/* График */}
      <div className="select-none" style={{ cursor: dragging ? 'col-resize' : 'crosshair' }}>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart
            data={days}
            margin={{ top: 4, right: 0, bottom: 0, left: -20 }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}>
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatDate}
              interval={Math.floor(days.length / 10)}
            />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={false}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload as DayStat;
                return (
                  <div className="px-3 py-2 rounded-lg text-xs border"
                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
                    <div className="font-semibold mb-1">{label}</div>
                    <div style={{ color: 'var(--brand-green)' }}>Звонков: {d.count}</div>
                    <div style={{ color: 'var(--text-muted)' }}>Ср. длит.: {fmt(d.avgSec)}</div>
                    {d.withRecord > 0 && <div style={{ color: 'var(--text-muted)' }}>С записью: {d.withRecord}</div>}
                  </div>
                );
              }}
            />
            {selA && selB && (
              <ReferenceArea x1={selA} x2={selB} fill="rgba(0,255,136,0.08)" stroke="rgba(0,255,136,0.3)" strokeWidth={1} />
            )}
            <Bar dataKey="count" name="Звонков" radius={[3, 3, 0, 0]}>
              {days.map((d) => {
                const inSel = selA && selB && d.date >= selA && d.date <= selB;
                const isPrev = selA && prevDays.some(p => p.date === d.date);
                return (
                  <Cell
                    key={d.date}
                    fill={
                      inSel
                        ? 'rgba(0,255,136,0.85)'
                        : isPrev
                          ? 'rgba(0,170,255,0.4)'
                          : `rgba(0,255,136,${0.3 + 0.5 * (d.count / maxCount)})`
                    }
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Легенда выделения */}
      {selA && selB && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(0,255,136,0.85)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Выделенный период</span>
          </div>
          {prevDays.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(0,170,255,0.4)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Предыдущий период</span>
            </div>
          )}
        </div>
      )}

      {/* Статистика за период */}
      {selA && selB && selDays.length > 0 && (
        <div className="pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

            {/* Звонков */}
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Icon name="Phone" size={12} style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Звонков</span>
              </div>
              <div className="text-xl font-black font-mono" style={{ color: 'var(--text-primary)' }}>{selTotal}</div>
              {prevDays.length > 0 && (() => {
                const d = diffLabel(selTotal, prevTotal);
                return d ? (
                  <div className="text-xs mt-1 flex items-center gap-1">
                    <span style={{ color: d.color }}>{d.text}</span>
                    <span style={{ color: 'var(--text-muted)' }}>vs пред. период ({prevTotal})</span>
                  </div>
                ) : null;
              })()}
            </div>

            {/* В день */}
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Icon name="TrendingUp" size={12} style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>В день (ср.)</span>
              </div>
              <div className="text-xl font-black font-mono" style={{ color: 'var(--text-primary)' }}>
                {selDays.length ? Math.round(selTotal / selDays.length) : 0}
              </div>
              {prevDays.length > 0 && (() => {
                const curAvg = selDays.length ? Math.round(selTotal / selDays.length) : 0;
                const prevAvg = prevDays.length ? Math.round(prevTotal / prevDays.length) : 0;
                const d = diffLabel(curAvg, prevAvg);
                return d ? (
                  <div className="text-xs mt-1">
                    <span style={{ color: d.color }}>{d.text}</span>
                    <span style={{ color: 'var(--text-muted)' }}> vs {prevAvg}/д</span>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Ср. длит. */}
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Icon name="Clock" size={12} style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Ср. длительность</span>
              </div>
              <div className="text-xl font-black font-mono" style={{ color: 'var(--text-primary)' }}>{fmt(selAvgSec)}</div>
              {prevDays.length > 0 && (() => {
                const d = diffLabel(selAvgSec, prevAvgSec);
                return d ? (
                  <div className="text-xs mt-1">
                    <span style={{ color: d.color }}>{d.text}</span>
                    <span style={{ color: 'var(--text-muted)' }}> vs {fmt(prevAvgSec)}</span>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Дней в выборке */}
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Icon name="CalendarDays" size={12} style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Период</span>
              </div>
              <div className="text-xl font-black font-mono" style={{ color: 'var(--text-primary)' }}>{selDays.length} дн.</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {formatDate(selA)} — {formatDate(selB)}
              </div>
            </div>
          </div>

          {/* Пиковый и тихий день */}
          {selDays.length > 1 && (() => {
            const peak   = selDays.reduce((a, b) => a.count > b.count ? a : b);
            const quiet  = selDays.reduce((a, b) => a.count < b.count ? a : b);
            return (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.15)' }}>
                  <Icon name="TrendingUp" size={16} style={{ color: 'var(--brand-green)' }} />
                  <div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Пиковый день</div>
                    <div className="text-sm font-bold" style={{ color: 'var(--brand-green)' }}>
                      {formatDate(peak.date)} — {peak.count} звонков
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(255,68,68,0.06)', border: '1px solid rgba(255,68,68,0.15)' }}>
                  <Icon name="TrendingDown" size={16} style={{ color: '#ff6666' }} />
                  <div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Тихий день</div>
                    <div className="text-sm font-bold" style={{ color: '#ff6666' }}>
                      {formatDate(quiet.date)} — {quiet.count} звонков
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}