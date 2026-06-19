import { useState, useRef, useCallback } from 'react';
import {
  loadFromUrl, loadFromFile, formatSec, formatTotalHours,
  type CallsData, type CallRecord,
} from '@/lib/dataParser';
import Icon from '@/components/ui/icon';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const DEMO_URL =
  'https://cdn.poehali.dev/projects/6a84af2c-c107-4039-b71a-e57da70119f0/bucket/f46cc9cf-190b-4379-8e94-6225cc11ec61.xlsx';

type Tab = 'overview' | 'calls' | 'recommendations';

// ── tooltip для баров ──────────────────────────────────────────────────
interface TipProps { active?: boolean; payload?: { name: string; value: number }[]; label?: string }
const BarTip = ({ active, payload, label }: TipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-lg text-xs border"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
      <div className="font-semibold mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: 'var(--brand-green)' }}>{p.name}: {p.value}</div>
      ))}
    </div>
  );
};

// ── экран загрузки файла ───────────────────────────────────────────────
function UploadScreen({ onLoad }: { onLoad: (d: CallsData) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const process = useCallback(async (file?: File, url?: string) => {
    setLoading(true);
    setError('');
    try {
      const data = file ? await loadFromFile(file) : await loadFromUrl(url!);
      onLoad(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  }, [onLoad]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) process(e.target.files[0]);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files?.[0]) process(e.dataTransfer.files[0]);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'var(--bg-primary)' }}>
      {/* лого */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg"
          style={{ background: 'var(--brand-green)', color: '#000' }}>S</div>
        <div>
          <div className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>СайтАктив</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Аналитика звонков</div>
        </div>
      </div>

      {/* зона загрузки */}
      <div
        className="w-full max-w-md rounded-2xl p-8 text-center cursor-pointer transition-all"
        style={{
          border: `2px dashed ${drag ? 'var(--brand-green)' : 'var(--border-default)'}`,
          background: drag ? 'var(--brand-green-muted)' : 'var(--bg-card)',
        }}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => !loading && inputRef.current?.click()}>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFile} />
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2.5 h-2.5 rounded-full animate-pulse"
                  style={{ background: 'var(--brand-green)', animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Анализирую звонки…</p>
          </div>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'var(--brand-green-muted)' }}>
              <Icon name="Upload" size={28} style={{ color: 'var(--brand-green)' }} />
            </div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Загрузите Excel-файл со звонками
            </p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Перетащите файл или нажмите для выбора
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Поддерживается экспорт из CoMagic / Битрикс24
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm px-4 py-2 rounded-lg"
          style={{ background: 'rgba(255,68,68,0.1)', color: '#ff6666' }}>{error}</p>
      )}

      {/* демо */}
      {!loading && (
        <button
          className="mt-5 text-xs underline underline-offset-2 transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-muted)' }}
          onClick={() => process(undefined, DEMO_URL)}>
          Открыть демо (3 263 звонка, апрель–июнь 2026)
        </button>
      )}
    </div>
  );
}

// ── KPI карточка ───────────────────────────────────────────────────────
function KPI({ icon, label, value, sub, accent }: {
  icon: string; label: string; value: string; sub?: string; accent?: boolean
}) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon name={icon} size={15} style={{ color: accent ? 'var(--brand-green)' : 'var(--text-muted)' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div className="text-2xl font-black font-mono"
        style={{ color: accent ? 'var(--brand-green)' : 'var(--text-primary)' }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

// ── таблица звонков ────────────────────────────────────────────────────
function CallsTable({ calls }: { calls: CallRecord[] }) {
  const [search, setSearch] = useState('');
  const [minSec, setMinSec] = useState('');
  const [maxSec, setMaxSec] = useState('');
  const [page, setPage] = useState(1);
  const PER_PAGE = 50;

  const filtered = calls.filter(c => {
    if (search && !c.date.includes(search) && !c.comm_id.includes(search)) return false;
    if (minSec && c.duration_sec < Number(minSec)) return false;
    if (maxSec && c.duration_sec > Number(maxSec)) return false;
    return true;
  });

  const total = filtered.length;
  const pages = Math.ceil(total / PER_PAGE);
  const slice = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const durColor = (sec: number) => {
    if (sec < 30) return '#ff4444';
    if (sec < 60) return '#ff8c00';
    if (sec >= 300) return 'var(--brand-green)';
    return 'var(--text-secondary)';
  };

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

// ── блок рекомендаций ──────────────────────────────────────────────────
function RecommendationsBlock({ data }: { data: CallsData }) {
  const priorityColor = { high: '#ff4444', medium: '#ff8c00', low: 'var(--brand-green)' };
  const priorityLabel = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
  const priorityIcon = { high: 'AlertTriangle', medium: 'Info', low: 'CheckCircle' };

  return (
    <div className="space-y-4">
      {data.recommendations.map((r, i) => (
        <div key={i} className="rounded-2xl p-5"
          style={{ background: 'var(--bg-card)', border: `1px solid ${priorityColor[r.priority]}33` }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: `${priorityColor[r.priority]}18` }}>
              <Icon name={priorityIcon[r.priority]} size={16} style={{ color: priorityColor[r.priority] }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{r.title}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ background: `${priorityColor[r.priority]}18`, color: priorityColor[r.priority] }}>
                  {priorityLabel[r.priority]} приоритет
                </span>
              </div>
              <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{r.desc}</p>
              <div className="flex items-start gap-2 p-3 rounded-lg"
                style={{ background: 'var(--bg-elevated)' }}>
                <Icon name="Lightbulb" size={13} style={{ color: 'var(--brand-green)', marginTop: 1, flexShrink: 0 }} />
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{r.action}</p>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* контекст данных */}
      <div className="rounded-2xl p-5 mt-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="BarChart2" size={14} style={{ color: 'var(--brand-green)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            На чём основаны рекомендации
          </span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { label: 'Всего проанализировано', val: `${data.total.toLocaleString('ru-RU')} звонков` },
            { label: 'Средняя длительность', val: formatSec(data.avg_duration_sec) },
            { label: 'Суммарное время разговоров', val: formatTotalHours(data.total_talk_sec) },
            { label: 'Источник данных', val: 'CoMagic / Битрикс24' },
          ].map((row, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg"
              style={{ background: 'var(--bg-elevated)' }}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.label}</span>
              <span className="text-xs font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>{row.val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── главный дашборд ────────────────────────────────────────────────────
function Dashboard({ data, onReset }: { data: CallsData; onReset: () => void }) {
  const [tab, setTab] = useState<Tab>('overview');

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Обзор', icon: 'LayoutDashboard' },
    { id: 'calls', label: 'Все звонки', icon: 'PhoneCall' },
    { id: 'recommendations', label: 'Рекомендации', icon: 'Lightbulb' },
  ];

  const maxDay = Math.max(...data.by_day.map(d => d.count), 1);
  const maxBucket = Math.max(...data.duration_dist.map(d => d.count), 1);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)', fontFamily: "'Golos Text', sans-serif" }}>

      {/* header */}
      <header className="sticky top-0 z-40 border-b"
        style={{ background: 'rgba(10,10,10,0.96)', borderColor: 'var(--border-default)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md flex items-center justify-center font-black text-sm"
                style={{ background: 'var(--brand-green)', color: '#000' }}>S</div>
              <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>СайтАктив</span>
              <span className="text-xs px-2 py-0.5 rounded-full hidden sm:inline"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                Аналитика звонков
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5"
                style={{ background: 'var(--brand-green-muted)', border: '1px solid rgba(0,255,136,0.2)', color: 'var(--brand-green)' }}>
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--brand-green)' }} />
                {data.total.toLocaleString('ru-RU')} звонков
              </div>
              <button onClick={onReset}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                <Icon name="Upload" size={12} />
                <span className="hidden sm:inline">Загрузить другой</span>
              </button>
            </div>
          </div>

          {/* табы */}
          <div className="flex gap-0.5 -mb-px overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-all"
                style={{
                  borderColor: tab === t.id ? 'var(--brand-green)' : 'transparent',
                  color: tab === t.id ? 'var(--brand-green)' : 'var(--text-muted)',
                }}>
                <Icon name={t.icon} size={13} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* ── ОБЗОР ── */}
        {tab === 'overview' && (
          <div className="space-y-6 animate-fade-in">

            {/* KPI */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KPI icon="PhoneCall" label="Всего звонков" value={data.total.toLocaleString('ru-RU')} accent />
              <KPI icon="Clock" label="Средняя длительность"
                value={formatSec(data.avg_duration_sec)}
                sub="время разговора" />
              <KPI icon="Timer" label="Суммарное время"
                value={formatTotalHours(data.total_talk_sec)}
                sub="часов разговоров" />
              <KPI icon="CheckCircle" label="Статус"
                value={Object.keys(data.statuses)[0] ?? '—'}
                sub={`${Object.values(data.statuses)[0] ?? 0} звонков`}
                accent />
            </div>

            {/* Динамика по дням */}
            <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <div className="mb-4">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Динамика звонков по дням
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {data.by_day.length > 0
                    ? `${data.by_day[0].date} — ${data.by_day[data.by_day.length - 1].date}`
                    : 'Нет данных'}
                </p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.by_day} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false}
                    interval={Math.floor(data.by_day.length / 8)} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<BarTip />} cursor={false} />
                  <Bar dataKey="count" name="Звонков" radius={[3, 3, 0, 0]}>
                    {data.by_day.map((d, i) => (
                      <Cell key={i} fill={`rgba(0,255,136,${0.25 + (d.count / maxDay) * 0.75})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Распределение по длительности */}
            <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <div className="mb-4">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Распределение по длительности
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Сколько звонков в каждом диапазоне
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data.duration_dist} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<BarTip />} cursor={false} />
                    <Bar dataKey="count" name="Звонков" radius={[3, 3, 0, 0]}>
                      {data.duration_dist.map((d, i) => (
                        <Cell key={i} fill={`rgba(0,170,255,${0.25 + (d.count / maxBucket) * 0.75})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {data.duration_dist.map((d, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: 'rgba(0,170,255,0.7)' }} />
                      <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>{d.label}</span>
                      <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {d.count.toLocaleString('ru-RU')}
                      </span>
                      <span className="text-xs w-10 text-right" style={{ color: 'var(--text-muted)' }}>{d.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Сводная таблица */}
            <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Icon name="ShieldCheck" size={14} style={{ color: 'var(--brand-green)' }} />
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Сводные показатели
                </h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {[
                  { label: 'Всего звонков', val: data.total.toLocaleString('ru-RU') },
                  { label: 'Средняя длительность', val: formatSec(data.avg_duration_sec) },
                  { label: 'Суммарное время разговоров', val: formatTotalHours(data.total_talk_sec) },
                  { label: 'Дней в периоде', val: data.by_day.length.toString() },
                  { label: 'Среднее звонков в день', val: data.by_day.length > 0 ? Math.round(data.total / data.by_day.length).toString() : '—' },
                  { label: 'Источник', val: 'CoMagic / Битрикс24' },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-lg"
                    style={{ background: 'var(--bg-elevated)' }}>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                    <span className="text-xs font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>{row.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ВСЕ ЗВОНКИ ── */}
        {tab === 'calls' && (
          <div className="animate-fade-in">
            <div className="mb-5">
              <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Все звонки</h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Полный список с фильтрацией по дате, длительности и поиском по ID
              </p>
            </div>
            <CallsTable calls={data.calls} />
          </div>
        )}

        {/* ── РЕКОМЕНДАЦИИ ── */}
        {tab === 'recommendations' && (
          <div className="animate-fade-in">
            <div className="mb-5">
              <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                Рекомендации для роста конверсии
              </h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                На основе анализа {data.total.toLocaleString('ru-RU')} звонков
              </p>
            </div>
            <RecommendationsBlock data={data} />
          </div>
        )}
      </main>
    </div>
  );
}

// ── корневой компонент ─────────────────────────────────────────────────
export default function Index() {
  const [data, setData] = useState<CallsData | null>(null);

  if (!data) return <UploadScreen onLoad={setData} />;
  return <Dashboard data={data} onReset={() => setData(null)} />;
}
