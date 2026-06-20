import { type CallRecord } from '@/lib/dataParser';
import Icon from '@/components/ui/icon';
import { type DoneMap, durColor } from './callsTableTypes';
import { getAiStatus } from './callStatus';

interface Props {
  call: CallRecord;
  index: number;
  doneMap: DoneMap;
  inProgress: Set<string>;
  onGoToTranscription?: (commId: string) => void;
  onTranscribe: (call: CallRecord) => void;
  onHide: (commId: string) => void;
}

export default function CallsRow({ call: c, index: i, doneMap, inProgress, onGoToTranscription, onTranscribe, onHide }: Props) {
  const hasTr     = !!doneMap[c.comm_id];
  const isPending = inProgress.has(c.comm_id);
  const aiStatus  = getAiStatus(doneMap[c.comm_id]?.ai);

  return (
    <div
      className="grid gap-2 px-4 py-2.5 text-xs border-b items-center group cursor-pointer transition-all hover:bg-white/5"
      onClick={() => onGoToTranscription?.(c.comm_id)}
      style={{
        gridTemplateColumns: '1.5fr 1.5fr 1.2fr 1.8fr 1.5fr 1.2fr 1.5fr 32px',
        borderColor: 'var(--border-subtle)',
        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
      }}>
      <div className="font-mono" style={{ color: 'var(--text-secondary)' }}>{c.date}</div>
      <div className="font-mono font-semibold" style={{ color: durColor(c.duration_sec) }}>{c.duration}</div>
      <div>
        {aiStatus ? (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
            style={{ background: aiStatus.bg, color: aiStatus.color }}>
            <Icon name={aiStatus.icon} size={10} />
            {aiStatus.label}
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-xs"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
            {c.status}
          </span>
        )}
      </div>
      <div className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{c.comm_id || '—'}</div>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.call_type}</div>
      <div onClick={e => e.stopPropagation()}>
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
      <div onClick={e => e.stopPropagation()}>
        {hasTr ? (
          <button onClick={() => onGoToTranscription?.(c.comm_id)}
            className="flex items-center gap-1 transition-opacity hover:opacity-70"
            style={{ color: 'var(--brand-green)' }}>
            <Icon name="FileText" size={11} />
            Открыть
          </button>
        ) : isPending ? (
          <span className="flex items-center gap-1" style={{ color: '#ff8c00' }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#ff8c00' }} />
            Идёт…
          </span>
        ) : c.record_url ? (
          <button onClick={() => onTranscribe(c)}
            className="flex items-center gap-1 transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}>
            <Icon name="Mic" size={11} />
            Транскрибировать
          </button>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </div>
      <div className="flex justify-end" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onHide(c.comm_id)}
          className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-100"
          style={{ color: '#ff4444' }}
          title="Удалить строку">
          <Icon name="X" size={12} />
        </button>
      </div>
    </div>
  );
}
