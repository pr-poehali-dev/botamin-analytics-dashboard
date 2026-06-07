interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  trend?: { value: string; positive: boolean };
  delay?: number;
}

export default function KpiCard({ label, value, sub, accent, trend, delay = 0 }: KpiCardProps) {
  return (
    <div
      className="card-glass p-5 flex flex-col gap-2 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span
        className="text-3xl font-bold font-mono-data leading-none"
        style={{ color: accent ? 'var(--brand-green)' : 'var(--text-primary)' }}
      >
        {value}
      </span>
      {sub && (
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{sub}</span>
      )}
      {trend && (
        <span
          className="text-xs font-medium"
          style={{ color: trend.positive ? 'var(--brand-green)' : '#ff4444' }}
        >
          {trend.positive ? '▲' : '▼'} {trend.value}
        </span>
      )}
    </div>
  );
}
