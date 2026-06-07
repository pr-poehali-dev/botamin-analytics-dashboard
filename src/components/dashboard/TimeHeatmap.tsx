import type { HourlyData, DayData } from '@/lib/dataParser';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface Props {
  hourly: HourlyData[];
  byDay: DayData[];
}

interface TooltipPayloadItem { name: string; value: number; color: string; }
interface TooltipProps { active?: boolean; payload?: TooltipPayloadItem[]; label?: string; }

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-glass px-3 py-2 text-xs border" style={{ borderColor: 'var(--border-default)' }}>
      <div className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{label}</div>
      {payload.map((p: TooltipPayloadItem, i: number) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' && p.value % 1 !== 0 ? p.value.toFixed(1) + '%' : p.value}
        </div>
      ))}
    </div>
  );
};

export default function TimeHeatmap({ hourly, byDay }: Props) {
  const maxCalls = Math.max(...hourly.map(h => h.calls), 1);

  return (
    <div className="card-glass p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Активность по времени
        </h2>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Распределение звонков и конверсии по часам
        </p>
      </div>

      {hourly.length > 0 ? (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={hourly} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Bar dataKey="calls" name="Звонков" radius={[3, 3, 0, 0]}>
              {hourly.map((entry, idx) => (
                <Cell key={idx} fill={`rgba(0,255,136,${0.2 + (entry.calls / maxCalls) * 0.8})`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[180px] flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Недостаточно данных
        </div>
      )}

      {byDay.length > 1 && (
        <>
          <div className="mt-5 mb-3">
            <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              По дням недели
            </span>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={byDay} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Bar dataKey="calls" name="Звонков" fill="rgba(0,170,255,0.5)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="converted" name="Лидов" fill="var(--brand-green)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}