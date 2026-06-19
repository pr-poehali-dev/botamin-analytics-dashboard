import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { type TranscriptResult, type Replica } from '@/components/calls/transcriptionTypes';
import CallAnalysisCard from '@/components/calls/CallAnalysisCard';

export default function CallTranscriptView({ result, onAnalyze }: { result: TranscriptResult; onAnalyze: () => void }) {
  const [showReplicas, setShowReplicas] = useState(true);
  const [showIvr, setShowIvr] = useState(false);

  const ivrReplicas = result.replicas.filter((r: Replica) => r.segment === 'ivr');
  const liveReplicas = result.replicas.filter((r: Replica) => r.segment === 'live' || !r.segment);
  const hasIvr = result.has_ivr && ivrReplicas.length > 0;

  const renderReplica = (r: Replica, i: number) => {
    const isOperator = r.speaker === 'operator';
    return (
      <div key={i} className={`flex gap-3 ${isOperator ? 'justify-end' : 'justify-start'}`}>
        {!isOperator && (
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
            style={{ background: 'rgba(0,170,255,0.2)', color: '#00aaff' }}>
            К
          </div>
        )}
        <div className="max-w-[75%]">
          <div className={`text-xs mb-0.5 ${isOperator ? 'text-right' : ''}`} style={{ color: 'var(--text-muted)' }}>
            {r.speaker_label} · {r.start_time}с
          </div>
          <div className="px-3 py-2 rounded-xl text-xs leading-relaxed"
            style={{
              background: isOperator ? 'rgba(0,255,136,0.1)' : 'var(--bg-elevated)',
              color: 'var(--text-primary)',
            }}>
            {r.text}
          </div>
        </div>
        {isOperator && (
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
            style={{ background: 'rgba(0,255,136,0.2)', color: 'var(--brand-green)' }}>
            О
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Статистика */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Реплик всего', val: result.replica_count },
          { label: 'Оператор', val: result.operator_replicas },
          { label: 'Клиент', val: result.client_replicas },
        ].map((s, i) => (
          <div key={i} className="p-3 rounded-xl text-center" style={{ background: 'var(--bg-elevated)' }}>
            <div className="text-lg font-black font-mono" style={{ color: 'var(--brand-green)' }}>{s.val}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Кнопка анализа */}
      {!result.analysis && result.status !== 'analyzing' && (
        <button onClick={onAnalyze}
          className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90"
          style={{ background: 'var(--brand-green)', color: '#000' }}>
          <Icon name="Sparkles" size={16} />
          Анализировать через ИИ
        </button>
      )}
      {result.status === 'analyzing' && (
        <div className="w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: 'var(--brand-green)', animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          ИИ анализирует звонок…
        </div>
      )}

      {/* Результат анализа */}
      {result.analysis && <CallAnalysisCard analysis={result.analysis} />}

      {/* Диалог */}
      <div>
        <button onClick={() => setShowReplicas(v => !v)}
          className="flex items-center gap-2 text-xs mb-3 transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-muted)' }}>
          <Icon name={showReplicas ? 'ChevronUp' : 'ChevronDown'} size={13} />
          {showReplicas ? 'Скрыть' : 'Показать'} транскрипт ({result.replica_count} реплик)
        </button>

        {showReplicas && (
          <div className="space-y-2 overflow-y-auto pr-1">

            {/* IVR блок */}
            {hasIvr && (
              <div className="mb-3">
                <button
                  onClick={() => setShowIvr(v => !v)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg mb-2 transition-opacity hover:opacity-80"
                  style={{ background: 'rgba(255,170,0,0.08)', border: '1px solid rgba(255,170,0,0.2)' }}>
                  <Icon name="Bot" size={13} />
                  <span className="text-xs font-medium" style={{ color: '#ffaa00' }}>
                    Автоответчик · {ivrReplicas.length} реплик
                  </span>
                  <Icon name={showIvr ? 'ChevronUp' : 'ChevronDown'} size={12} style={{ marginLeft: 'auto', color: '#ffaa00' }} />
                </button>
                {showIvr && (
                  <div className="space-y-2 pl-2 opacity-60">
                    {ivrReplicas.map((r: Replica, i: number) => renderReplica(r, i))}
                  </div>
                )}

                {/* Разделитель */}
                <div className="flex items-center gap-2 my-3">
                  <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
                  <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--brand-green)', border: '1px solid rgba(0,255,136,0.2)' }}>
                    <Icon name="User" size={11} />
                    Живой разговор
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
                </div>
              </div>
            )}

            {/* Живые реплики */}
            {liveReplicas.map((r: Replica, i: number) => renderReplica(r, i))}
          </div>
        )}
      </div>
    </div>
  );
}
