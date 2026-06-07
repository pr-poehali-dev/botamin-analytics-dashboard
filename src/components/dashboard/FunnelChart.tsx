import type { FunnelData } from '@/lib/dataParser';

interface Props {
  data: FunnelData[];
  total: number;
}

const STAGE_ICONS = ['📵', '🚫', '🔄', '📅', '✅'];

export default function FunnelChart({ data, total }: Props) {
  const maxCount = total;

  return (
    <div className="card-glass p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Воронка конверсии
        </h2>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Распределение по этапам диалога
        </p>
      </div>

      <div className="space-y-3">
        {data.map((item, idx) => {
          const widthPct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
          return (
            <div key={item.stage} className="animate-fade-in" style={{ animationDelay: `${idx * 80}ms` }}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{STAGE_ICONS[idx]}</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {item.label}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {idx > 0 && item.dropPct > 0 && (
                    <span className="text-xs font-mono-data" style={{ color: '#ff4444' }}>
                      −{item.dropPct.toFixed(1)}%
                    </span>
                  )}
                  <span className="text-sm font-bold font-mono-data" style={{ color: item.color }}>
                    {item.count.toLocaleString('ru-RU')}
                  </span>
                  <span className="text-xs font-mono-data w-12 text-right" style={{ color: 'var(--text-muted)' }}>
                    {item.pct.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div
                className="h-7 rounded overflow-hidden relative"
                style={{ background: 'var(--bg-elevated)' }}
              >
                <div
                  className="h-full rounded transition-all duration-700"
                  style={{
                    width: `${widthPct}%`,
                    background: item.color,
                    opacity: 0.85,
                  }}
                />
                <div
                  className="absolute inset-0 flex items-center px-2"
                  style={{ color: 'var(--text-primary)', fontSize: '11px', fontWeight: 500 }}
                >
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--border-default)' }}>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Итоговая конверсия (Этап 0 → Лид)
          </span>
          <span className="text-lg font-bold font-mono-data" style={{ color: 'var(--brand-green)' }}>
            {total > 0 ? ((data[data.length - 1].count / total) * 100).toFixed(2) : '0.00'}%
          </span>
        </div>
      </div>
    </div>
  );
}
