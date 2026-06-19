import { useState } from 'react';
import { type CallRecord } from '@/lib/dataParser';
import { type TranscriptResult } from '@/components/calls/transcriptionTypes';
import Icon from '@/components/ui/icon';

interface Props {
  calls: CallRecord[];
  selectedCall: CallRecord | null;
  result: TranscriptResult | null;
  onSelect: (call: CallRecord) => void;
}

export default function CallsList({ calls, selectedCall, result, onSelect }: Props) {
  const [search, setSearch] = useState('');

  const callsWithRecords = calls.filter(c => c.record_url).length;

  const filteredCalls = calls
    .filter(c => c.record_url)
    .filter(c => !search || c.date.includes(search) || c.comm_id.includes(search))
    .slice(0, 100);

  return (
    <div className="w-72 shrink-0 flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Транскрибация</h2>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {callsWithRecords} звонков с записью
        </p>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Поиск по дате или ID…"
        className="px-3 py-2 rounded-lg text-xs outline-none"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {filteredCalls.map((call, i) => {
          const isSelected = selectedCall?.comm_id === call.comm_id;
          const durMin = Math.floor(call.duration_sec / 60);
          const durSec = call.duration_sec % 60;
          const isCached = isSelected && result?.cached;
          const isDone = isSelected && result?.status === 'done';
          const isErr = isSelected && result?.status === 'error';
          const isLoading = isSelected && (result?.status === 'transcribing' || result?.status === 'analyzing');
          return (
            <div key={i}
              onClick={() => onSelect(call)}
              className="p-3 rounded-xl cursor-pointer transition-all"
              style={{
                background: isSelected ? 'var(--brand-green-muted)' : 'var(--bg-card)',
                border: `1px solid ${isSelected ? 'rgba(0,255,136,0.3)' : 'var(--border-default)'}`,
              }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono" style={{ color: isSelected ? 'var(--brand-green)' : 'var(--text-secondary)' }}>
                  {call.date}
                </span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                  {durMin}:{String(durSec).padStart(2, '0')}
                </span>
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                ID: {call.comm_id || '—'}
              </div>
              {isSelected && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  {isLoading && (
                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--brand-green)' }}>
                      <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--brand-green)' }} />
                      {result?.status === 'analyzing' ? 'Анализирую…' : 'Транскрибирую…'}
                    </span>
                  )}
                  {isDone && (
                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--brand-green)' }}>
                      <Icon name="CheckCircle" size={11} />
                      {isCached ? 'Из кэша' : 'Готово'}
                    </span>
                  )}
                  {isErr && (
                    <span className="text-xs flex items-center gap-1" style={{ color: '#ff4444' }}>
                      <Icon name="XCircle" size={11} />
                      Ошибка
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filteredCalls.length === 0 && (
          <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>Нет звонков с записью</p>
        )}
      </div>
    </div>
  );
}
