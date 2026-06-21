import { useState } from 'react';
import { type CallRecord } from '@/lib/dataParser';
import { type TranscriptResult } from '@/components/calls/transcriptionTypes';
import Icon from '@/components/ui/icon';
import { getAiStatus } from '@/components/calls/callStatus';

type DoneMap = Record<string, {
  replica_count: number; operator_replicas: number; client_replicas: number;
  ai?: { outcome?: string; call_type?: string; qualification?: boolean; client_interest?: string };
}>;

interface Props {
  calls: CallRecord[];
  selectedCall: CallRecord | null;
  result: TranscriptResult | null;
  doneMap: DoneMap;
  onSelect: (call: CallRecord) => void;
}

const PAGE_SIZE = 100;

export default function CallsList({ calls, selectedCall, result, doneMap, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);

  const allFiltered = calls
    .filter(c => c.record_url)
    .filter(c => !search || c.date.includes(search) || c.comm_id.includes(search));

  const totalPages    = Math.ceil(allFiltered.length / PAGE_SIZE);
  const filteredCalls = allFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };

  return (
    <>
      <input
        value={search}
        onChange={e => handleSearch(e.target.value)}
        placeholder="Поиск по дате или ID…"
        className="px-3 py-2 rounded-lg text-xs outline-none shrink-0"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {filteredCalls.map((call, i) => {
          const isSelected  = selectedCall?.comm_id === call.comm_id;
          const doneEntry   = doneMap[call.comm_id];
          const isDoneInDB  = !!doneEntry;
          const aiStatus    = getAiStatus(doneEntry?.ai);
          const durMin      = Math.floor(call.duration_sec / 60);
          const durSec      = call.duration_sec % 60;
          const isLoading   = isSelected && (result?.status === 'transcribing' || result?.status === 'analyzing');
          const isError     = isSelected && result?.status === 'error';
          const isDone      = isSelected && result?.status === 'done';

          return (
            <div key={i}
              onClick={() => onSelect(call)}
              className="p-3 rounded-xl cursor-pointer transition-all"
              style={{
                background: isSelected ? 'var(--brand-green-muted)' : 'var(--bg-card)',
                border: `1px solid ${isSelected ? 'rgba(0,255,136,0.3)' : isDoneInDB ? 'rgba(0,255,136,0.12)' : 'var(--border-default)'}`,
              }}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-mono" style={{ color: isSelected ? 'var(--brand-green)' : 'var(--text-secondary)' }}>
                  {call.date}
                </span>
                <div className="flex items-center gap-1.5">
                  {/* Значок готовности — виден всегда */}
                  {isDoneInDB && !isLoading && (
                    <Icon name="CheckCircle" size={11} style={{ color: 'var(--brand-green)', opacity: 0.8 }} />
                  )}
                  {isLoading && (
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--brand-green)' }} />
                  )}
                  <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    {durMin}:{String(durSec).padStart(2, '0')}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  ID: {call.comm_id || '—'}
                </span>
                {/* AI-статус — виден всегда если есть */}
                {aiStatus && !isLoading && (
                  <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full"
                    style={{ background: aiStatus.bg, color: aiStatus.color }}>
                    <Icon name={aiStatus.icon} size={9} />
                    {aiStatus.label}
                  </span>
                )}
                {isLoading && (
                  <span className="text-xs" style={{ color: 'var(--brand-green)' }}>
                    {result?.status === 'analyzing' ? 'Анализирую…' : 'Транскрибирую…'}
                  </span>
                )}
                {isError && (
                  <span className="text-xs flex items-center gap-1" style={{ color: '#ff4444' }}>
                    <Icon name="XCircle" size={10} />
                    Ошибка
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {filteredCalls.length === 0 && (
          <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>Нет звонков с записью</p>
        )}

        {/* Пагинация */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 pb-1 shrink-0">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-30"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
              ← Назад
            </button>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {page} / {totalPages} · {allFiltered.length} звонков
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-30"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
              Вперёд →
            </button>
          </div>
        )}
      </div>
    </>
  );
}