import { useState, useEffect, useRef } from 'react';
import { type CallRecord } from '@/lib/dataParser';
import {
  TRANSCRIBE_URL, ANALYZE_URL, BATCH_STATUS_URL,
  type TranscriptResult,
} from '@/components/calls/transcriptionTypes';

export const IGNORE_KEY = 'ignored_calls';
export const IGNORE_REASONS = [
  { id: 'wrong_speakers', label: 'Перепутаны оператор и клиент', icon: 'ArrowLeftRight' },
  { id: 'client_pitches', label: 'Клиент нас питчит (спам/продажи)', icon: 'UserX' },
  { id: 'wrong_number',   label: 'Ошибочный номер', icon: 'PhoneOff' },
  { id: 'test_call',      label: 'Тестовый звонок', icon: 'FlaskConical' },
  { id: 'bad_quality',    label: 'Плохое качество записи', icon: 'VolumeX' },
  { id: 'other',          label: 'Другое', icon: 'MoreHorizontal' },
];

export type IgnoreMap = Record<string, string>;

export type DoneMap = Record<string, {
  replica_count: number; operator_replicas: number; client_replicas: number;
  ai?: { outcome?: string; call_type?: string; qualification?: boolean; client_interest?: string };
}>;

const LS_KEY = 'transcription_done_map';

const loadLocalDoneMap = (): DoneMap => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
};
const saveLocalDoneMap = (map: DoneMap) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(map)); } catch { /* ignore */ }
};

const loadIgnoreMap = (): IgnoreMap => {
  try { return JSON.parse(localStorage.getItem(IGNORE_KEY) || '{}'); } catch { return {}; }
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export interface TranscriptionState {
  selectedCall: CallRecord | null;
  result: TranscriptResult | null;
  doneMap: DoneMap;
  ignoreMap: IgnoreMap;
  batchRunning: boolean;
  batchTotal: number;
  batchDone: number;
  batchCurrent: string;
  handleTranscribe: (call: CallRecord) => Promise<void>;
  handleAnalyze: () => Promise<void>;
  handleBatchStart: () => Promise<void>;
  handleBatchStop: () => void;
  ignoreCall: (comm_id: string, reason_id: string) => void;
  unignoreCall: (comm_id: string) => void;
  deleteCall: (comm_id: string) => void;
  setResult: React.Dispatch<React.SetStateAction<TranscriptResult | null>>;
}

export function useTranscriptionState({
  calls,
  onHideCall,
  initialCommId,
  onAnalysisDone,
}: {
  calls: CallRecord[];
  onHideCall?: (id: string) => void;
  initialCommId?: string;
  onAnalysisDone?: () => void;
}): TranscriptionState {
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [result, setResult]             = useState<TranscriptResult | null>(null);
  const [ignoreMap, setIgnoreMap]       = useState<IgnoreMap>(loadIgnoreMap);
  const [doneMapState, setDoneMapState] = useState<DoneMap>(loadLocalDoneMap);

  const [batchRunning, setBatchRunning] = useState(false);
  const [batchTotal, setBatchTotal]     = useState(0);
  const [batchDone, setBatchDone]       = useState(0);
  const [batchCurrent, setBatchCurrent] = useState('');
  const batchStopRef = useRef(false);

  const setDoneMap = (updater: DoneMap | ((prev: DoneMap) => DoneMap)) => {
    setDoneMapState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLocalDoneMap(next);
      return next;
    });
  };

  useEffect(() => {
    fetch(BATCH_STATUS_URL)
      .then(r => r.json())
      .then(d => {
        if (d.done) setDoneMap(prev => ({ ...prev, ...d.done }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!initialCommId || !calls.length) return;
    const call = calls.find(c => c.comm_id === initialCommId);
    if (call) handleTranscribe(call);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCommId, calls]);

  const transcribeOne = async (call: CallRecord): Promise<TranscriptResult | null> => {
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
      if (data.error) return null;

      if (data.status === 'processing') {
        for (let i = 0; i < 15; i++) {
          await sleep(5000);
          const pollRes  = await fetch(`${TRANSCRIBE_URL}?comm_id=${call.comm_id}`);
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

    if (doneMapState[call.comm_id]) {
      setResult({ comm_id: call.comm_id, full_text: '', replicas: [], status: 'transcribing',
        replica_count: 0, operator_replicas: 0, client_replicas: 0 });
      const res  = await fetch(`${TRANSCRIBE_URL}?comm_id=${call.comm_id}`);
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

  const handleBatchStart = async () => {
    const pending = calls.filter(c => c.record_url && !doneMapState[c.comm_id]);
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

  const ignoreCall = (comm_id: string, reason_id: string) => {
    setIgnoreMap(prev => {
      const next = { ...prev, [comm_id]: reason_id };
      try { localStorage.setItem(IGNORE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const unignoreCall = (comm_id: string) => {
    setIgnoreMap(prev => {
      const next = { ...prev };
      delete next[comm_id];
      try { localStorage.setItem(IGNORE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const deleteCall = (comm_id: string) => {
    onHideCall?.(comm_id);
    setDoneMap(prev => { const next = { ...prev }; delete next[comm_id]; return next; });
    setIgnoreMap(prev => {
      const next = { ...prev }; delete next[comm_id];
      try { localStorage.setItem(IGNORE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    setSelectedCall(null);
    setResult(null);
  };

  return {
    selectedCall,
    result,
    doneMap: doneMapState,
    ignoreMap,
    batchRunning,
    batchTotal,
    batchDone,
    batchCurrent,
    handleTranscribe,
    handleAnalyze,
    handleBatchStart,
    handleBatchStop,
    ignoreCall,
    unignoreCall,
    deleteCall,
    setResult,
  };
}
