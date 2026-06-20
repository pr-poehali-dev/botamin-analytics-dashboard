import { useState, useEffect, useRef } from 'react';
import Icon from '@/components/ui/icon';
import { type AiStats } from './ai-insights/aiInsightsTypes';
import { type CallRecord } from '@/lib/dataParser';
import AiInsightsKpi from './ai-insights/AiInsightsKpi';
import AiInsightsCharts from './ai-insights/AiInsightsCharts';
import AiInsightsOutcomes from './ai-insights/AiInsightsOutcomes';

const AI_STATS_URL      = 'https://functions.poehali.dev/db240be1-ed61-46d9-bcbf-59bbc6130fea';
const BATCH_ANALYZE_URL = 'https://functions.poehali.dev/8d6690af-4758-4719-9e1b-225186836018';
const ANALYZE_URL       = 'https://functions.poehali.dev/6f70becf-3fb4-43a7-98a5-747436055b2d';

export default function AiInsightsTab({ calls, onGoToTranscription, refreshTick }: { calls?: CallRecord[]; onGoToTranscription?: (commId?: string) => void; refreshTick?: number }) {
  const [stats, setStats]         = useState<AiStats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  // Батч-анализ
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchTotal, setBatchTotal]     = useState(0);
  const [batchDone, setBatchDone]       = useState(0);
  const [batchCurrent, setBatchCurrent] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const stopRef = useRef(false);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, pendingRes] = await Promise.all([
        fetch(AI_STATS_URL),
        fetch(BATCH_ANALYZE_URL),
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
    const res     = await fetch(BATCH_ANALYZE_URL);
    const data    = await res.json();
    const pending = data.pending || [];
    if (!pending.length) return;

    stopRef.current = false;
    setBatchRunning(true);
    setBatchTotal(pending.length);
    setBatchDone(0);

    for (let i = 0; i < pending.length; i++) {
      if (stopRef.current) break;
      const item = pending[i];
      setBatchCurrent(item.comm_id);
      try {
        await fetch(ANALYZE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript:   item.full_text,
            comm_id:      item.comm_id,
            duration_sec: item.duration_sec,
          }),
        });
      } catch { /* продолжаем */ }
      setBatchDone(i + 1);
      if (i < pending.length - 1) await sleep(1500);
    }

    setBatchRunning(false);
    setBatchCurrent('');
    setPendingCount(0);
    load();
  };

  useEffect(() => { load(); }, [refreshTick]);

  if (loading) {
    return (
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
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Icon name="AlertTriangle" size={32} style={{ color: '#ff4444' }} />
        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{error}</p>
        <button onClick={load} className="px-4 py-2 rounded-lg text-xs"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
          Повторить
        </button>
      </div>
    );
  }

  if (!stats || stats.empty || stats.total === 0) {
    return (
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
              {[0,1,2].map(i => (
                <div key={i} className="w-2.5 h-2.5 rounded-full animate-pulse"
                  style={{ background: 'var(--brand-green)', animationDelay: `${i*0.2}s` }} />
              ))}
            </div>
            <p className="text-xs" style={{ color: 'var(--brand-green)' }}>
              Анализирую {batchDone}/{batchTotal}…
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
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