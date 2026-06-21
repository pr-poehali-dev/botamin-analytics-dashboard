import { useState } from 'react';
import { type CallsData } from '@/lib/dataParser';
import CallsTable from '@/components/calls/CallsTable';
import RecommendationsBlock from '@/components/calls/RecommendationsBlock';
import TranscriptionTab from '@/components/calls/TranscriptionTab';
import AiInsightsTab from '@/components/calls/AiInsightsTab';
import ReportsManager from '@/components/calls/ReportsManager';
import DashboardHeader from '@/components/calls/DashboardHeader';
import OverviewTab from '@/components/calls/OverviewTab';

type Tab = 'overview' | 'calls' | 'transcription' | 'ai-insights' | 'recommendations';

export default function Dashboard({ data, site, autoStart, activeReportId, onSwitchReport, onReset, onLogout }: {
  data: CallsData; site?: string; autoStart?: boolean;
  activeReportId?: string;
  onSwitchReport?: (data: CallsData, id: string) => void;
  onReset: () => void; onLogout?: () => void;
}) {
  const [tab, setTab]                               = useState<Tab>('overview');
  const [transcriptionCommId, setTranscriptionCommId] = useState<string | undefined>();
  const [analyticsRefreshTick, setAnalyticsRefreshTick] = useState(0);
  const [showReports, setShowReports]               = useState(false);

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

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)', fontFamily: "'Golos Text', sans-serif" }}>

      <DashboardHeader
        site={site}
        total={data.total}
        calls={data.calls}
        autoStart={autoStart}
        tab={tab}
        onTabChange={setTab}
        onShowReports={() => setShowReports(true)}
        onLogout={onLogout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* ── ОБЗОР ── */}
        {tab === 'overview' && (
          <OverviewTab data={data} />
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
            <CallsTable calls={data.calls} hiddenIds={hiddenIds} onHideCall={hideCall}
              onGoToTranscription={(commId) => { setTranscriptionCommId(commId); setTab('transcription'); }} />
          </div>
        )}

        {/* ── ТРАНСКРИБАЦИЯ ── */}
        {tab === 'transcription' && (
          <div className="animate-fade-in">
            <TranscriptionTab key={transcriptionCommId || 'default'} calls={data.calls}
              hiddenIds={hiddenIds} onHideCall={hideCall}
              initialCommId={transcriptionCommId}
              onAnalysisDone={() => setAnalyticsRefreshTick(t => t + 1)} />
          </div>
        )}

        {/* ── АНАЛИТИКА ИИ ── */}
        {tab === 'ai-insights' && (
          <div className="animate-fade-in">
            <AiInsightsTab calls={data.calls}
              onGoToTranscription={(commId) => { setTranscriptionCommId(commId); setTab('transcription'); }}
              refreshTick={analyticsRefreshTick} />
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
          onSelect={(d, id) => { onSwitchReport?.(d, id); setShowReports(false); }}
          onNewReport={() => { setShowReports(false); onReset(); }}
          onClose={() => setShowReports(false)}
        />
      )}
    </div>
  );
}