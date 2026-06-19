import Icon from '@/components/ui/icon';
import { type AiStats } from './aiInsightsTypes';

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

export default function AiInsightsOutcomes({ stats }: { stats: AiStats }) {
  const scoreMax = Math.max(...stats.score_distribution.map(s => s.count), 1);
  const maxFail  = Math.max(...stats.top_fail_reasons.map(f => f.count), 1);

  return (
    <>
      {/* Топ причин отказов + факторов успеха — бок о бок */}
      <div className="grid sm:grid-cols-2 gap-4">

        {/* Топ причин отказов */}
        {stats.top_fail_reasons.length > 0 && (
          <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(255,68,68,0.12)' }}>
                <Icon name="XCircle" size={14} style={{ color: '#ff4444' }} />
              </div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Топ причин отказов</h3>
            </div>
            <div className="space-y-3">
              {stats.top_fail_reasons.map((f, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-xs font-black font-mono w-5 shrink-0 mt-0.5" style={{ color: '#ff4444' }}>#{i+1}</span>
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
        {stats.top_success_factors.length > 0 ? (
          <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(0,255,136,0.12)' }}>
                <Icon name="CheckCircle" size={14} style={{ color: 'var(--brand-green)' }} />
              </div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Факторы успеха</h3>
            </div>
            <div className="space-y-2.5">
              {stats.top_success_factors.map((f, i) => {
                const maxS = Math.max(...stats.top_success_factors.map(x => x.count), 1);
                return (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-xs font-black font-mono w-5 shrink-0 mt-0.5" style={{ color: 'var(--brand-green)' }}>#{i+1}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                          <div className="h-full rounded-full" style={{ width: `${(f.count / maxS) * 100}%`, background: 'var(--brand-green)' }} />
                        </div>
                        <span className="text-xs font-mono shrink-0" style={{ color: 'var(--brand-green)' }}>{f.count}×</span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.factor}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl p-6 flex flex-col items-center justify-center gap-2"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <Icon name="Trophy" size={24} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Факторы успеха появятся<br/>после успешных звонков
            </p>
          </div>
        )}
      </div>

      {/* Лучшие и худшие звонки */}
      {((stats.top_best_calls?.length > 0) || (stats.top_worst_calls?.length > 0)) && (
        <div className="grid sm:grid-cols-2 gap-4">

          {/* Лучшие */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Icon name="Trophy" size={14} style={{ color: 'var(--brand-green)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Лучшие звонки</h3>
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--brand-green)' }}>оценка 8–10</span>
            </div>
            {stats.top_best_calls?.length > 0 ? (
              <div className="space-y-2">
                {stats.top_best_calls.map((c, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                    style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.1)' }}>
                    <span className="text-sm font-black font-mono shrink-0" style={{ color: 'var(--brand-green)' }}>{c.score}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono mb-0.5" style={{ color: 'var(--text-muted)' }}>{c.date} · ID {c.comm_id}</p>
                      <p className="text-xs leading-relaxed truncate" style={{ color: 'var(--text-secondary)' }}>{c.summary || '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs py-6 text-center" style={{ color: 'var(--text-muted)' }}>Пока нет звонков с оценкой 8+</p>
            )}
          </div>

          {/* Худшие */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Icon name="AlertTriangle" size={14} style={{ color: '#ff4444' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Требуют внимания</h3>
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,68,68,0.1)', color: '#ff4444' }}>оценка 1–4</span>
            </div>
            {stats.top_worst_calls?.length > 0 ? (
              <div className="space-y-2">
                {stats.top_worst_calls.map((c, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                    style={{ background: 'rgba(255,68,68,0.05)', border: '1px solid rgba(255,68,68,0.1)' }}>
                    <span className="text-sm font-black font-mono shrink-0" style={{ color: '#ff4444' }}>{c.score}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono mb-0.5" style={{ color: 'var(--text-muted)' }}>{c.date} · ID {c.comm_id}</p>
                      <p className="text-xs leading-relaxed truncate" style={{ color: 'var(--text-secondary)' }}>{c.summary || '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs py-6 text-center" style={{ color: 'var(--text-muted)' }}>Нет звонков с низкой оценкой</p>
            )}
          </div>
        </div>
      )}

      {/* Оценки + фразы */}
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

        {/* Топ фраз */}
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
    </>
  );
}
