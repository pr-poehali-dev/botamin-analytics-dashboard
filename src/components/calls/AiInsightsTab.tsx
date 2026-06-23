import { useState, useEffect, useRef, useMemo } from 'react';
import Icon from '@/components/ui/icon';
import { type AiStats } from './ai-insights/aiInsightsTypes';
import { type CallRecord } from '@/lib/dataParser';
import AiInsightsKpi from './ai-insights/AiInsightsKpi';
import AiInsightsCharts from './ai-insights/AiInsightsCharts';
import AiInsightsOutcomes from './ai-insights/AiInsightsOutcomes';

const AI_INSIGHTS_URL   = 'https://functions.poehali.dev/d671000f-9e45-471d-870d-789e1dd542c6';
const AI_STATS_URL      = `${AI_INSIGHTS_URL}?action=stats`;
const BATCH_API_URL     = 'https://functions.poehali.dev/f43c5cc1-1b9b-41aa-ac2a-416878c7f5b9';
const BATCH_ANALYZE_URL = `${BATCH_API_URL}?action=pending`;
const ANALYZE_URL       = 'https://functions.poehali.dev/6f70becf-3fb4-43a7-98a5-747436055b2d';

function toIso(d: string): string {
  if (!d) return '';
  if (d.includes('.')) { const [dd, mm, yyyy] = d.split('.'); return `${yyyy}-${mm}-${dd}`; }
  return d.slice(0, 10);
}

function getDoneMap(): Record<string, { ai?: Record<string, unknown> }> {
  try { return JSON.parse(localStorage.getItem('transcription_done_map') || '{}'); } catch { return {}; }
}

function calcPeriodStats(calls: CallRecord[], from: string, to: string) {
  const dm = getDoneMap();
  const callDateMap: Record<string, string> = {};
  for (const c of calls) callDateMap[c.comm_id] = toIso(c.date);

  let analyzed = 0, target = 0, success = 0, qualYes = 0;
  let scriptYes = 0, scriptTotal = 0, totalScore = 0, scoreCount = 0;

  for (const [id, entry] of Object.entries(dm)) {
    const ai = entry?.ai; if (!ai) continue;
    const iso = callDateMap[id] || '';
    if (!iso || iso < from || iso > to) continue;
    analyzed++;
    if (ai.call_type === 'target') target++;
    if (ai.outcome === 'success') success++;
    if (ai.qualification === true) qualYes++;
    if (ai.operator_followed_script === true) { scriptYes++; scriptTotal++; }
    else if (ai.operator_followed_script === false) scriptTotal++;
    if (typeof ai.operator_score === 'number') { totalScore += ai.operator_score as number; scoreCount++; }
  }
  return {
    analyzed,
    targetRate:  analyzed > 0 ? Math.round(target   / analyzed   * 100) : 0,
    convRate:    analyzed > 0 ? Math.round(success   / analyzed   * 100) : 0,
    qualRate:    analyzed > 0 ? Math.round(qualYes   / analyzed   * 100) : 0,
    scriptRate:  scriptTotal > 0 ? Math.round(scriptYes / scriptTotal * 100) : 0,
    avgScore:    scoreCount > 0 ? (totalScore / scoreCount).toFixed(1) : null,
  };
}

export default function AiInsightsTab({
  calls, onGoToTranscription, refreshTick,
}: {
  calls?: CallRecord[];
  onGoToTranscription?: (commId?: string) => void;
  refreshTick?: number;
}) {
  const [stats, setStats]               = useState<AiStats | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchTotal, setBatchTotal]     = useState(0);
  const [batchDone, setBatchDone]       = useState(0);
  const [batchCurrent, setBatchCurrent] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [showCompare, setShowCompare]   = useState(false);
  const stopRef = useRef(false);

  // Диапазон дат из проанализированных звонков
  const allDates = useMemo(() => {
    const dm = getDoneMap();
    const callDateMap: Record<string, string> = {};
    for (const c of (calls || [])) callDateMap[c.comm_id] = toIso(c.date);
    const dateSet = new Set<string>();
    for (const [id, v] of Object.entries(dm)) {
      if (v?.ai && callDateMap[id]) dateSet.add(callDateMap[id]);
    }
    return [...dateSet].sort();
  }, [calls]);

  const minDate = allDates[0] || '';
  const maxDate = allDates[allDates.length - 1] || '';

  // Период А — по умолчанию последние 30 дней
  const defaultAFrom = useMemo(() => {
    if (!maxDate) return minDate;
    const d = new Date(maxDate); d.setDate(d.getDate() - 29);
    const iso = d.toISOString().slice(0, 10);
    return iso < minDate ? minDate : iso;
  }, [maxDate, minDate]);

  // Период Б — по умолчанию предшествующие 30 дней
  const defaultBTo = useMemo(() => {
    if (!defaultAFrom) return '';
    const d = new Date(defaultAFrom); d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, [defaultAFrom]);

  const defaultBFrom = useMemo(() => {
    if (!defaultBTo) return minDate;
    const d = new Date(defaultBTo); d.setDate(d.getDate() - 29);
    const iso = d.toISOString().slice(0, 10);
    return iso < minDate ? minDate : iso;
  }, [defaultBTo, minDate]);

  const [aFrom, setAFrom] = useState('');
  const [aTo,   setATo]   = useState('');
  const [bFrom, setBFrom] = useState('');
  const [bTo,   setBTo]   = useState('');

  // Инициализируем даты когда они посчитаны
  useEffect(() => {
    if (defaultAFrom && !aFrom) setAFrom(defaultAFrom);
    if (maxDate      && !aTo)   setATo(maxDate);
    if (defaultBFrom && !bFrom) setBFrom(defaultBFrom);
    if (defaultBTo   && !bTo)   setBTo(defaultBTo);
  }, [defaultAFrom, maxDate, defaultBFrom, defaultBTo]); // eslint-disable-line

  const periodStats = useMemo(() => {
    if (!showCompare || !aFrom || !aTo || !bFrom || !bTo) return null;
    return {
      a: calcPeriodStats(calls || [], aFrom, aTo),
      b: calcPeriodStats(calls || [], bFrom, bTo),
    };
  }, [showCompare, aFrom, aTo, bFrom, bTo, calls]);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [statsRes, pendingRes] = await Promise.all([
        fetch(AI_STATS_URL), fetch(BATCH_ANALYZE_URL),
      ]);
      const data    = await statsRes.json();
      const pending = await pendingRes.json();
      setStats(data);
      setPendingCount(pending.count || 0);
    } catch {
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchAnalyze = async () => {
    const res  = await fetch(BATCH_ANALYZE_URL);
    const data = await res.json();
    const pending = data.pending || [];
    if (!pending.length) return;
    stopRef.current = false;
    setBatchRunning(true); setBatchTotal(pending.length); setBatchDone(0);
    for (let i = 0; i < pending.length; i++) {
      if (stopRef.current) break;
      const item = pending[i];
      setBatchCurrent(item.comm_id);
      try {
        await fetch(ANALYZE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: item.full_text, comm_id: item.comm_id, duration_sec: item.duration_sec }),
        });
      } catch { /* продолжаем */ }
      setBatchDone(i + 1);
      if (i < pending.length - 1) await sleep(1500);
    }
    setBatchRunning(false); setBatchCurrent(''); setPendingCount(0);
    load();
  };

  useEffect(() => { load(); }, [refreshTick]);  

  // ── Early returns (после всех хуков) ────────────────────────────────────────

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ background: 'var(--brand-green)', animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Загружаю аналитику…</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Icon name="AlertTriangle" size={32} style={{ color: '#ff4444' }} />
      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{error}</p>
      <button onClick={load} className="px-4 py-2 rounded-lg text-xs"
        style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
        Повторить
      </button>
    </div>
  );

  if (!stats || stats.empty || stats.total === 0) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'var(--brand-green-muted)' }}>
        <Icon name="Sparkles" size={28} style={{ color: 'var(--brand-green)' }} />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          Пока нет проанализированных звонков
        </p>
        <p className="text-xs max-w-sm" style={{ color: 'var(--text-muted)' }}>
          {pendingCount > 0
            ? `${pendingCount} звонков транскрибированы и готовы к анализу`
            : 'Сначала транскрибируйте звонки во вкладке «Транскрибация»'}
        </p>
      </div>
      {pendingCount > 0 && !batchRunning && (
        <button onClick={handleBatchAnalyze}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
          style={{ background: 'var(--brand-green)', color: '#000' }}>
          <Icon name="Sparkles" size={15} />
          Анализировать все ({pendingCount})
        </button>
      )}
      {batchRunning && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2.5 h-2.5 rounded-full animate-pulse"
                style={{ background: 'var(--brand-green)', animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
          <p className="text-xs" style={{ color: 'var(--brand-green)' }}>Анализирую {batchDone}/{batchTotal}…</p>
        </div>
      )}
    </div>
  );

  // ── Стили инпутов ────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', borderRadius: '8px', padding: '6px 10px',
    fontSize: '12px', outline: 'none', width: '100%',
  };

  return (
    <div className="space-y-6 animate-fade-in overflow-hidden">

      {/* ── Сравнение периодов ── */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
        <button
          onClick={() => setShowCompare(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5"
          style={{ background: 'var(--bg-card)' }}>
          <div className="flex items-center gap-2">
            <Icon name="ArrowLeftRight" size={14} style={{ color: 'var(--brand-green)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Сравнение периодов
            </span>
            {!showCompare && aFrom && aTo && bFrom && bTo && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                — нажми чтобы выбрать и сравнить два периода
              </span>
            )}
          </div>
          <Icon name={showCompare ? 'ChevronUp' : 'ChevronDown'} size={14} style={{ color: 'var(--text-muted)' }} />
        </button>

        {showCompare && (
          <div className="px-5 pb-5 space-y-4"
            style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border-subtle)' }}>

            <div className="grid sm:grid-cols-2 gap-4 pt-4">
              {/* Период А */}
              <div className="rounded-xl p-4 space-y-3"
                style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.2)' }}>
                <p className="text-xs font-bold tracking-wider" style={{ color: 'var(--brand-green)' }}>ПЕРИОД А</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>С</p>
                    <input type="date" value={aFrom} min={minDate} max={aTo}
                      onChange={e => setAFrom(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>По</p>
                    <input type="date" value={aTo} min={aFrom} max={maxDate}
                      onChange={e => setATo(e.target.value)} style={inputStyle} />
                  </div>
                </div>
                {periodStats && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {[
                      { l: 'Звонков', v: periodStats.a.analyzed.toString() },
                      { l: 'Целевые', v: `${periodStats.a.targetRate}%` },
                      { l: 'Конверсия', v: `${periodStats.a.convRate}%` },
                      { l: 'Квалификация', v: `${periodStats.a.qualRate}%` },
                      { l: 'Скрипт', v: `${periodStats.a.scriptRate}%` },
                      { l: 'Ср. оценка', v: periodStats.a.avgScore ?? '—' },
                    ].map((r, i) => (
                      <div key={i}>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.l}</p>
                        <p className="text-sm font-bold font-mono" style={{ color: 'var(--brand-green)' }}>{r.v}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Период Б */}
              <div className="rounded-xl p-4 space-y-3"
                style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.2)' }}>
                <p className="text-xs font-bold tracking-wider" style={{ color: '#60a5fa' }}>ПЕРИОД Б</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>С</p>
                    <input type="date" value={bFrom} min={minDate} max={bTo}
                      onChange={e => setBFrom(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>По</p>
                    <input type="date" value={bTo} min={bFrom} max={maxDate}
                      onChange={e => setBTo(e.target.value)} style={inputStyle} />
                  </div>
                </div>
                {periodStats && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {[
                      { l: 'Звонков', v: periodStats.b.analyzed.toString() },
                      { l: 'Целевые', v: `${periodStats.b.targetRate}%` },
                      { l: 'Конверсия', v: `${periodStats.b.convRate}%` },
                      { l: 'Квалификация', v: `${periodStats.b.qualRate}%` },
                      { l: 'Скрипт', v: `${periodStats.b.scriptRate}%` },
                      { l: 'Ср. оценка', v: periodStats.b.avgScore ?? '—' },
                    ].map((r, i) => (
                      <div key={i}>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.l}</p>
                        <p className="text-sm font-bold font-mono" style={{ color: '#60a5fa' }}>{r.v}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Итог сравнения — дельта А vs Б */}
            {periodStats && periodStats.a.analyzed > 0 && periodStats.b.analyzed > 0 && (
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-elevated)' }}>
                <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
                  ПЕРИОД А vs ПЕРИОД Б
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { l: 'Целевые',      a: periodStats.a.targetRate,                      b: periodStats.b.targetRate,                      unit: '%' },
                    { l: 'Конверсия',    a: periodStats.a.convRate,                        b: periodStats.b.convRate,                        unit: '%' },
                    { l: 'Квалификация', a: periodStats.a.qualRate,                        b: periodStats.b.qualRate,                        unit: '%' },
                    { l: 'Скрипт',       a: periodStats.a.scriptRate,                      b: periodStats.b.scriptRate,                      unit: '%' },
                    { l: 'Ср. оценка',   a: parseFloat(periodStats.a.avgScore || '0'),     b: parseFloat(periodStats.b.avgScore || '0'),     unit: '' },
                  ].map((m, i) => {
                    const diff = Math.round((m.a - m.b) * 10) / 10;
                    const isUp = diff > 0, isDown = diff < 0;
                    return (
                      <div key={i} className="text-center">
                        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{m.l}</p>
                        <p className="text-base font-black font-mono"
                          style={{ color: isUp ? 'var(--brand-green)' : isDown ? '#ff4444' : 'var(--text-muted)' }}>
                          {isUp ? '+' : ''}{diff}{m.unit}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {m.a}{m.unit} / {m.b}{m.unit}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <AiInsightsKpi
        stats={stats}
        pendingCount={pendingCount}
        batchRunning={batchRunning}
        batchDone={batchDone}
        batchTotal={batchTotal}
        batchCurrent={batchCurrent}
        onBatchAnalyze={handleBatchAnalyze}
        onStopBatch={() => { stopRef.current = true; }}
        onRefresh={load}
        onGoToTranscription={onGoToTranscription}
      />
      <AiInsightsCharts stats={stats} calls={calls || []} />
      <AiInsightsOutcomes stats={stats} onGoToTranscription={onGoToTranscription} />
    </div>
  );
}