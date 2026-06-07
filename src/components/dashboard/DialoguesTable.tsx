import { useState } from 'react';
import type { SampleRecord } from '@/lib/dataParser';

interface Props {
  records: SampleRecord[];
}

const STAGE_LABELS = ['Нет диалога', 'Отказ', 'Слушал', 'Встреча', 'Лид'];
const STAGE_COLORS = ['#555', '#ff4444', '#ff8c00', '#00aaff', '#00ff88'];
const STAGE_FILTERS = ['Все', 'Нет диалога', 'Отказ', 'Слушал', 'Встреча', 'Лид'];

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function DialoguesTable({ records }: Props) {
  const [filter, setFilter] = useState(0);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  const filtered = records
    .filter(r => filter === 0 ? true : r.stage === filter - 1)
    .filter(r => search ? r.dialogue.toLowerCase().includes(search.toLowerCase()) || r.phone.includes(search) : true);

  const total = filtered.length;
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="card-glass p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Диалоги
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {total.toLocaleString('ru-RU')} из {records.length.toLocaleString('ru-RU')}
          </p>
        </div>
        <div className="sm:ml-auto flex flex-wrap gap-2">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Поиск по тексту..."
            className="text-xs px-3 py-1.5 rounded-lg outline-none"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              width: 180,
            }}
          />
        </div>
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {STAGE_FILTERS.map((label, idx) => (
          <button
            key={idx}
            onClick={() => { setFilter(idx); setPage(0); }}
            className="text-xs px-3 py-1 rounded-full transition-all"
            style={{
              background: filter === idx ? (idx === 0 ? 'var(--brand-green)' : STAGE_COLORS[idx - 1]) : 'var(--bg-elevated)',
              color: filter === idx ? (idx === 0 ? '#000' : '#fff') : 'var(--text-secondary)',
              border: `1px solid ${filter === idx ? 'transparent' : 'var(--border-default)'}`,
              fontWeight: filter === idx ? 600 : 400,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        {paged.map((r, i) => (
          <div key={i}>
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all"
              style={{
                background: expanded === r.phone + i ? 'var(--bg-elevated)' : 'transparent',
                border: `1px solid ${expanded === r.phone + i ? 'var(--border-default)' : 'transparent'}`,
              }}
              onClick={() => setExpanded(expanded === r.phone + i ? null : r.phone + i)}
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: STAGE_COLORS[r.stage] }}
              />
              <span className="text-xs font-mono-data w-24 shrink-0" style={{ color: 'var(--text-muted)' }}>
                +7 *** {r.phone.slice(-4)}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full shrink-0"
                style={{
                  background: `${STAGE_COLORS[r.stage]}20`,
                  color: STAGE_COLORS[r.stage],
                  border: `1px solid ${STAGE_COLORS[r.stage]}40`,
                }}
              >
                {STAGE_LABELS[r.stage]}
              </span>
              <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                {r.dialogue ? r.dialogue.slice(0, 80) + '…' : 'Нет транскрипта'}
              </span>
              <span className="text-xs font-mono-data shrink-0" style={{ color: 'var(--text-muted)' }}>
                {formatDuration(r.durationSec)}
              </span>
              <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                {expanded === r.phone + i ? '▲' : '▼'}
              </span>
            </div>

            {expanded === r.phone + i && r.dialogue && (
              <div
                className="mx-3 mb-2 p-4 rounded-lg text-xs leading-relaxed scrollbar-thin overflow-y-auto"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  maxHeight: 300,
                  color: 'var(--text-secondary)',
                }}
              >
                {r.dialogue.split('\n').filter(l => l.trim()).map((line, li) => {
                  const isBot = line.toLowerCase().startsWith('bot:');
                  return (
                    <div key={li} className="mb-1.5 flex gap-2">
                      <span
                        className="shrink-0 font-semibold text-xs"
                        style={{ color: isBot ? 'var(--brand-green)' : '#00aaff', minWidth: 32 }}
                      >
                        {isBot ? 'Бот' : 'Кл.'}
                      </span>
                      <span>{line.replace(/^(bot|client):\s*/i, '')}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-default)' }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-30"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
          >
            ← Назад
          </button>
          <span className="text-xs font-mono-data" style={{ color: 'var(--text-muted)' }}>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-30"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
          >
            Вперёд →
          </button>
        </div>
      )}
    </div>
  );
}