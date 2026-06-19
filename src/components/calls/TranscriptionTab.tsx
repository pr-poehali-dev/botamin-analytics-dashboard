import { useState } from 'react';
import { type CallRecord } from '@/lib/dataParser';
import Icon from '@/components/ui/icon';
import {
  TRANSCRIBE_URL, ANALYZE_URL,
  type TranscriptResult,
} from '@/components/calls/transcriptionTypes';
import CallsList from '@/components/calls/CallsList';
import CallTranscriptView from '@/components/calls/CallTranscriptView';

export default function TranscriptionTab({ calls }: { calls: CallRecord[] }) {
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [result, setResult] = useState<TranscriptResult | null>(null);

  const handleTranscribe = async (call: CallRecord) => {
    setSelectedCall(call);
    setResult({ comm_id: call.comm_id, full_text: '', replicas: [], replica_count: 0, operator_replicas: 0, client_replicas: 0, status: 'transcribing' });

    try {
      const res = await fetch(TRANSCRIBE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_url: call.record_url,
          comm_id: call.comm_id,
          date: call.date,
          duration: call.duration,
          duration_sec: call.duration_sec,
        }),
      });
      const data = await res.json();

      if (data.status === 'pending') {
        setResult(prev => prev ? { ...prev, status: 'error', error: 'Звонок слишком длинный для быстрой обработки. Попробуйте позже.' } : null);
        return;
      }
      if (data.error) {
        setResult(prev => prev ? { ...prev, status: 'error', error: data.error } : null);
        return;
      }

      setResult({
        comm_id: call.comm_id,
        full_text: data.full_text || '',
        replicas: data.replicas || [],
        replica_count: data.replica_count || 0,
        operator_replicas: data.operator_replicas || 0,
        client_replicas: data.client_replicas || 0,
        status: 'done',
        cached: data.cached === true,
      });
    } catch {
      setResult(prev => prev ? { ...prev, status: 'error', error: 'Ошибка соединения' } : null);
    }
  };

  const handleAnalyze = async () => {
    if (!result || !selectedCall) return;
    setResult(prev => prev ? { ...prev, status: 'analyzing' } : null);

    try {
      const res = await fetch(ANALYZE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: result.full_text,
          comm_id: selectedCall.comm_id,
          duration_sec: selectedCall.duration_sec,
        }),
      });
      const analysis = await res.json();
      setResult(prev => prev ? { ...prev, status: 'done', cached: prev.cached, analysis } : null);
    } catch {
      setResult(prev => prev ? { ...prev, status: 'done' } : null);
    }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-120px)]">

      {/* Левая панель — список звонков */}
      <CallsList
        calls={calls}
        selectedCall={selectedCall}
        result={result}
        onSelect={handleTranscribe}
      />

      {/* Правая панель — результат */}
      <div className="flex-1 overflow-y-auto">
        {!selectedCall && (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--brand-green-muted)' }}>
              <Icon name="Mic" size={28} style={{ color: 'var(--brand-green)' }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                Выберите звонок
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Нажмите на звонок слева — откроется транскрипт и ИИ-анализ
              </p>
            </div>
          </div>
        )}

        {selectedCall && result && (
          <div>
            {/* Заголовок */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    Звонок {selectedCall.date} · {selectedCall.duration}
                  </h3>
                  {result.cached && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--brand-green)' }}>
                      <Icon name="Database" size={10} />
                      из кэша
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  ID: {selectedCall.comm_id} · {selectedCall.call_type}
                </p>
              </div>
              {selectedCall.record_url && (
                <a href={selectedCall.record_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                  <Icon name="Play" size={12} />
                  Слушать
                </a>
              )}
            </div>

            {result.status === 'transcribing' && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-3 h-3 rounded-full animate-pulse"
                      style={{ background: 'var(--brand-green)', animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Yandex SpeechKit транскрибирует звонок…
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Обычно занимает 10–30 секунд
                </p>
              </div>
            )}

            {result.status === 'error' && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Icon name="AlertTriangle" size={32} style={{ color: '#ff4444' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Ошибка транскрибации</p>
                {result.error === 'rate_limit' ? (
                  <div className="text-center max-w-sm space-y-2">
                    <p className="text-sm font-medium" style={{ color: '#ff8c00' }}>
                      Исчерпан лимит Yandex SpeechKit
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      500 запросов в час — лимит исчерпан из-за тестовых запросов.
                    </p>
                    <p className="text-xs px-4 py-2 rounded-lg"
                      style={{ background: 'rgba(255,140,0,0.1)', color: '#ff8c00' }}>
                      Квота сбрасывается в начале каждого часа.<br/>
                      Попробуйте снова через несколько минут.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-center max-w-sm" style={{ color: 'var(--text-muted)' }}>{result.error}</p>
                )}
                <button onClick={() => handleTranscribe(selectedCall)}
                  className="px-4 py-2 rounded-lg text-xs font-medium mt-2"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                  Попробовать снова
                </button>
              </div>
            )}

            {(result.status === 'done' || result.status === 'analyzing') && result.replica_count > 0 && (
              <CallTranscriptView result={result} onAnalyze={handleAnalyze} />
            )}

            {result.status === 'done' && result.replica_count === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Icon name="FileX" size={32} style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Транскрипт пуст — возможно, запись недоступна</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
