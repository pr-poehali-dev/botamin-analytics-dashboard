import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  buckets: { label: string; count: number }[];
  endReasons: { name: string; value: number; color: string }[];
}

interface TooltipProps { active?: boolean; payload?: { value: number; name: string }[]; label?: string; }
const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-glass px-3 py-2 text-xs border" style={{ borderColor: 'var(--border-default)' }}>
      <div style={{ color: 'var(--text-secondary)' }}>{label}: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{payload[0].value}</span></div>
    </div>
  );
};

const REASON_LABELS: Record<string, string> = {
  bot_hangup: 'Бот завершил',
  client_hangup: 'Клиент сбросил',
  timeout: 'Таймаут',
  error: 'Ошибка',
};

export default function DurationChart({ buckets, endReasons }: Props) {
  const maxCount = Math.max(...buckets.map(b => b.count), 1);

  return (
    <div className="card-glass p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Длительность звонков
        </h3>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Распределение по продолжительности
        </p>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={buckets} margin={{ top: 0, right: 0, bottom: 0, left: -25 }}>
          <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={false} />
          <Bar dataKey="count" name="Звонков" radius={[3, 3, 0, 0]}>
            {buckets.map((b, idx) => (
              <Cell
                key={idx}
                fill={`rgba(0,170,255,${0.25 + (b.count / maxCount) * 0.75})`}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--border-default)' }}>
        <div className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
          Причины завершения
        </div>
        <div className="space-y-2">
          {endReasons.map((r, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
              <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>
                {REASON_LABELS[r.name] ?? r.name}
              </span>
              <span className="text-xs font-mono-data" style={{ color: r.color }}>
                {r.value.toLocaleString('ru-RU')}
              </span>
              <span className="text-xs font-mono-data" style={{ color: 'var(--text-muted)' }}>
                {(endReasons.reduce((s, x) => s + x.value, 0) > 0
                  ? (r.value / endReasons.reduce((s, x) => s + x.value, 0) * 100).toFixed(1)
                  : '0.0')}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}