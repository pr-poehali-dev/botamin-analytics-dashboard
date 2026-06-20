import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { type AiStats } from './aiInsightsTypes';

const FILTER_URL = 'https://functions.poehali.dev/1d754dd2-2cc6-4d43-8581-04f8a030693d';

interface FilterCall {
  comm_id: string;
  call_type_label: string;
  qualification_label: string;
  interest_label: string;
  outcome_label: string;
  operator_score: number | null;
  fail_reason: string | null;
  success_factor: string | null;
  operator_comment: string | null;
  summary: string | null;
  followed_script: boolean;
  handled_objections: boolean;
  date: string;
  duration: string;
}

const scoreColor = (s: number | null) =>
  !s ? 'var(--text-muted)' : s >= 8 ? 'var(--brand-green)' : s >= 5 ? '#ff8c00' : '#ff4444';

const outcomeColor: Record<string, string> = {
  'Успех': 'var(--brand-green)', 'Отказ': '#ff4444', 'В работе': '#ff8c00',
};

function CallsModal({ filter, title, accent, onClose, onGoToTranscription }: {
  filter: string; title: string; accent?: string; onClose: () => void;
  onGoToTranscription?: (commId?: string) => void;
}) {
  const [calls, setCalls]       = useState<FilterCall[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useState(() => {
    fetch(`${FILTER_URL}?filter=${encodeURIComponent(filter)}`)
      .then(r => r.json())
      .then(d => { setCalls(d.calls || []); setLoading(false); })
      .catch(() => setLoading(false));
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: `1px solid ${accent ? accent + '40' : 'var(--border-default)'}` }}>

        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border-default)' }}>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</p>
            {!loading && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{calls.length} звонков</p>
            )}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
            <Icon name="X" size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-16 gap-2">
              {[0,1,2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: accent || 'var(--brand-green)', animationDelay: `${i*0.2}s` }} />
              ))}
            </div>
          )}
          {!loading && calls.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Icon name="SearchX" size={28} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Нет звонков</p>
            </div>
          )}
          {!loading && calls.map((c, i) => {
            const isOpen = expanded === c.comm_id;
            return (
              <div key={c.comm_id}
                style={{ borderBottom: i < calls.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <button
                  onClick={() => setExpanded(isOpen ? null : c.comm_id)}
                  className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-black font-mono"
                    style={{ background: 'var(--bg-elevated)', color: scoreColor(c.operator_score) }}>
                    {c.operator_score ?? '—'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{c.date}</span>
                      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{c.duration}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: `${outcomeColor[c.outcome_label] || 'var(--text-muted)'}18`, color: outcomeColor[c.outcome_label] || 'var(--text-muted)' }}>
                        {c.outcome_label}
                      </span>
                    </div>
                    {c.summary && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>{c.summary}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>ID {c.comm_id}</span>
                    <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} size={13} style={{ color: 'var(--text-muted)' }} />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-4 space-y-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {[
                        { label: c.qualification_label, color: '#00aaff' },
                        { label: c.interest_label + ' интерес', color: c.interest_label === 'Высокий' ? 'var(--brand-green)' : c.interest_label === 'Средний' ? '#ff8c00' : '#ff4444' },
                        { label: c.followed_script ? '✓ Скрипт' : '✗ Скрипт', color: c.followed_script ? 'var(--brand-green)' : '#ff4444' },
                        { label: c.handled_objections ? '✓ Возражения' : '✗ Возражения', color: c.handled_objections ? 'var(--brand-green)' : '#ff4444' },
                      ].map((tag, ti) => (
                        <span key={ti} className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: `${tag.color}15`, color: tag.color }}>
                          {tag.label}
                        </span>
                      ))}
                    </div>
                    {c.operator_comment && (
                      <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
                        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>КОММЕНТАРИЙ</p>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{c.operator_comment}</p>
                      </div>
                    )}
                    {(c.fail_reason || c.success_factor) && (
                      <div className="px-3 py-2 rounded-lg"
                        style={{ background: c.fail_reason ? 'rgba(255,68,68,0.06)' : 'rgba(0,255,136,0.06)', border: `1px solid ${c.fail_reason ? 'rgba(255,68,68,0.15)' : 'rgba(0,255,136,0.15)'}` }}>
                        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{c.fail_reason ? 'ПРИЧИНА ОТКАЗА' : 'ФАКТОР УСПЕХА'}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{c.fail_reason || c.success_factor}</p>
                      </div>
                    )}
                    {onGoToTranscription && (
                      <button
                        onClick={() => { onGoToTranscription(c.comm_id); onClose(); }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold w-full transition-all hover:opacity-80"
                        style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', color: 'var(--brand-green)' }}>
                        <Icon name="FileText" size={13} />
                        Открыть транскрипт
                        <Icon name="ArrowRight" size={12} style={{ marginLeft: 'auto' }} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ score, count, max, onClick }: { score: number; count: number; max: number; onClick: () => void }) {
  const color = score >= 8 ? 'var(--brand-green)' : score >= 6 ? '#ff8c00' : '#ff4444';
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 group hover:opacity-80 transition-opacity">
      <span className="text-xs font-mono w-4 text-right" style={{ color: 'var(--text-muted)' }}>{score}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${max > 0 ? (count / max) * 100 : 0}%`, background: color }} />
      </div>
      <span className="text-xs font-mono w-8 text-right" style={{ color: 'var(--text-primary)' }}>{count}</span>
      <Icon name="ChevronRight" size={11} style={{ color: 'var(--text-muted)', opacity: 0 }} className="group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

interface Props {
  stats: AiStats;
  onGoToTranscription?: (commId?: string) => void;
}

export default function AiInsightsOutcomes({ stats, onGoToTranscription }: Props) {
  const [modal, setModal] = useState<{ filter: string; title: string; accent?: string } | null>(null);

  const scoreMax = Math.max(...stats.score_distribution.map(s => s.count), 1);
  const maxFail  = Math.max(...stats.top_fail_reasons.map(f => f.count), 1);

  const openModal = (filter: string, title: string, accent?: string) =>
    setModal({ filter, title, accent });

  return (
    <>
      {modal && (
        <CallsModal
          filter={modal.filter}
          title={modal.title}
          accent={modal.accent}
          onClose={() => setModal(null)}
          onGoToTranscription={onGoToTranscription}
        />
      )}

      {/* Топ причин отказов + факторов успеха */}
      <div className="grid sm:grid-cols-2 gap-4">

        {stats.top_fail_reasons.length > 0 && (
          <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,68,68,0.12)' }}>
                <Icon name="XCircle" size={14} style={{ color: '#ff4444' }} />
              </div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Топ причин отказов</h3>
              <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>кликабельно</span>
            </div>
            <div className="space-y-3">
              {stats.top_fail_reasons.map((f, i) => (
                <button
                  key={i}
                  onClick={() => openModal(`fail_reason:${f.reason}`, `Отказ: ${f.reason}`, '#ff4444')}
                  className="w-full text-left group hover:opacity-80 transition-opacity">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-black font-mono w-5 shrink-0 mt-0.5" style={{ color: '#ff4444' }}>#{i+1}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                          <div className="h-full rounded-full" style={{ width: `${(f.count / maxFail) * 100}%`, background: '#ff4444' }} />
                        </div>
                        <span className="text-xs font-mono shrink-0" style={{ color: '#ff6666' }}>{f.count}×</span>
                        <Icon name="ChevronRight" size={11} style={{ color: 'var(--text-muted)', opacity: 0 }} className="group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.reason}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {stats.top_success_factors.length > 0 ? (
          <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,255,136,0.12)' }}>
                <Icon name="CheckCircle" size={14} style={{ color: 'var(--brand-green)' }} />
              </div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Факторы успеха</h3>
              <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>кликабельно</span>
            </div>
            <div className="space-y-2.5">
              {stats.top_success_factors.map((f, i) => {
                const maxS = Math.max(...stats.top_success_factors.map(x => x.count), 1);
                return (
                  <button
                    key={i}
                    onClick={() => openModal(`success_factor:${f.factor}`, `Успех: ${f.factor}`, 'var(--brand-green)')}
                    className="w-full text-left group hover:opacity-80 transition-opacity">
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-black font-mono w-5 shrink-0 mt-0.5" style={{ color: 'var(--brand-green)' }}>#{i+1}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                            <div className="h-full rounded-full" style={{ width: `${(f.count / maxS) * 100}%`, background: 'var(--brand-green)' }} />
                          </div>
                          <span className="text-xs font-mono shrink-0" style={{ color: 'var(--brand-green)' }}>{f.count}×</span>
                          <Icon name="ChevronRight" size={11} style={{ color: 'var(--text-muted)', opacity: 0 }} className="group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.factor}</p>
                      </div>
                    </div>
                  </button>
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

          <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Icon name="Trophy" size={14} style={{ color: 'var(--brand-green)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Лучшие звонки</h3>
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--brand-green)' }}>оценка 8–10</span>
            </div>
            {stats.top_best_calls?.length > 0 ? (
              <div className="space-y-2">
                {stats.top_best_calls.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => onGoToTranscription?.(c.comm_id)}
                    className="w-full text-left flex items-start gap-3 p-3 rounded-xl transition-all hover:opacity-80 hover:scale-[1.01]"
                    style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.1)' }}>
                    <span className="text-sm font-black font-mono shrink-0" style={{ color: 'var(--brand-green)' }}>{c.score}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono mb-0.5" style={{ color: 'var(--text-muted)' }}>{c.date} · ID {c.comm_id}</p>
                      <p className="text-xs leading-relaxed truncate" style={{ color: 'var(--text-secondary)' }}>{c.summary || '—'}</p>
                    </div>
                    <Icon name="FileText" size={12} style={{ color: 'var(--brand-green)', opacity: 0.6, shrink: 0 }} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs py-6 text-center" style={{ color: 'var(--text-muted)' }}>Пока нет звонков с оценкой 8+</p>
            )}
          </div>

          <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Icon name="AlertTriangle" size={14} style={{ color: '#ff4444' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Требуют внимания</h3>
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,68,68,0.1)', color: '#ff4444' }}>оценка 1–4</span>
            </div>
            {stats.top_worst_calls?.length > 0 ? (
              <div className="space-y-2">
                {stats.top_worst_calls.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => onGoToTranscription?.(c.comm_id)}
                    className="w-full text-left flex items-start gap-3 p-3 rounded-xl transition-all hover:opacity-80 hover:scale-[1.01]"
                    style={{ background: 'rgba(255,68,68,0.05)', border: '1px solid rgba(255,68,68,0.1)' }}>
                    <span className="text-sm font-black font-mono shrink-0" style={{ color: '#ff4444' }}>{c.score}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono mb-0.5" style={{ color: 'var(--text-muted)' }}>{c.date} · ID {c.comm_id}</p>
                      <p className="text-xs leading-relaxed truncate" style={{ color: 'var(--text-secondary)' }}>{c.summary || '—'}</p>
                    </div>
                    <Icon name="FileText" size={12} style={{ color: '#ff4444', opacity: 0.6 }} />
                  </button>
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

        <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Icon name="Star" size={14} style={{ color: '#ff8c00' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Распределение оценок операторов</h3>
          </div>
          <div className="space-y-2">
            {[...stats.score_distribution].reverse().map(s => (
              <ScoreBar
                key={s.score}
                score={s.score}
                count={s.count}
                max={scoreMax}
                onClick={() => openModal(`score:${s.score}`, `Оценка оператора: ${s.score}/10`, s.score >= 8 ? 'var(--brand-green)' : s.score >= 6 ? '#ff8c00' : '#ff4444')}
              />
            ))}
          </div>
          <div className="mt-4 pt-3 flex items-center justify-between"
            style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Средняя оценка</span>
            <span className="text-sm font-black font-mono"
              style={{ color: stats.avg_operator_score >= 7 ? 'var(--brand-green)' : stats.avg_operator_score >= 5 ? '#ff8c00' : '#ff4444' }}>
              {stats.avg_operator_score}/10
            </span>
          </div>
        </div>

        <div className="rounded-2xl p-5 space-y-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          {stats.top_phrases_client.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Icon name="MessageSquare" size={13} style={{ color: '#00aaff' }} />
                <h4 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Топ фраз клиентов</h4>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {stats.top_phrases_client.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => openModal(`phrase_client:${p.phrase}`, `Фраза клиента: «${p.phrase}»`, '#00aaff')}
                    className="px-2 py-1 rounded-lg text-xs transition-all hover:opacity-80"
                    style={{ background: 'rgba(0,170,255,0.08)', border: '1px solid rgba(0,170,255,0.15)', color: '#00aaff' }}>
                    «{p.phrase}» <span style={{ opacity: 0.6 }}>{p.count}×</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {stats.top_phrases_operator.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Icon name="Headphones" size={13} style={{ color: '#ff8c00' }} />
                <h4 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Топ фраз операторов</h4>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {stats.top_phrases_operator.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => openModal(`phrase_operator:${p.phrase}`, `Фраза оператора: «${p.phrase}»`, '#ff8c00')}
                    className="px-2 py-1 rounded-lg text-xs transition-all hover:opacity-80"
                    style={{ background: 'rgba(255,140,0,0.08)', border: '1px solid rgba(255,140,0,0.15)', color: '#ff8c00' }}>
                    «{p.phrase}» <span style={{ opacity: 0.6 }}>{p.count}×</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
