import { useState, useEffect } from 'react';
import { type CallRecord } from '@/lib/dataParser';
import Icon from '@/components/ui/icon';
import { TRANSCRIBE_URL, BATCH_STATUS_URL, type TranscriptResult, type Replica } from '@/components/calls/transcriptionTypes';
import { getAiStatus } from '@/components/calls/callStatus';

const PER_PAGE = 50;

const durColor = (sec: number) => {
  if (sec < 30) return '#ff4444';
  if (sec < 60) return '#ff8c00';
  if (sec >= 300) return 'var(--brand-green)';
  return 'var(--text-secondary)';
};

type DoneMap = Record<string, {
  replica_count: number; operator_replicas: number; client_replicas: number;
  has_ivr?: boolean;
  ai?: {
    outcome?: string; call_type?: string; qualification?: boolean; client_interest?: string;
    operator_score?: number; operator_followed_script?: boolean; operator_handled_objections?: boolean;
  };
}>;

function TranscriptModal({ call, onClose }: { call: CallRecord; onClose: () => void }) {
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

export default function CallsTable({ calls, hiddenIds: hiddenIdsProp, onHideCall, onGoToTranscription }: { calls: CallRecord[]; hiddenIds?: Set<string>; onHideCall?: (id: string) => void; onGoToTranscription?: (commId: string) => void }) {
  const [search, setSearch]       = useState('');
  const [minSec, setMinSec]       = useState('');
  const [maxSec, setMaxSec]       = useState('');
  const [statusFilter, setStatusFilter]         = useState('');
  const [transcriptFilter, setTranscriptFilter] = useState('');
  const [scoreFilter, setScoreFilter]           = useState('');
  const [interestFilter, setInterestFilter]     = useState('');
  const [qualFilter, setQualFilter]             = useState('');
  const [scriptFilter, setScriptFilter]         = useState('');
  const [objFilter, setObjFilter]               = useState('');
  const [ivrFilter, setIvrFilter]               = useState('');
  const [page, setPage]           = useState(1);
  const LS_KEY = 'transcription_done_map';
  const loadLocal = (): DoneMap => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (_e) { return {}; }
  };

  const [doneMap, setDoneMap]     = useState<DoneMap>(loadLocal);
  const [modalCall, setModalCall] = useState<CallRecord | null>(null);
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
          setDoneMap(prev => ({ ...prev, ...d.done }));
          try { localStorage.setItem(LS_KEY, JSON.stringify({ ...loadLocal(), ...d.done })); } catch (_e) { /* ignore */ }
        }
      })
      .catch(() => {});
  }, []);

  const filtered = calls.filter(c => {
    if (hiddenIds.has(c.comm_id)) return false;
    if (search && !c.date.includes(search) && !c.comm_id.includes(search)) return false;
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

  return (
    <div className="space-y-4">
      {/* фильтры */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Поиск по дате или ID звонка…"
          className="flex-1 min-w-48 px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
        <input
          value={minSec} onChange={e => { setMinSec(e.target.value); setPage(1); }}
          placeholder="Мин. сек." type="number" className="w-32 px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
        <input
          value={maxSec} onChange={e => { setMaxSec(e.target.value); setPage(1); }}
          placeholder="Макс. сек." type="number" className="w-32 px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: statusFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          <option value="">Все статусы</option>
          <option value="success">✅ Успех</option>
          <option value="failure">❌ Отказ</option>
          <option value="pending">🔄 В работе</option>
          <option value="target">🎯 Целевые</option>
          <option value="non_target">⛔ Нецелевые</option>
          <option value="no_ai">⚪ Без анализа</option>
        </select>
        <select
          value={transcriptFilter}
          onChange={e => { setTranscriptFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: transcriptFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          <option value="">Транскрипт: все</option>
          <option value="yes">📝 С транскриптом</option>
          <option value="no">🔇 Без транскрипта</option>
        </select>
        <select
          value={scoreFilter}
          onChange={e => { setScoreFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: scoreFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          <option value="">Оценка: все</option>
          <option value="high">⭐ Высокая (8–10)</option>
          <option value="mid">🟡 Средняя (5–7)</option>
          <option value="low">🔴 Низкая (1–4)</option>
          <option value="none">— Без оценки</option>
        </select>
        <select
          value={interestFilter}
          onChange={e => { setInterestFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: interestFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          <option value="">Интерес клиента: все</option>
          <option value="high">🟢 Высокий</option>
          <option value="medium">🟡 Средний</option>
          <option value="low">🔴 Низкий</option>
        </select>
        <select
          value={qualFilter}
          onChange={e => { setQualFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: qualFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          <option value="">Квалификация: все</option>
          <option value="yes">✅ Квалифицирован</option>
          <option value="no">❌ Не квалифицирован</option>
        </select>
        <select
          value={scriptFilter}
          onChange={e => { setScriptFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: scriptFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          <option value="">Скрипт: все</option>
          <option value="yes">✅ Скрипт соблюдён</option>
          <option value="no">❌ Скрипт нарушен</option>
        </select>
        <select
          value={objFilter}
          onChange={e => { setObjFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: objFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          <option value="">Возражения: все</option>
          <option value="yes">✅ Отработаны</option>
          <option value="no">❌ Не отработаны</option>
        </select>
        <select
          value={ivrFilter}
          onChange={e => { setIvrFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: ivrFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          <option value="">IVR: все</option>
          <option value="yes">🤖 Есть автоответчик</option>
          <option value="no">👤 Без автоответчика</option>
        </select>
        {(search || minSec || maxSec || statusFilter || transcriptFilter || scoreFilter || interestFilter || qualFilter || scriptFilter || objFilter || ivrFilter) && (
          <button onClick={() => { setSearch(''); setMinSec(''); setMaxSec(''); setStatusFilter(''); setTranscriptFilter(''); setScoreFilter(''); setInterestFilter(''); setQualFilter(''); setScriptFilter(''); setObjFilter(''); setIvrFilter(''); setPage(1); }}
            className="px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', color: '#ff6666' }}>
            Сбросить всё
          </button>
        )}
      </div>

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
        <div className="grid gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider"
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
        {slice.map((c, i) => {
          const hasTr     = !!doneMap[c.comm_id];
          const isPending = inProgress.has(c.comm_id);
          const aiStatus  = getAiStatus(doneMap[c.comm_id]?.ai);
          return (
            <div key={i}
              className="grid gap-2 px-4 py-2.5 text-xs border-b items-center group cursor-pointer transition-all hover:bg-white/5"
              onClick={() => onGoToTranscription?.(c.comm_id)}
              style={{
                gridTemplateColumns: '1.5fr 1.5fr 1.2fr 1.8fr 1.5fr 1.2fr 1.5fr 32px',
                borderColor: 'var(--border-subtle)',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
              }}>
              <div className="font-mono" style={{ color: 'var(--text-secondary)' }}>{c.date}</div>
              <div className="font-mono font-semibold" style={{ color: durColor(c.duration_sec) }}>{c.duration}</div>
              <div>
                {aiStatus ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                    style={{ background: aiStatus.bg, color: aiStatus.color }}>
                    <Icon name={aiStatus.icon} size={10} />
                    {aiStatus.label}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                    {c.status}
                  </span>
                )}
              </div>
              <div className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{c.comm_id || '—'}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.call_type}</div>
              <div onClick={e => e.stopPropagation()}>
                {c.record_url ? (
                  <a href={c.record_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 transition-opacity hover:opacity-70"
                    style={{ color: 'var(--brand-green)' }}>
                    <Icon name="Play" size={11} />
                    Слушать
                  </a>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                )}
              </div>
              <div onClick={e => e.stopPropagation()}>
                {hasTr ? (
                  <button onClick={() => onGoToTranscription?.(c.comm_id)}
                    className="flex items-center gap-1 transition-opacity hover:opacity-70"
                    style={{ color: 'var(--brand-green)' }}>
                    <Icon name="FileText" size={11} />
                    Открыть
                  </button>
                ) : isPending ? (
                  <span className="flex items-center gap-1" style={{ color: '#ff8c00' }}>
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#ff8c00' }} />
                    Идёт…
                  </span>
                ) : c.record_url ? (
                  <button onClick={() => transcribeCall(c)}
                    className="flex items-center gap-1 transition-opacity hover:opacity-80"
                    style={{ color: 'var(--text-muted)' }}>
                    <Icon name="Mic" size={11} />
                    Транскрибировать
                  </button>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                )}
              </div>
              <div className="flex justify-end" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => hideCall(c.comm_id)}
                  className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-100"
                  style={{ color: '#ff4444' }}
                  title="Удалить строку">
                  <Icon name="X" size={12} />
                </button>
              </div>
            </div>
          );
        })}
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

      {modalCall && <TranscriptModal call={modalCall} onClose={() => setModalCall(null)} />}
    </div>
  );
}