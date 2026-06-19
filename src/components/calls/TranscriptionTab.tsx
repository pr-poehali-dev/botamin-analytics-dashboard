import { type CallRecord } from '@/lib/dataParser';
import Icon from '@/components/ui/icon';
import { useTranscriptionState } from '@/components/calls/useTranscriptionState';
import TranscriptionSidebar from '@/components/calls/TranscriptionSidebar';
import TranscriptionCallHeader from '@/components/calls/TranscriptionCallHeader';
import CallTranscriptView from '@/components/calls/CallTranscriptView';

export default function TranscriptionTab({
  calls,
  hiddenIds: hiddenIdsProp,
  onHideCall,
  initialCommId,
  onAnalysisDone,
}: {
  calls: CallRecord[];
  hiddenIds?: Set<string>;
  onHideCall?: (id: string) => void;
  initialCommId?: string;
  onAnalysisDone?: () => void;
}) {
  const state = useTranscriptionState({ calls, onHideCall, initialCommId, onAnalysisDone });

  const {
    selectedCall, result, doneMap, ignoreMap,
    batchRunning, batchTotal, batchDone, batchCurrent,
    handleTranscribe, handleAnalyze,
    handleBatchStart, handleBatchStop,
    ignoreCall, unignoreCall, deleteCall,
    setResult,
  } = state;

  const visibleCalls = calls.filter(c => !hiddenIdsProp?.has(c.comm_id));

  return (
    <div className="flex gap-6 h-[calc(100vh-120px)]">

      {/* Левая панель */}
      <TranscriptionSidebar
        calls={visibleCalls}
        selectedCall={selectedCall}
        result={result}
        doneMap={doneMap}
        batchRunning={batchRunning}
        batchTotal={batchTotal}
        batchDone={batchDone}
        batchCurrent={batchCurrent}
        onSelect={handleTranscribe}
        onBatchStart={handleBatchStart}
        onBatchStop={handleBatchStop}
      />

      {/* Правая панель */}
      <div className="flex-1 overflow-y-auto">
        {!selectedCall && (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--brand-green-muted)' }}>
              <Icon name="Mic" size={28} style={{ color: 'var(--brand-green)' }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Выберите звонок</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Нажмите на звонок слева — откроется транскрипт и ИИ-анализ
              </p>
            </div>
          </div>
        )}

        {selectedCall && result && (
          <div>
            <TranscriptionCallHeader
              selectedCall={selectedCall}
              result={result}
              ignoreMap={ignoreMap}
              onIgnore={ignoreCall}
              onUnignore={unignoreCall}
              onDelete={deleteCall}
            />

            <CallTranscriptView
              result={result}
              onAnalyze={handleAnalyze}
              onResultUpdate={(updated) => setResult(prev => prev ? { ...prev, ...updated } : null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
