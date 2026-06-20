import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import {
  listReports, loadReport, deleteReport, renameReport, mergeReports,
  getActiveReportId, setActiveReportId,
  type Report,
} from '@/lib/reports';
import { type CallsData } from '@/lib/dataParser';

interface Props {
  onSelect:     (data: CallsData, id: string) => void;
  onNewReport:  () => void;
  onClose:      () => void;
  activeId:     string;
}

export default function ReportsManager({ onSelect, onNewReport, onClose, activeId }: Props) {
  const [reports, setReports]       = useState<Report[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [merging, setMerging]       = useState(false);
  const [renaming, setRenaming]     = useState<string | null>(null);
  const [renameVal, setRenameVal]   = useState('');
  const [switching, setSwitching]   = useState<string | null>(null);

  useEffect(() => {
    listReports().then(r => { setReports(r); setLoading(false); });
  }, []);

  const refresh = () => listReports().then(setReports);

  const handleSelect = async (id: string) => {
    setSwitching(id);
    const data = await loadReport(id);
    if (data) {
      setActiveReportId(id);
      onSelect(data, id);
      onClose();
    }
    setSwitching(null);
  };

  const handleDelete = async (id: string) => {
    await deleteReport(id);
    refresh();
  };

  const handleRename = async (id: string) => {
    if (renameVal.trim()) await renameReport(id, renameVal.trim());
    setRenaming(null);
    refresh();
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const handleMerge = async () => {
    if (selected.size < 2) return;
    setMerging(true);
    const data = await mergeReports([...selected]);
    setMerging(false);
    if (data) onSelect(data, '__merged__');
  };

  const fmtDate = (iso: string) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border-default)' }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Мои отчёты</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {reports.length} отчёт{reports.length === 1 ? '' : reports.length < 5 ? 'а' : 'ов'}
              {selected.size > 0 && <span style={{ color: 'var(--brand-green)' }}> · выбрано {selected.size}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onNewReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'var(--brand-green)', color: '#000' }}>
              <Icon name="Plus" size={13} />
              Новый
            </button>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
              <Icon name="X" size={14} />
            </button>
          </div>
        </div>

        {/* Объединить */}
        {selected.size >= 2 && (
          <div className="px-5 py-3 shrink-0"
            style={{ borderBottom: '1px solid var(--border-default)', background: 'rgba(0,255,136,0.04)' }}>
            <button
              onClick={handleMerge}
              disabled={merging}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ background: 'var(--brand-green)', color: '#000' }}>
              {merging ? (
                <>
                  <span className="flex gap-1">
                    {[0,1,2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full animate-pulse inline-block"
                        style={{ background: '#000', animationDelay: `${i*0.15}s` }} />
                    ))}
                  </span>
                  Объединяю…
                </>
              ) : (
                <>
                  <Icon name="Merge" size={15} />
                  Объединить {selected.size} отчёта и открыть
                </>
              )}
            </button>
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              Звонки будут объединены — отчёты не изменятся
            </p>
          </div>
        )}

        {/* Список */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="flex gap-1.5">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full animate-pulse"
                    style={{ background: 'var(--brand-green)', animationDelay: `${i*0.2}s` }} />
                ))}
              </div>
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Icon name="FolderOpen" size={36} style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Нет сохранённых отчётов</p>
              <button onClick={onNewReport}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--brand-green)', color: '#000' }}>
                <Icon name="Upload" size={14} />
                Загрузить первый отчёт
              </button>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {reports.map(r => {
                const isActive   = r.id === activeId;
                const isSelected = selected.has(r.id);
                const isSwitching = switching === r.id;

                return (
                  <div key={r.id}
                    className="flex items-center gap-3 px-5 py-3.5 transition-all"
                    style={{ background: isActive ? 'rgba(0,255,136,0.04)' : isSelected ? 'rgba(0,255,136,0.03)' : 'transparent' }}>

                    {/* Чекбокс для объединения */}
                    <button
                      onClick={() => toggleSelect(r.id)}
                      className="w-5 h-5 rounded flex items-center justify-center shrink-0 transition-all"
                      style={{
                        background: isSelected ? 'var(--brand-green)' : 'var(--bg-elevated)',
                        border: `1px solid ${isSelected ? 'var(--brand-green)' : 'var(--border-default)'}`,
                      }}>
                      {isSelected && <Icon name="Check" size={11} style={{ color: '#000' }} />}
                    </button>

                    {/* Инфо */}
                    <div className="flex-1 min-w-0" onClick={() => handleSelect(r.id)}
                      style={{ cursor: 'pointer' }}>
                      {renaming === r.id ? (
                        <input
                          autoFocus
                          value={renameVal}
                          onChange={e => setRenameVal(e.target.value)}
                          onBlur={() => handleRename(r.id)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRename(r.id); if (e.key === 'Escape') setRenaming(null); }}
                          onClick={e => e.stopPropagation()}
                          className="w-full text-sm font-semibold bg-transparent outline-none border-b"
                          style={{ color: 'var(--text-primary)', borderColor: 'var(--brand-green)' }}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate" style={{ color: isActive ? 'var(--brand-green)' : 'var(--text-primary)' }}>
                            {r.name}
                          </p>
                          {isActive && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0"
                              style={{ background: 'rgba(0,255,136,0.15)', color: 'var(--brand-green)' }}>
                              активен
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {r.total.toLocaleString('ru-RU')} звонков
                        </span>
                        {r.dateFrom && (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            · {fmtDate(r.dateFrom)}–{fmtDate(r.dateTo)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Действия */}
                    <div className="flex items-center gap-1 shrink-0">
                      {isSwitching ? (
                        <div className="flex gap-1 px-2">
                          {[0,1,2].map(i => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full animate-pulse"
                              style={{ background: 'var(--brand-green)', animationDelay: `${i*0.15}s` }} />
                          ))}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSelect(r.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                          style={{
                            background: isActive ? 'rgba(0,255,136,0.12)' : 'var(--bg-elevated)',
                            color: isActive ? 'var(--brand-green)' : 'var(--text-secondary)',
                            border: `1px solid ${isActive ? 'rgba(0,255,136,0.25)' : 'var(--border-default)'}`,
                          }}>
                          {isActive ? 'Открыт' : 'Открыть'}
                        </button>
                      )}
                      <button
                        onClick={() => { setRenaming(r.id); setRenameVal(r.name); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
                        style={{ color: 'var(--text-muted)' }}>
                        <Icon name="Pencil" size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
                        style={{ color: '#ff6666' }}>
                        <Icon name="Trash2" size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}