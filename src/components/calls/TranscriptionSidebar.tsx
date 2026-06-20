import Icon from '@/components/ui/icon';
import { type CallRecord } from '@/lib/dataParser';
import { type TranscriptResult } from '@/components/calls/transcriptionTypes';
import { type DoneMap } from '@/components/calls/useTranscriptionState';
import CallsList from '@/components/calls/CallsList';

interface Props {
  calls: CallRecord[];
  selectedCall: CallRecord | null;
  result: TranscriptResult | null;
  doneMap: DoneMap;
  batchRunning: boolean;
  batchTotal: number;
  batchDone: number;
  batchCurrent: string;
  onSelect: (call: CallRecord) => void;
  onBatchStart: () => void;
  onBatchStop: () => void;
}

export default function TranscriptionSidebar({
  calls, selectedCall, result, doneMap,
  batchRunning, batchTotal, batchDone, batchCurrent,
  onSelect, onBatchStart, onBatchStop,
}: Props) {
  const callsWithRecords = calls.filter(c => c.record_url).length;
  const doneCount        = Object.keys(doneMap).length;

  return (
    <div className="w-full sm:w-72 sm:shrink-0 flex flex-col gap-3">

      {/* Заголовок + прогресс */}
      <div>
        <h2 className="text-sm font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>Транскрибация</h2>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {callsWithRecords} звонков с записью · <span style={{ color: 'var(--brand-green)' }}>{doneCount} готово</span>
        </p>
      </div>

      {/* Батч-кнопка */}
      {!batchRunning ? (
        <button
          onClick={onBatchStart}
          disabled={doneCount === callsWithRecords}
          className="w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
          style={{
            background: doneCount === callsWithRecords ? 'var(--bg-elevated)' : 'var(--brand-green)',
            color:      doneCount === callsWithRecords ? 'var(--text-muted)' : '#000',
            cursor:     doneCount === callsWithRecords ? 'default' : 'pointer',
          }}>
          <Icon name="PlayCircle" size={13} />
          {doneCount === callsWithRecords ? 'Всё транскрибировано' : `Транскрибировать все (${callsWithRecords - doneCount})`}
        </button>
      ) : (
        <div className="rounded-lg p-2.5 space-y-2" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--brand-green)' }}>
              {batchDone} / {batchTotal}
            </span>
            <button onClick={onBatchStop} className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(255,68,68,0.1)', color: '#ff4444' }}>
              Стоп
            </button>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-default)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${batchTotal ? (batchDone / batchTotal) * 100 : 0}%`, background: 'var(--brand-green)' }} />
          </div>
          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
            ID: {batchCurrent}
          </p>
        </div>
      )}

      <CallsList
        calls={calls}
        selectedCall={selectedCall}
        result={result}
        doneMap={doneMap}
        onSelect={onSelect}
      />
    </div>
  );
}