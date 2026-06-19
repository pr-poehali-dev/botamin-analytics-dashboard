import Icon from '@/components/ui/icon';
import { type AiStats } from './aiInsightsTypes';

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

interface Props {
  stats: AiStats;
  pendingCount: number;
  batchRunning: boolean;
  batchDone: number;
  batchTotal: number;
  batchCurrent: string;
  onBatchAnalyze: () => void;
  onStopBatch: () => void;
  onRefresh: () => void;
}

export default function AiInsightsKpi({
  stats, pendingCount, batchRunning, batchDone, batchTotal, batchCurrent,
  onBatchAnalyze, onStopBatch, onRefresh,
}: Props) {
  return (
    <>
      {/* Заголовок */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            Аналитика ИИ
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            На основе {stats.total} проанализированных звонков
            {pendingCount > 0 && (
              <span style={{ color: '#ff8c00' }}> · {pendingCount} ожидают анализа</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!batchRunning ? (
            pendingCount > 0 && (
              <button onClick={onBatchAnalyze}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                style={{ background: 'var(--brand-green)', color: '#000' }}>
                <Icon name="Sparkles" size={13} />
                Анализировать все ({pendingCount})
              </button>
            )
          ) : (
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: 'var(--brand-green)', animationDelay: `${i*0.15}s` }} />
                ))}
              </div>
              <span className="text-xs" style={{ color: 'var(--brand-green)' }}>
                {batchDone}/{batchTotal} · {batchCurrent}
              </span>
              <button onClick={onStopBatch}
                className="text-xs px-2 py-0.5 rounded"
                style={{ background: 'rgba(255,68,68,0.1)', color: '#ff4444' }}>
                Стоп
              </button>
            </div>
          )}
          <button onClick={onRefresh} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
            <Icon name="RefreshCw" size={12} />
            Обновить
          </button>
        </div>
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
    </>
  );
}
