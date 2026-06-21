import { useState, useEffect } from 'react';
import { type CallRecord } from '@/lib/dataParser';
import { TRANSCRIBE_URL, BATCH_STATUS_URL } from '@/components/calls/transcriptionTypes';
import { PER_PAGE, type DoneMap, type CallsCounts } from './callsTableTypes';
import CallsTranscriptModal from './CallsTranscriptModal';
import CallsFilters from './CallsFilters';
import CallsRow from './CallsRow';

export default function CallsTable({ calls, hiddenIds: hiddenIdsProp, onHideCall, onGoToTranscription }: {
  calls: CallRecord[];
  hiddenIds?: Set<string>;
  onHideCall?: (id: string) => void;
  onGoToTranscription?: (commId: string) => void;
}) {
  const [search, setSearch]                         = useState('');
  const [dateFrom, setDateFrom]                     = useState('');
  const [dateTo, setDateTo]                         = useState('');
  const [minSec, setMinSec]                         = useState('');
  const [maxSec, setMaxSec]                         = useState('');
  const [statusFilter, setStatusFilter]             = useState('');
  const [transcriptFilter, setTranscriptFilter]     = useState('');
  const [scoreFilter, setScoreFilter]               = useState('');
  const [interestFilter, setInterestFilter]         = useState('');
  const [qualFilter, setQualFilter]                 = useState('');
  const [scriptFilter, setScriptFilter]             = useState('');
  const [objFilter, setObjFilter]                   = useState('');
  const [ivrFilter, setIvrFilter]                   = useState('');
  const [page, setPage]                             = useState(1);

  const LS_KEY = 'transcription_done_map';
  const loadLocal = (): DoneMap => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (_e) { return {}; }
  };

  const [doneMap, setDoneMap]       = useState<DoneMap>(loadLocal);
  const [modalCall, setModalCall]   = useState<CallRecord | null>(null);
  const [inProgress, setInProgress] = useState<Set<string>>(new Set());

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const transcribeCall = async (call: CallRecord) => {
    if (!call.record_url || inProgress.has(call.comm_id) || doneMap[call.comm_id]) return;
    setInProgress(prev => new Set(prev).add(call.comm_id));
    try {
      const res  = await fetch(TRANSCRIBE_URL, {
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
      let result = data;
      // Поллим до 36 раз × 5 сек = 3 минуты
      if (data.status === 'processing') {
        for (let i = 0; i < 36; i++) {
          await sleep(5000);
          const poll = await fetch(`${TRANSCRIBE_URL}?comm_id=${call.comm_id}`);
          result = await poll.json();
          if (result.status === 'done' || result.replica_count > 0) break;
          if (result.error) break;
        }
      }
      // Добавляем в doneMap если есть реплики, IVR, или хоть что-то вернулось
      if (result.replica_count > 0 || result.all_ivr || result.status === 'done') {
        setDoneMap(prev => {
          const next = { ...prev, [call.comm_id]: { replica_count: result.replica_count || 0, operator_replicas: result.operator_replicas || 0, client_replicas: result.client_replicas || 0 } };
          try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch (_e) { /* ignore */ }
          return next;
        });
      }
    } catch { /* ignore */ }
    // Всегда убираем из inProgress чтобы кнопка не зависала
    setInProgress(prev => { const n = new Set(prev); n.delete(call.comm_id); return n; });
  };

  const hiddenIds = hiddenIdsProp ?? new Set<string>();
  const hideCall  = (comm_id: string) => onHideCall?.(comm_id);

  useEffect(() => {
    fetch(BATCH_STATUS_URL)
      .then(r => r.json())
      .then(d => {
        if (d.done) {
          // Сервер побеждает localStorage — мёрджим так чтобы серверные данные (с ai) перезаписывали локальные
          setDoneMap(prev => {
            const merged = { ...prev };
            for (const [id, val] of Object.entries(d.done)) {
              // Если серверная запись содержит ai — всегда берём её целиком
              merged[id] = val as DoneMap[string];
            }
            try { localStorage.setItem(LS_KEY, JSON.stringify(merged)); } catch (_e) { /* ignore */ }
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);

  // Конвертация dd.mm.yyyy → yyyy-mm-dd для сравнения с input[type=date]
  const toIso = (d: string) => {
    if (!d) return '';
    if (d.includes('.')) { const [dd, mm, yyyy] = d.split('.'); return `${yyyy}-${mm}-${dd}`; }
    return d.slice(0, 10);
  };

  const filtered = calls.filter(c => {
    if (hiddenIds.has(c.comm_id)) return false;
    if (search && !c.date.includes(search) && !c.comm_id.includes(search)) return false;
    if (dateFrom || dateTo) {
      const iso = toIso(c.date);
      if (dateFrom && iso < dateFrom) return false;
      if (dateTo && iso > dateTo) return false;
    }
    if (minSec && c.duration_sec < Number(minSec)) return false;
    if (maxSec && c.duration_sec > Number(maxSec)) return false;
    if (transcriptFilter === 'yes' && !doneMap[c.comm_id]) return false;
    if (transcriptFilter === 'no' && !!doneMap[c.comm_id]) return false;
    const ai = doneMap[c.comm_id]?.ai;
    if (statusFilter) {
      if (statusFilter === 'success' && ai?.outcome !== 'success') return false;
      if (statusFilter === 'failure' && ai?.outcome !== 'failure') return false;
      if (statusFilter === 'pending' && ai?.outcome !== 'pending') return false;
      if (statusFilter === 'target' && ai?.call_type !== 'target') return false;
      if (statusFilter === 'non_target' && ai?.call_type !== 'non_target') return false;
      if (statusFilter === 'no_ai' && !!ai) return false;
    }
    if (scoreFilter) {
      const s = ai?.operator_score;
      if (scoreFilter === 'high' && (s == null || s < 8)) return false;
      if (scoreFilter === 'mid' && (s == null || s < 5 || s > 7)) return false;
      if (scoreFilter === 'low' && (s == null || s > 4)) return false;
      if (scoreFilter === 'none' && s != null) return false;
    }
    if (interestFilter) {
      if (interestFilter === 'high' && ai?.client_interest !== 'high') return false;
      if (interestFilter === 'medium' && ai?.client_interest !== 'medium') return false;
      if (interestFilter === 'low' && ai?.client_interest !== 'low') return false;
    }
    if (qualFilter) {
      if (qualFilter === 'yes' && !ai?.qualification) return false;
      if (qualFilter === 'no' && ai?.qualification !== false) return false;
    }
    if (scriptFilter) {
      if (scriptFilter === 'yes' && !ai?.operator_followed_script) return false;
      if (scriptFilter === 'no' && ai?.operator_followed_script !== false) return false;
    }
    if (objFilter) {
      if (objFilter === 'yes' && !ai?.operator_handled_objections) return false;
      if (objFilter === 'no' && ai?.operator_handled_objections !== false) return false;
    }
    if (ivrFilter) {
      const hasIvr = !!doneMap[c.comm_id]?.has_ivr;
      if (ivrFilter === 'yes' && !hasIvr) return false;
      if (ivrFilter === 'no' && hasIvr) return false;
    }
    return true;
  });

  const total = filtered.length;
  const pages = Math.ceil(total / PER_PAGE);
  const slice = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Счётчики для select-опций (по всем звонкам без скрытых)
  const visible = calls.filter(c => !hiddenIds.has(c.comm_id));
  const cnt: CallsCounts = {
    withTranscript:  visible.filter(c => !!doneMap[c.comm_id]).length,
    noTranscript:    visible.filter(c => !doneMap[c.comm_id]).length,
    success:         visible.filter(c => doneMap[c.comm_id]?.ai?.outcome === 'success').length,
    failure:         visible.filter(c => doneMap[c.comm_id]?.ai?.outcome === 'failure').length,
    pending:         visible.filter(c => doneMap[c.comm_id]?.ai?.outcome === 'pending').length,
    target:          visible.filter(c => doneMap[c.comm_id]?.ai?.call_type === 'target').length,
    non_target:      visible.filter(c => doneMap[c.comm_id]?.ai?.call_type === 'non_target').length,
    no_ai:           visible.filter(c => !doneMap[c.comm_id]?.ai).length,
    scoreHigh:       visible.filter(c => { const s = doneMap[c.comm_id]?.ai?.operator_score; return s != null && s >= 8; }).length,
    scoreMid:        visible.filter(c => { const s = doneMap[c.comm_id]?.ai?.operator_score; return s != null && s >= 5 && s <= 7; }).length,
    scoreLow:        visible.filter(c => { const s = doneMap[c.comm_id]?.ai?.operator_score; return s != null && s <= 4; }).length,
    scoreNone:       visible.filter(c => doneMap[c.comm_id]?.ai?.operator_score == null && !!doneMap[c.comm_id]?.ai).length,
    interestHigh:    visible.filter(c => doneMap[c.comm_id]?.ai?.client_interest === 'high').length,
    interestMedium:  visible.filter(c => doneMap[c.comm_id]?.ai?.client_interest === 'medium').length,
    interestLow:     visible.filter(c => doneMap[c.comm_id]?.ai?.client_interest === 'low').length,
    qualYes:         visible.filter(c => doneMap[c.comm_id]?.ai?.qualification === true).length,
    qualNo:          visible.filter(c => doneMap[c.comm_id]?.ai?.qualification === false).length,
    scriptYes:       visible.filter(c => doneMap[c.comm_id]?.ai?.operator_followed_script === true).length,
    scriptNo:        visible.filter(c => doneMap[c.comm_id]?.ai?.operator_followed_script === false).length,
    objYes:          visible.filter(c => doneMap[c.comm_id]?.ai?.operator_handled_objections === true).length,
    objNo:           visible.filter(c => doneMap[c.comm_id]?.ai?.operator_handled_objections === false).length,
    ivrYes:          visible.filter(c => !!doneMap[c.comm_id]?.has_ivr).length,
    ivrNo:           visible.filter(c => !!doneMap[c.comm_id] && !doneMap[c.comm_id]?.has_ivr).length,
  };

  const resetFilters = () => {
    setSearch(''); setDateFrom(''); setDateTo('');
    setMinSec(''); setMaxSec('');
    setStatusFilter(''); setTranscriptFilter(''); setScoreFilter('');
    setInterestFilter(''); setQualFilter(''); setScriptFilter('');
    setObjFilter(''); setIvrFilter(''); setPage(1);
  };

  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v); setPage(1);
  };

  return (
    <div className="space-y-4">
      <CallsFilters
        search={search}           setSearch={handleFilterChange(setSearch)}
        dateFrom={dateFrom}       setDateFrom={handleFilterChange(setDateFrom)}
        dateTo={dateTo}           setDateTo={handleFilterChange(setDateTo)}
        minSec={minSec}           setMinSec={handleFilterChange(setMinSec)}
        maxSec={maxSec}           setMaxSec={handleFilterChange(setMaxSec)}
        statusFilter={statusFilter}         setStatusFilter={handleFilterChange(setStatusFilter)}
        transcriptFilter={transcriptFilter} setTranscriptFilter={handleFilterChange(setTranscriptFilter)}
        scoreFilter={scoreFilter}           setScoreFilter={handleFilterChange(setScoreFilter)}
        interestFilter={interestFilter}     setInterestFilter={handleFilterChange(setInterestFilter)}
        qualFilter={qualFilter}             setQualFilter={handleFilterChange(setQualFilter)}
        scriptFilter={scriptFilter}         setScriptFilter={handleFilterChange(setScriptFilter)}
        objFilter={objFilter}               setObjFilter={handleFilterChange(setObjFilter)}
        ivrFilter={ivrFilter}               setIvrFilter={handleFilterChange(setIvrFilter)}
        onReset={resetFilters}
        cnt={cnt}
      />

      <div className="flex items-center gap-3">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Показано {slice.length} из {total.toLocaleString('ru-RU')} звонков
          {total !== calls.length && (
            <span style={{ color: 'var(--brand-green)' }}> · фильтр активен</span>
          )}
        </p>
      </div>

      {/* таблица */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
        <div className="hidden sm:grid gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-default)',
            gridTemplateColumns: '1.5fr 1.5fr 1.2fr 1.8fr 1.5fr 1.2fr 1.5fr 32px' }}>
          <div>Дата</div>
          <div>Длительность</div>
          <div>Статус</div>
          <div>ID звонка</div>
          <div>Тип</div>
          <div>Запись</div>
          <div>Транскрипт</div>
          <div />
        </div>
        {slice.map((c, i) => (
          <CallsRow
            key={c.comm_id}
            call={c}
            index={i}
            doneMap={doneMap}
            inProgress={inProgress}
            onGoToTranscription={onGoToTranscription}
            onTranscribe={transcribeCall}
            onHide={hideCall}
          />
        ))}
      </div>

      {/* пагинация */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-40"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
            ← Назад
          </button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{page} / {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
            className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-40"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
            Вперёд →
          </button>
        </div>
      )}

      {modalCall && <CallsTranscriptModal call={modalCall} onClose={() => setModalCall(null)} />}
    </div>
  );
}