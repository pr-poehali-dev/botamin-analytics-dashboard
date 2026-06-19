import { useState, useEffect } from 'react';
import { type CallRecord } from '@/lib/dataParser';
import Icon from '@/components/ui/icon';
import { TRANSCRIBE_URL, BATCH_STATUS_URL, type TranscriptResult, type Replica } from '@/components/calls/transcriptionTypes';

const PER_PAGE = 50;

const durColor = (sec: number) => {
  if (sec < 30) return '#ff4444';
  if (sec < 60) return '#ff8c00';
  if (sec >= 300) return 'var(--brand-green)';
  return 'var(--text-secondary)';
};

type DoneMap = Record<string, { replica_count: number; operator_replicas: number; client_replicas: number }>;

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

export default function CallsTable({ calls }: { calls: CallRecord[] }) {
  const [search, setSearch]   = useState('');
  const [minSec, setMinSec]   = useState('');
  const [maxSec, setMaxSec]   = useState('');
  const [page, setPage]       = useState(1);
  const LS_KEY = 'transcription_done_map';
  const loadLocal = (): DoneMap => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (_e) { return {}; }
  };

  const [doneMap, setDoneMap] = useState<DoneMap>(loadLocal);
  const [modalCall, setModalCall] = useState<CallRecord | null>(null);

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
    if (search && !c.date.includes(search) && !c.comm_id.includes(search)) return false;
    if (minSec && c.duration_sec < Number(minSec)) return false;
    if (maxSec && c.duration_sec > Number(maxSec)) return false;
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
          placeholder="Мин. сек." type="number" className="w-24 px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
        <input
          value={maxSec} onChange={e => { setMaxSec(e.target.value); setPage(1); }}
          placeholder="Макс. сек." type="number" className="w-24 px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
        {(search || minSec || maxSec) && (
          <button onClick={() => { setSearch(''); setMinSec(''); setMaxSec(''); setPage(1); }}
            className="px-3 py-2 rounded-lg text-xs"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
            Сбросить
          </button>
        )}
      </div>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Показано {slice.length} из {total.toLocaleString('ru-RU')} звонков
      </p>

      {/* таблица */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
        <div className="grid grid-cols-14 gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-default)',
            gridTemplateColumns: '1.5fr 1.5fr 1.2fr 1.8fr 1.5fr 1.2fr 1.5fr' }}>
          <div>Дата</div>
          <div>Длительность</div>
          <div>Статус</div>
          <div>ID звонка</div>
          <div>Тип</div>
          <div>Запись</div>
          <div>Транскрипт</div>
        </div>
        {slice.map((c, i) => {
          const hasTr = !!doneMap[c.comm_id];
          return (
            <div key={i}
              className="grid gap-2 px-4 py-2.5 text-xs border-b items-center"
              style={{
                gridTemplateColumns: '1.5fr 1.5fr 1.2fr 1.8fr 1.5fr 1.2fr 1.5fr',
                borderColor: 'var(--border-subtle)',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
              }}>
              <div className="font-mono" style={{ color: 'var(--text-secondary)' }}>{c.date}</div>
              <div className="font-mono font-semibold" style={{ color: durColor(c.duration_sec) }}>{c.duration}</div>
              <div>
                <span className="px-2 py-0.5 rounded-full text-xs"
                  style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--brand-green)' }}>
                  {c.status}
                </span>
              </div>
              <div className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{c.comm_id || '—'}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.call_type}</div>
              <div>
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
              <div>
                {hasTr ? (
                  <button onClick={() => setModalCall(c)}
                    className="flex items-center gap-1 transition-opacity hover:opacity-70"
                    style={{ color: 'var(--brand-green)' }}>
                    <Icon name="FileText" size={11} />
                    Открыть
                  </button>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                )}
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