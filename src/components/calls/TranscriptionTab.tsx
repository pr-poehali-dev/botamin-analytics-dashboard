import { useState, useEffect, useRef } from 'react';
import { type CallRecord } from '@/lib/dataParser';
import Icon from '@/components/ui/icon';
import {
  TRANSCRIBE_URL, ANALYZE_URL, BATCH_STATUS_URL,
  type TranscriptResult,
} from '@/components/calls/transcriptionTypes';
import CallsList from '@/components/calls/CallsList';
import CallTranscriptView from '@/components/calls/CallTranscriptView';

type DoneMap = Record<string, { replica_count: number; operator_replicas: number; client_replicas: number }>;

export default function TranscriptionTab({ calls, initialCommId }: { calls: CallRecord[]; initialCommId?: string }) {
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const LS_KEY = 'transcription_done_map';

  const loadLocalDoneMap = (): DoneMap => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (_e) { return {}; }
  };
  const saveLocalDoneMap = (map: DoneMap) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(map)); } catch (_e) { /* ignore */ }
  };

  const [doneMap, setDoneMapState] = useState<DoneMap>(loadLocalDoneMap);

  const setDoneMap = (updater: DoneMap | ((prev: DoneMap) => DoneMap)) => {
    setDoneMapState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLocalDoneMap(next);
      return next;
    });
  };

  // Батч-очередь
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchTotal, setBatchTotal]     = useState(0);
  const [batchDone, setBatchDone]       = useState(0);
  const [batchCurrent, setBatchCurrent] = useState('');
  const batchStopRef = useRef(false);

  // Загружаем статусы из БД при старте и мержим с localStorage
  useEffect(() => {
    fetch(BATCH_STATUS_URL)
      .then(r => r.json())
      .then(d => {
        if (d.done) {
          setDoneMap(prev => {
            const merged = { ...prev, ...d.done };
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);

  // Автооткрытие звонка если передан initialCommId
  useEffect(() => {
    if (!initialCommId || !calls.length) return;
    const call = calls.find(c => c.comm_id === initialCommId);
    if (call) handleTranscribe(call);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCommId, calls]);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const transcribeOne = async (call: CallRecord): Promise<TranscriptResult | null> => {
    try {
      const res = await fetch(TRANSCRIBE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_url:    call.record_url,
          comm_id:      call.comm_id,
          date:         call.date,
          duration:     call.duration,
          duration_sec: call.duration_sec,
        }),
      });
      const data = await res.json();
      if (data.error) return null;

      if (data.status === 'processing') {
        for (let i = 0; i < 15; i++) {
          await sleep(5000);
          const pollRes = await fetch(`${TRANSCRIBE_URL}?comm_id=${call.comm_id}`);
          const pollData = await pollRes.json();
          if (pollData.status === 'done' && pollData.replica_count > 0) {
            return { comm_id: call.comm_id, full_text: pollData.full_text || '', replicas: pollData.replicas || [],
              replica_count: pollData.replica_count || 0, operator_replicas: pollData.operator_replicas || 0,
              client_replicas: pollData.client_replicas || 0, has_ivr: pollData.has_ivr, status: 'done', cached: false };
          }
          if (pollData.error) return null;
        }
        return null;
      }

      if (data.status === 'done' && (data.replica_count > 0 || data.all_ivr)) {
        return { comm_id: call.comm_id, full_text: data.full_text || '', replicas: data.replicas || [],
          replica_count: data.replica_count || 0, operator_replicas: data.operator_replicas || 0,
          client_replicas: data.client_replicas || 0, has_ivr: data.has_ivr, status: 'done', cached: data.cached === true };
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleTranscribe = async (call: CallRecord) => {
    setSelectedCall(call);

    // Если уже есть в doneMap — загружаем из кэша
    if (doneMap[call.comm_id]) {
      setResult({ comm_id: call.comm_id, full_text: '', replicas: [], status: 'transcribing',
        replica_count: 0, operator_replicas: 0, client_replicas: 0 });
      const res = await fetch(`${TRANSCRIBE_URL}?comm_id=${call.comm_id}`);
      const data = await res.json();
      if (data.replicas) {
        setResult({ comm_id: call.comm_id, full_text: data.full_text || '', replicas: data.replicas || [],
          replica_count: data.replica_count || 0, operator_replicas: data.operator_replicas || 0,
          client_replicas: data.client_replicas || 0, has_ivr: data.has_ivr, status: 'done', cached: true });
      }
      return;
    }

    setResult({ comm_id: call.comm_id, full_text: '', replicas: [], replica_count: 0,
      operator_replicas: 0, client_replicas: 0, status: 'transcribing' });

    try {
      const res = await fetch(TRANSCRIBE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_url: call.record_url, comm_id: call.comm_id,
          date: call.date, duration: call.duration, duration_sec: call.duration_sec,
        }),
      });
      const data = await res.json();

      if (data.error) {
        setResult(prev => prev ? { ...prev, status: 'error', error: data.error } : null);
        return;
      }

      if (data.status === 'processing') {
        for (let i = 0; i < 24; i++) {
          await sleep(5000);
          const pollRes  = await fetch(`${TRANSCRIBE_URL}?comm_id=${call.comm_id}`);
          const pollData = await pollRes.json();
          if (pollData.status === 'done' && pollData.replica_count > 0) {
            const r: TranscriptResult = { comm_id: call.comm_id, full_text: pollData.full_text || '',
              replicas: pollData.replicas || [], replica_count: pollData.replica_count || 0,
              operator_replicas: pollData.operator_replicas || 0, client_replicas: pollData.client_replicas || 0,
              has_ivr: pollData.has_ivr, status: 'done', cached: false };
            setResult(r);
            setDoneMap(prev => ({ ...prev, [call.comm_id]: { replica_count: r.replica_count, operator_replicas: r.operator_replicas, client_replicas: r.client_replicas } }));
            return;
          }
          if (pollData.error) { setResult(prev => prev ? { ...prev, status: 'error', error: pollData.error } : null); return; }
        }
        setResult(prev => prev ? { ...prev, status: 'error', error: 'Звонок долго обрабатывается, попробуйте позже' } : null);
        return;
      }

      const r: TranscriptResult = { comm_id: call.comm_id, full_text: data.full_text || '',
        replicas: data.replicas || [], replica_count: data.replica_count || 0,
        operator_replicas: data.operator_replicas || 0, client_replicas: data.client_replicas || 0,
        has_ivr: data.has_ivr, status: 'done', cached: data.cached === true };
      setResult(r);
      setDoneMap(prev => ({ ...prev, [call.comm_id]: { replica_count: r.replica_count, operator_replicas: r.operator_replicas, client_replicas: r.client_replicas } }));
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
        body: JSON.stringify({ transcript: result.full_text, comm_id: selectedCall.comm_id, duration_sec: selectedCall.duration_sec }),
      });
      const analysis = await res.json();
      setResult(prev => prev ? { ...prev, status: 'done', cached: prev.cached, analysis } : null);
    } catch {
      setResult(prev => prev ? { ...prev, status: 'done' } : null);
    }
  };

  // Батч: транскрибируем все нетранскрибированные по очереди
  const handleBatchStart = async () => {
    const pending = calls.filter(c => c.record_url && !doneMap[c.comm_id]);
    if (!pending.length) return;

    batchStopRef.current = false;
    setBatchRunning(true);
    setBatchTotal(pending.length);
    setBatchDone(0);

    for (let i = 0; i < pending.length; i++) {
      if (batchStopRef.current) break;
      const call = pending[i];
      setBatchCurrent(call.comm_id);
      const r = await transcribeOne(call);
      if (r) {
        setDoneMap(prev => ({ ...prev, [call.comm_id]: { replica_count: r.replica_count, operator_replicas: r.operator_replicas, client_replicas: r.client_replicas } }));
      }
      setBatchDone(i + 1);
      if (i < pending.length - 1) await sleep(1000);
    }

    setBatchRunning(false);
    setBatchCurrent('');
    batchStopRef.current = false;
  };

  const handleBatchStop = () => { batchStopRef.current = true; };

  const callsWithRecords = calls.filter(c => c.record_url).length;
  const doneCount = Object.keys(doneMap).length;

  return (
    <div className="flex gap-6 h-[calc(100vh-120px)]">

      {/* Левая панель */}
      <div className="w-72 shrink-0 flex flex-col gap-3">

        {/* Заголовок + прогресс */}
        <div>
          <h2 className="text-sm font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>Транскрибация</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {callsWithRecords} звонков с записью · <span style={{ color: 'var(--brand-green)' }}>{doneCount} готово</span>
          </p>
        </div>

        {/* Батч-кнопка */}
        {!batchRunning ? (
          <button
            onClick={handleBatchStart}
            disabled={doneCount === callsWithRecords}
            className="w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
            style={{
              background: doneCount === callsWithRecords ? 'var(--bg-elevated)' : 'var(--brand-green)',
              color: doneCount === callsWithRecords ? 'var(--text-muted)' : '#000',
              cursor: doneCount === callsWithRecords ? 'default' : 'pointer',
            }}>
            <Icon name="PlayCircle" size={13} />
            {doneCount === callsWithRecords ? 'Всё транскрибировано' : `Транскрибировать все (${callsWithRecords - doneCount})`}
          </button>
        ) : (
          <div className="rounded-lg p-2.5 space-y-2" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: 'var(--brand-green)' }}>
                {batchDone} / {batchTotal}
              </span>
              <button onClick={handleBatchStop} className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(255,68,68,0.1)', color: '#ff4444' }}>
                Стоп
              </button>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-default)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${batchTotal ? (batchDone / batchTotal) * 100 : 0}%`, background: 'var(--brand-green)' }} />
            </div>
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              ID: {batchCurrent}
            </p>
          </div>
        )}

        <CallsList
          calls={calls}
          selectedCall={selectedCall}
          result={result}
          doneMap={doneMap}
          onSelect={handleTranscribe}
        />
      </div>

      {/* Правая панель */}
      <div className="flex-1 overflow-y-auto">
        {!selectedCall && (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--brand-green-muted)' }}>
              <Icon name="Mic" size={28} style={{ color: 'var(--brand-green)' }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Выберите звонок</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Нажмите на звонок слева — откроется транскрипт и ИИ-анализ
              </p>
            </div>
          </div>
        )}

        {selectedCall && result && (
          <div>
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
            <CallTranscriptView result={result} onAnalyze={handleAnalyze} />
          </div>
        )}
      </div>
    </div>
  );
}