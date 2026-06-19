import { useState } from 'react';
import { type CallRecord } from '@/lib/dataParser';
import { type TranscriptResult } from '@/components/calls/transcriptionTypes';
import { type IgnoreMap, IGNORE_REASONS } from '@/components/calls/useTranscriptionState';
import Icon from '@/components/ui/icon';

interface Props {
  selectedCall: CallRecord;
  result: TranscriptResult;
  ignoreMap: IgnoreMap;
  onIgnore: (comm_id: string, reason_id: string) => void;
  onUnignore: (comm_id: string) => void;
  onDelete: (comm_id: string) => void;
}

export default function TranscriptionCallHeader({
  selectedCall, result, ignoreMap, onIgnore, onUnignore, onDelete,
}: Props) {
  const [showIgnoreMenu,   setShowIgnoreMenu]   = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const comm_id  = selectedCall.comm_id;
  const isIgnored = !!ignoreMap[comm_id];

  return (
    <>
      {/* Шапка */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Звонок {selectedCall.date} · {selectedCall.duration}
            </h3>
            {result.cached && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--brand-green)' }}>
                <Icon name="Database" size={10} />
                из кэша
              </span>
            )}
            {isIgnored && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(255,140,0,0.12)', color: '#ff8c00' }}>
                <Icon name="EyeOff" size={10} />
                Игнорируется
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            ID: {comm_id} · {selectedCall.call_type}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">

          {/* Кнопка Игнорировать */}
          <div className="relative">
            {isIgnored ? (
              <button
                onClick={() => onUnignore(comm_id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
                style={{ background: 'rgba(255,140,0,0.1)', border: '1px solid rgba(255,140,0,0.25)', color: '#ff8c00' }}>
                <Icon name="Eye" size={12} />
                Восстановить
              </button>
            ) : (
              <button
                onClick={() => setShowIgnoreMenu(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                <Icon name="EyeOff" size={12} />
                Игнорировать
              </button>
            )}

            {showIgnoreMenu && (
              <div className="absolute right-0 top-full mt-1 w-64 rounded-xl overflow-hidden z-30 shadow-2xl"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Причина игнорирования</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Звонок будет исключён из аналитики</p>
                </div>
                {IGNORE_REASONS.map(r => (
                  <button key={r.id}
                    onClick={() => { onIgnore(comm_id, r.id); setShowIgnoreMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <Icon name={r.icon} size={13} style={{ color: '#ff8c00', flexShrink: 0 }} />
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
                  </button>
                ))}
                <button
                  onClick={() => setShowIgnoreMenu(false)}
                  className="w-full px-3 py-2 text-xs text-center transition-colors hover:bg-white/5"
                  style={{ color: 'var(--text-muted)' }}>
                  Отмена
                </button>
              </div>
            )}
          </div>

          {/* Кнопка Удалить */}
          <div className="relative">
            <button
              onClick={() => setShowDeleteConfirm(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
              style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.25)', color: '#ff4444' }}>
              <Icon name="Trash2" size={12} />
              Удалить
            </button>
            {showDeleteConfirm && (
              <div className="absolute right-0 top-full mt-1 w-60 rounded-xl z-30 shadow-2xl p-4 space-y-3"
                style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,68,68,0.3)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Удалить звонок?</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Звонок исчезнет из списка транскрибации. Вернуть нельзя.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { onDelete(comm_id); setShowDeleteConfirm(false); }}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                    style={{ background: '#ff4444', color: '#fff' }}>
                    Удалить
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>

          {selectedCall.record_url && (
            <a href={selectedCall.record_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
              <Icon name="Play" size={12} />
              Слушать
            </a>
          )}
        </div>
      </div>

      {/* Баннер если игнорируется */}
      {isIgnored && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4"
          style={{ background: 'rgba(255,140,0,0.06)', border: '1px solid rgba(255,140,0,0.2)' }}>
          <Icon name="EyeOff" size={15} style={{ color: '#ff8c00', flexShrink: 0 }} />
          <div className="flex-1">
            <p className="text-xs font-semibold" style={{ color: '#ff8c00' }}>Звонок исключён из аналитики</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Причина: {IGNORE_REASONS.find(r => r.id === ignoreMap[comm_id])?.label || 'Другое'}
            </p>
          </div>
          <button onClick={() => onUnignore(comm_id)}
            className="text-xs px-2 py-1 rounded-lg transition-opacity hover:opacity-70"
            style={{ background: 'rgba(255,140,0,0.15)', color: '#ff8c00' }}>
            Восстановить
          </button>
        </div>
      )}
    </>
  );
}
