import { useState, useEffect } from 'react';
import { type CallRecord } from '@/lib/dataParser';
import Icon from '@/components/ui/icon';
import { TRANSCRIBE_URL, type TranscriptResult, type Replica } from '@/components/calls/transcriptionTypes';

export default function CallsTranscriptModal({ call, onClose }: { call: CallRecord; onClose: () => void }) {
  const [result, setResult] = useState<TranscriptResult | null>(null);

  useEffect(() => {
    setResult({ comm_id: call.comm_id, full_text: '', replicas: [], replica_count: 0, operator_replicas: 0, client_replicas: 0, status: 'transcribing' });
    fetch(`${TRANSCRIBE_URL}?comm_id=${call.comm_id}`)
      .then(r => r.json())
      .then(d => {
        if (d.replicas) {
          setResult({ comm_id: call.comm_id, full_text: d.full_text || '', replicas: d.replicas || [],
            replica_count: d.replica_count || 0, operator_replicas: d.operator_replicas || 0,
            client_replicas: d.client_replicas || 0, has_ivr: d.has_ivr, status: 'done', cached: true });
        } else {
          setResult(prev => prev ? { ...prev, status: 'error', error: 'Не удалось загрузить' } : null);
        }
      })
      .catch(() => setResult(prev => prev ? { ...prev, status: 'error', error: 'Ошибка соединения' } : null));
  }, [call.comm_id]);

  const ivrReplicas  = result?.replicas.filter((r: Replica) => r.segment === 'ivr') || [];
  const liveReplicas = result?.replicas.filter((r: Replica) => r.segment === 'live' || !r.segment) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border-default)' }}>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Транскрипт · {call.date} · {call.duration}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              ID: {call.comm_id} · {call.call_type}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {call.record_url && (
              <a href={call.record_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                <Icon name="Play" size={12} />
                Слушать
              </a>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
              <Icon name="X" size={14} />
            </button>
          </div>
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {result?.status === 'transcribing' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex gap-1.5">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full animate-pulse"
                    style={{ background: 'var(--brand-green)', animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Загружаю транскрипт…</p>
            </div>
          )}

          {result?.status === 'error' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Icon name="AlertTriangle" size={28} style={{ color: '#ff4444' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{result.error}</p>
            </div>
          )}

          {result?.status === 'done' && (
            <div className="space-y-4">
              {/* Статы */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Реплик всего', value: result.replica_count },
                  { label: 'Оператор',     value: result.operator_replicas },
                  { label: 'Клиент',       value: result.client_replicas },
                ].map(s => (
                  <div key={s.label} className="rounded-xl px-3 py-2.5 text-center"
                    style={{ background: 'var(--bg-elevated)' }}>
                    <p className="text-lg font-bold" style={{ color: 'var(--brand-green)' }}>{s.value}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* IVR */}
              {ivrReplicas.length > 0 && (
                <div className="rounded-xl px-4 py-3"
                  style={{ background: 'rgba(255,140,0,0.06)', border: '1px solid rgba(255,140,0,0.2)' }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#ff8c00' }}>🤖 Автоответчик</p>
                  {ivrReplicas.map((r, i) => (
                    <p key={i} className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{r.text}</p>
                  ))}
                </div>
              )}

              {/* Живой разговор */}
              <div className="space-y-2">
                {liveReplicas.map((r: Replica, i: number) => {
                  const isOp = r.speaker === 'operator';
                  return (
                    <div key={i} className={`flex gap-2.5 ${isOp ? 'justify-end' : 'justify-start'}`}>
                      {!isOp && (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                          style={{ background: 'rgba(0,170,255,0.15)', color: '#00aaff' }}>К</div>
                      )}
                      <div className="max-w-[75%] px-3 py-2 rounded-xl"
                        style={{ background: isOp ? 'rgba(0,255,136,0.08)' : 'var(--bg-elevated)' }}>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>{r.text}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{r.start_time}с</p>
                      </div>
                      {isOp && (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                          style={{ background: 'rgba(0,255,136,0.15)', color: 'var(--brand-green)' }}>О</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
