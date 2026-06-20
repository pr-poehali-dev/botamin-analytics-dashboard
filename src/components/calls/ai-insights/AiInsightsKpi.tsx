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
  duration_sec: number;
}

const scoreColor = (s: number | null) =>
  !s ? 'var(--text-muted)' : s >= 8 ? 'var(--brand-green)' : s >= 5 ? '#ff8c00' : '#ff4444';

const outcomeColor: Record<string, string> = {
  'Успех': 'var(--brand-green)', 'Отказ': '#ff4444', 'В работе': '#ff8c00',
};

function CallsModal({ filter, title, onClose, onGoToTranscription }: {
  filter: string; title: string; onClose: () => void;
  onGoToTranscription?: (commId?: string) => void;
}) {
  const [calls, setCalls]       = useState<FilterCall[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useState(() => {
    fetch(`${FILTER_URL}?filter=${filter}`)
      .then(r => r.json())
      .then(d => { setCalls(d.calls || []); setLoading(false); })
      .catch(() => setLoading(false));
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border-default)' }}>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</p>
            {!loading && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {calls.length} звонков
              </p>
            )}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
            <Icon name="X" size={14} />
          </button>
        </div>

        {/* Список */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-16 gap-3">
              {[0,1,2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: 'var(--brand-green)', animationDelay: `${i*0.2}s` }} />
              ))}
            </div>
          )}
          {!loading && calls.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Icon name="SearchX" size={28} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Нет звонков по этому фильтру</p>
            </div>
          )}
          {!loading && calls.map((c, i) => {
            const isOpen = expanded === c.comm_id;
            return (
              <div key={c.comm_id}
                style={{ borderBottom: i < calls.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                {/* Строка */}
                <button
                  onClick={() => setExpanded(isOpen ? null : c.comm_id)}
                  className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors">
                  {/* Оценка */}
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-black font-mono"
                    style={{ background: 'var(--bg-elevated)', color: scoreColor(c.operator_score) }}>
                    {c.operator_score ?? '—'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{c.date}</span>
                      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{c.duration}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(0,255,136,0.08)', color: 'var(--brand-green)' }}>
                        {c.call_type_label}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          background: `${outcomeColor[c.outcome_label] || 'var(--text-muted)'}18`,
                          color: outcomeColor[c.outcome_label] || 'var(--text-muted)'
                        }}>
                        {c.outcome_label}
                      </span>
                    </div>
                    {c.summary && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                        {c.summary}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      ID {c.comm_id}
                    </span>
                    <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} size={13} style={{ color: 'var(--text-muted)' }} />
                  </div>
                </button>

                {/* Раскрытая карточка */}
                {isOpen && (
                  <div className="px-5 pb-4 space-y-3"
                    style={{ background: 'rgba(255,255,255,0.02)' }}>

                    {/* Метки */}
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

                    {/* Комментарий оператора */}
                    {c.operator_comment && (
                      <div className="px-3 py-2 rounded-lg"
                        style={{ background: 'var(--bg-elevated)' }}>
                        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                          КОММЕНТАРИЙ ПО ОПЕРАТОРУ
                        </p>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {c.operator_comment}
                        </p>
                      </div>
                    )}

                    {/* Причина / фактор */}
                    {(c.fail_reason || c.success_factor) && (
                      <div className="px-3 py-2 rounded-lg"
                        style={{
                          background: c.fail_reason ? 'rgba(255,68,68,0.06)' : 'rgba(0,255,136,0.06)',
                          border: `1px solid ${c.fail_reason ? 'rgba(255,68,68,0.15)' : 'rgba(0,255,136,0.15)'}`,
                        }}>
                        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                          {c.fail_reason ? 'ПРИЧИНА ОТКАЗА' : 'ФАКТОР УСПЕХА'}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {c.fail_reason || c.success_factor}
                        </p>
                      </div>
                    )}

                    {/* Кнопка перехода к транскрипту */}
                    {onGoToTranscription && (
                      <button
                        onClick={() => { onGoToTranscription(c.comm_id); onClose(); }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold w-full transition-all hover:opacity-80"
                        style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', color: 'var(--brand-green)' }}>
                        <Icon name="FileText" size={13} />
                        Открыть транскрипт звонка
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

// ── Кликабельная KPI-карточка ─────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color, filter, filterLabel, onClick }: {
  icon: string; label: string; value: string; sub?: string; color?: string;
  filter?: string; filterLabel?: string; onClick?: (f: string, t: string) => void;
}) {
  const clickable = !!filter && !!onClick;
  return (
    <div
      onClick={() => clickable && onClick!(filter!, filterLabel || label)}
      className={`rounded-2xl p-5 transition-all ${clickable ? 'cursor-pointer hover:scale-[1.02] hover:shadow-lg' : ''}`}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${clickable ? `${color || 'var(--border-default)'}40` : 'var(--border-default)'}`,
        boxShadow: clickable ? `0 0 0 0 ${color || 'transparent'}` : 'none',
      }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon name={icon} size={14} style={{ color: color || 'var(--text-muted)' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
        {clickable && (
          <Icon name="ChevronRight" size={11} style={{ color: 'var(--text-muted)', marginLeft: 'auto', opacity: 0.5 }} />
        )}
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
  onGoToTranscription?: (commId?: string) => void;
}

export default function AiInsightsKpi({
  stats, pendingCount, batchRunning, batchDone, batchTotal, batchCurrent,
  onBatchAnalyze, onStopBatch, onRefresh, onGoToTranscription,
}: Props) {
  const [modal, setModal] = useState<{ filter: string; title: string } | null>(null);

  const openModal = (filter: string, title: string) => setModal({ filter, title });

  return (
    <>
      {/* Заголовок */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            Аналитика ИИ
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            На основе {stats.total} звонков
            <span className="hidden sm:inline" style={{ opacity: 0.6 }}> · нажмите на карточку чтобы увидеть звонки</span>
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
              <span className="text-xs truncate max-w-[120px] sm:max-w-none" style={{ color: 'var(--brand-green)' }}>
                {batchDone}/{batchTotal}
                <span className="hidden sm:inline"> · {batchCurrent}</span>
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

      {/* KPI — кликабельные карточки */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon="Target" label="Целевых звонков" value={`${stats.target_rate}%`}
          sub={`${stats.target_count} из ${stats.total}`} color="var(--brand-green)"
          filter="target" filterLabel="Целевые звонки" onClick={openModal} />
        <StatCard icon="UserCheck" label="Квалифицировано" value={`${stats.qualification_rate}%`}
          sub={`${stats.qualified_count} клиентов`} color="#00aaff"
          filter="qualified" filterLabel="Квалифицированные клиенты" onClick={openModal} />
        <StatCard icon="TrendingUp" label="Конверсия в успех" value={`${stats.conversion_rate}%`}
          sub={`${stats.success_count} успешных`}
          color={stats.conversion_rate >= 20 ? 'var(--brand-green)' : stats.conversion_rate >= 10 ? '#ff8c00' : '#ff4444'}
          filter="success" filterLabel="Успешные звонки" onClick={openModal} />
        <StatCard icon="Star" label="Ср. оценка оператора" value={`${stats.avg_operator_score}/10`}
          sub={`скрипт: ${stats.script_rate}%`}
          color={stats.avg_operator_score >= 8 ? 'var(--brand-green)' : stats.avg_operator_score >= 6 ? '#ff8c00' : '#ff4444'}
          filter="high_score" filterLabel="Лучшие звонки (оценка 8+)" onClick={openModal} />
      </div>

      {/* Модалка */}
      {modal && (
        <CallsModal
          filter={modal.filter}
          title={modal.title}
          onClose={() => setModal(null)}
          onGoToTranscription={onGoToTranscription}
        />
      )}
    </>
  );
}