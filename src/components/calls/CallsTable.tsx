import { useState } from 'react';
import { type CallRecord } from '@/lib/dataParser';
import Icon from '@/components/ui/icon';

const PER_PAGE = 50;

const durColor = (sec: number) => {
  if (sec < 30) return '#ff4444';
  if (sec < 60) return '#ff8c00';
  if (sec >= 300) return 'var(--brand-green)';
  return 'var(--text-secondary)';
};

export default function CallsTable({ calls }: { calls: CallRecord[] }) {
  const [search, setSearch] = useState('');
  const [minSec, setMinSec] = useState('');
  const [maxSec, setMaxSec] = useState('');
  const [page, setPage] = useState(1);

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
          placeholder="Мин. сек."
          type="number" className="w-24 px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
        <input
          value={maxSec} onChange={e => { setMaxSec(e.target.value); setPage(1); }}
          placeholder="Макс. сек."
          type="number" className="w-24 px-3 py-2 rounded-lg text-sm outline-none"
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
        {/* заголовок */}
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-default)' }}>
          <div className="col-span-2">Дата</div>
          <div className="col-span-2">Длительность</div>
          <div className="col-span-2">Статус</div>
          <div className="col-span-2">ID звонка</div>
          <div className="col-span-2">Тип</div>
          <div className="col-span-2">Запись</div>
        </div>
        {slice.map((c, i) => (
          <div key={i}
            className="grid grid-cols-12 gap-2 px-4 py-2.5 text-xs border-b items-center"
            style={{
              borderColor: 'var(--border-subtle)',
              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
            }}>
            <div className="col-span-2 font-mono" style={{ color: 'var(--text-secondary)' }}>{c.date}</div>
            <div className="col-span-2 font-mono font-semibold" style={{ color: durColor(c.duration_sec) }}>
              {c.duration}
            </div>
            <div className="col-span-2">
              <span className="px-2 py-0.5 rounded-full text-xs"
                style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--brand-green)' }}>
                {c.status}
              </span>
            </div>
            <div className="col-span-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
              {c.comm_id || '—'}
            </div>
            <div className="col-span-2 text-xs" style={{ color: 'var(--text-muted)' }}>{c.call_type}</div>
            <div className="col-span-2">
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
          </div>
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
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {page} / {pages}
          </span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
            className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-40"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
            Вперёд →
          </button>
        </div>
      )}
    </div>
  );
}
