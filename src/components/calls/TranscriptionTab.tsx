import { useState, useEffect, useRef } from 'react';
import { type CallRecord } from '@/lib/dataParser';
import Icon from '@/components/ui/icon';
import {
  TRANSCRIBE_URL, ANALYZE_URL, BATCH_STATUS_URL,
  type TranscriptResult,
} from '@/components/calls/transcriptionTypes';
import CallsList from '@/components/calls/CallsList';
import CallTranscriptView from '@/components/calls/CallTranscriptView';

const IGNORE_KEY = 'ignored_calls';
const IGNORE_REASONS = [
  { id: 'wrong_speakers', label: 'Перепутаны оператор и клиент', icon: 'ArrowLeftRight' },
  { id: 'client_pitches', label: 'Клиент нас питчит (спам/продажи)', icon: 'UserX' },
  { id: 'wrong_number',   label: 'Ошибочный номер', icon: 'PhoneOff' },
  { id: 'test_call',      label: 'Тестовый звонок', icon: 'FlaskConical' },
  { id: 'bad_quality',    label: 'Плохое качество записи', icon: 'VolumeX' },
  { id: 'other',          label: 'Другое', icon: 'MoreHorizontal' },
];

type IgnoreMap = Record<string, string>; // comm_id → reason_id

type DoneMap = Record<string, {
  replica_count: number; operator_replicas: number; client_replicas: number;
  ai?: { outcome?: string; call_type?: string; qualification?: boolean; client_interest?: string };
}>;

export default function TranscriptionTab({ calls, initialCommId, onAnalysisDone }: { calls: CallRecord[]; initialCommId?: string; onAnalysisDone?: () => void }) {
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [showIgnoreMenu, setShowIgnoreMenu] = useState(false);
  const LS_KEY = 'transcription_done_map';

  // Игнорируемые звонки
  const loadIgnoreMap = (): IgnoreMap => {
    try { return JSON.parse(localStorage.getItem(IGNORE_KEY) || '{}'); } catch { return {}; }
  };
  const [ignoreMap, setIgnoreMap] = useState<IgnoreMap>(loadIgnoreMap);

  const ignoreCall = (comm_id: string, reason_id: string) => {
    setIgnoreMap(prev => {
      const next = { ...prev, [comm_id]: reason_id };
      try { localStorage.setItem(IGNORE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    setShowIgnoreMenu(false);
  };

  const unignoreCall = (comm_id: string) => {
    setIgnoreMap(prev => {
      const next = { ...prev };
      delete next[comm_id];
      try { localStorage.setItem(IGNORE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const DELETE_KEY = 'calls_hidden_ids';
  const loadDeleted = (): Set<string> => {
    try { return new Set(JSON.parse(localStorage.getItem(DELETE_KEY) || '[]')); } catch { return new Set(); }
  };
  const [deletedIds, setDeletedIds] = useState<Set<string>>(loadDeleted);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deleteCall = (comm_id: string) => {
    // Убираем из deletedIds
    setDeletedIds(prev => {
      const next = new Set(prev); next.add(comm_id);
      try { localStorage.setItem(DELETE_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
    // Убираем из doneMap
    setDoneMap(prev => {
      const next = { ...prev }; delete next[comm_id]; return next;
    });
    // Убираем из ignoreMap
    setIgnoreMap(prev => {
      const next = { ...prev }; delete next[comm_id];
      try { localStorage.setItem(IGNORE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    setSelectedCall(null);
    setResult(null);
    setShowDeleteConfirm(false);
  };

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
      // Сохраняем ai-данные в doneMap чтобы статус отображался в списке
      setDoneMap(prev => ({
        ...prev,
        [selectedCall.comm_id]: {
          ...(prev[selectedCall.comm_id] || { replica_count: 0, operator_replicas: 0, client_replicas: 0 }),
          ai: {
            outcome:         analysis.outcome,
            call_type:       analysis.call_type,
            qualification:   analysis.qualification,
            client_interest: analysis.client_interest,
          },
        },
      }));
      onAnalysisDone?.();
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
          calls={calls.filter(c => !deletedIds.has(c.comm_id))}
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
            <div className="flex items-center justify-between mb-5 gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
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
                  {ignoreMap[selectedCall.comm_id] && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(255,140,0,0.12)', color: '#ff8c00' }}>
                      <Icon name="EyeOff" size={10} />
                      Игнорируется
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  ID: {selectedCall.comm_id} · {selectedCall.call_type}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">

                {/* Кнопка Игнорировать */}
                <div className="relative">
                  {ignoreMap[selectedCall.comm_id] ? (
                    <button
                      onClick={() => unignoreCall(selectedCall.comm_id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
                      style={{ background: 'rgba(255,140,0,0.1)', border: '1px solid rgba(255,140,0,0.25)', color: '#ff8c00' }}>
                      <Icon name="Eye" size={12} />
                      Восстановить
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowIgnoreMenu(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                      <Icon name="EyeOff" size={12} />
                      Игнорировать
                    </button>
                  )}

                  {/* Дропдаун причин */}
                  {showIgnoreMenu && (
                    <div className="absolute right-0 top-full mt-1 w-64 rounded-xl overflow-hidden z-30 shadow-2xl"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                      <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Причина игнорирования</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Звонок будет исключён из аналитики</p>
                      </div>
                      {IGNORE_REASONS.map(r => (
                        <button key={r.id}
                          onClick={() => ignoreCall(selectedCall.comm_id, r.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <Icon name={r.icon} size={13} style={{ color: '#ff8c00', flexShrink: 0 }} />
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
                        </button>
                      ))}
                      <button
                        onClick={() => setShowIgnoreMenu(false)}
                        className="w-full px-3 py-2 text-xs text-center transition-colors hover:bg-white/5"
                        style={{ color: 'var(--text-muted)' }}>
                        Отмена
                      </button>
                    </div>
                  )}
                </div>

                {/* Кнопка Удалить */}
                <div className="relative">
                  <button
                    onClick={() => setShowDeleteConfirm(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
                    style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.25)', color: '#ff4444' }}>
                    <Icon name="Trash2" size={12} />
                    Удалить
                  </button>
                  {showDeleteConfirm && (
                    <div className="absolute right-0 top-full mt-1 w-60 rounded-xl z-30 shadow-2xl p-4 space-y-3"
                      style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,68,68,0.3)' }}>
                      <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Удалить звонок?</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Звонок исчезнет из списка транскрибации. Вернуть нельзя.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => deleteCall(selectedCall.comm_id)}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                          style={{ background: '#ff4444', color: '#fff' }}>
                          Удалить
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="flex-1 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
                          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                          Отмена
                        </button>
                      </div>
                    </div>
                  )}
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
            </div>

            {/* Баннер если игнорируется */}
            {ignoreMap[selectedCall.comm_id] && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4"
                style={{ background: 'rgba(255,140,0,0.06)', border: '1px solid rgba(255,140,0,0.2)' }}>
                <Icon name="EyeOff" size={15} style={{ color: '#ff8c00', flexShrink: 0 }} />
                <div className="flex-1">
                  <p className="text-xs font-semibold" style={{ color: '#ff8c00' }}>Звонок исключён из аналитики</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Причина: {IGNORE_REASONS.find(r => r.id === ignoreMap[selectedCall.comm_id])?.label || 'Другое'}
                  </p>
                </div>
                <button onClick={() => unignoreCall(selectedCall.comm_id)}
                  className="text-xs px-2 py-1 rounded-lg transition-opacity hover:opacity-70"
                  style={{ background: 'rgba(255,140,0,0.15)', color: '#ff8c00' }}>
                  Восстановить
                </button>
              </div>
            )}

            <CallTranscriptView
              result={result}
              onAnalyze={handleAnalyze}
              onResultUpdate={(updated) => setResult(prev => prev ? { ...prev, ...updated } : null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}