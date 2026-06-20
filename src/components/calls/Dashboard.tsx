import { useState } from 'react';
import { formatSec, formatTotalHours, type CallsData } from '@/lib/dataParser';
import Icon from '@/components/ui/icon';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import CallsTable from '@/components/calls/CallsTable';
import RecommendationsBlock from '@/components/calls/RecommendationsBlock';
import TranscriptionTab from '@/components/calls/TranscriptionTab';
import AiInsightsTab from '@/components/calls/AiInsightsTab';
import AutoPilot from '@/components/calls/AutoPilot';
import ReportsManager from '@/components/calls/ReportsManager';

type Tab = 'overview' | 'calls' | 'transcription' | 'ai-insights' | 'recommendations';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Обзор', icon: 'LayoutDashboard' },
  { id: 'calls', label: 'Все звонки', icon: 'PhoneCall' },
  { id: 'transcription', label: 'Транскрибация', icon: 'Mic' },
  { id: 'ai-insights', label: 'Аналитика ИИ', icon: 'Sparkles' },
  { id: 'recommendations', label: 'Рекомендации', icon: 'Lightbulb' },
];

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

export default function Dashboard({ data, site, autoStart, activeReportId, onSwitchReport, onReset, onLogout }: {
  data: CallsData; site?: string; autoStart?: boolean;
  activeReportId?: string;
  onSwitchReport?: (data: CallsData, id: string) => void;
  onReset: () => void; onLogout?: () => void
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const [transcriptionCommId, setTranscriptionCommId] = useState<string | undefined>();
  const [analyticsRefreshTick, setAnalyticsRefreshTick] = useState(0);
  const [showReports, setShowReports] = useState(false);

  const HIDDEN_KEY = 'calls_hidden_ids';
  const loadHidden = (): Set<string> => {
    try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')); } catch { return new Set(); }
  };
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(loadHidden);
  const hideCall = (comm_id: string) => {
    setHiddenIds(prev => {
      const next = new Set(prev); next.add(comm_id);
      try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

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
              {site && (
                <span className="text-xs px-2 py-0.5 rounded-full hidden sm:inline flex items-center gap-1"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                  {site}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5"
                style={{ background: 'var(--brand-green-muted)', border: '1px solid rgba(0,255,136,0.2)', color: 'var(--brand-green)' }}>
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--brand-green)' }} />
                {data.total.toLocaleString('ru-RU')} звонков
              </div>
              <AutoPilot calls={data.calls} autoStart={autoStart} />
              <button onClick={() => setShowReports(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                <Icon name="FolderOpen" size={12} />
                <span className="hidden sm:inline">Отчёты</span>
              </button>

              {onLogout && (
                <button onClick={onLogout}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
                  <Icon name="LogOut" size={12} />
                  <span className="hidden sm:inline">Выйти</span>
                </button>
              )}
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
              <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="PhoneOutgoing" size={15} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Направление / статус</span>
                </div>
                {/* Направление (call_type) */}
                {(() => {
                  const callTypes: Record<string, number> = {};
                  for (const c of data.calls) {
                    if (c.call_type) callTypes[c.call_type] = (callTypes[c.call_type] || 0) + 1;
                  }
                  return (
                    <div className="space-y-1.5">
                      {Object.entries(callTypes).sort(([,a],[,b]) => b - a).map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{type}</span>
                          <span className="text-xs font-mono shrink-0" style={{ color: 'var(--brand-green)' }}>
                            {count.toLocaleString('ru-RU')}
                          </span>
                        </div>
                      ))}
                      <div className="pt-1.5 mt-1.5 space-y-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        {Object.entries(data.statuses).sort(([,a],[,b]) => b - a).map(([st, count]) => (
                          <div key={st} className="flex items-center justify-between gap-2">
                            <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{st}</span>
                            <span className="text-xs font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>
                              {count.toLocaleString('ru-RU')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
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
            <CallsTable calls={data.calls} hiddenIds={hiddenIds} onHideCall={hideCall} onGoToTranscription={(commId) => { setTranscriptionCommId(commId); setTab('transcription'); }} />
          </div>
        )}

        {/* ── ТРАНСКРИБАЦИЯ ── */}
        {tab === 'transcription' && (
          <div className="animate-fade-in">
            <TranscriptionTab key={transcriptionCommId || 'default'} calls={data.calls} hiddenIds={hiddenIds} onHideCall={hideCall} initialCommId={transcriptionCommId} onAnalysisDone={() => setAnalyticsRefreshTick(t => t + 1)} />
          </div>
        )}

        {/* ── АНАЛИТИКА ИИ ── */}
        {tab === 'ai-insights' && (
          <div className="animate-fade-in">
            <AiInsightsTab calls={data.calls} onGoToTranscription={(commId) => { setTranscriptionCommId(commId); setTab('transcription'); }} refreshTick={analyticsRefreshTick} />
          </div>
        )}

        {/* ── РЕКОМЕНДАЦИИ ── */}
        {tab === 'recommendations' && (
          <div className="animate-fade-in">
            <RecommendationsBlock data={data} />
          </div>
        )}
      </main>

      {showReports && (
        <ReportsManager
          activeId={activeReportId || ''}
          onSelect={(d, id) => {
            onSwitchReport?.(d, id);
            setShowReports(false);
          }}
          onNewReport={() => { setShowReports(false); onReset(); }}
          onClose={() => setShowReports(false)}
        />
      )}
    </div>
  );
}