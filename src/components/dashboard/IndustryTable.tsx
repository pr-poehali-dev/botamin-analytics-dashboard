import type { IndustryData } from '@/lib/dataParser';

interface Props {
  data: IndustryData[];
}

export default function IndustryTable({ data }: Props) {
  const maxCr = Math.max(...data.map(d => d.cr), 1);

  return (
    <div className="card-glass p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Конверсия по отраслям
        </h3>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Какая отрасль лучше реагирует на оффер
        </p>
      </div>
      <div className="space-y-2">
        {data.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Нет данных об отраслях</p>
        ) : (
          data.map((row, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs w-5 font-mono-data" style={{ color: 'var(--text-muted)' }}>
                {i + 1}
              </span>
              <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                {row.industry}
              </span>
              <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(row.cr / maxCr) * 100}%`,
                    background: row.cr > 5 ? 'var(--brand-green)' : row.cr > 2 ? '#ff8c00' : '#ff4444',
                  }}
                />
              </div>
              <span className="text-xs font-mono-data w-10 text-right" style={{
                color: row.cr > 5 ? 'var(--brand-green)' : row.cr > 2 ? '#ff8c00' : '#ff4444',
              }}>
                {row.cr.toFixed(1)}%
              </span>
              <span className="text-xs font-mono-data w-12 text-right" style={{ color: 'var(--text-muted)' }}>
                {row.calls}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
