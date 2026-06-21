import { useState, useRef, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import AutoPilot from '@/components/calls/AutoPilot';
import { type CallRecord } from '@/lib/dataParser';

type Tab = 'overview' | 'calls' | 'transcription' | 'ai-insights' | 'recommendations';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview',        label: 'Обзор',         icon: 'LayoutDashboard' },
  { id: 'calls',           label: 'Все звонки',    icon: 'PhoneCall' },
  { id: 'transcription',   label: 'Транскрибация', icon: 'Mic' },
  { id: 'ai-insights',     label: 'Аналитика ИИ',  icon: 'Sparkles' },
  { id: 'recommendations', label: 'Рекомендации',  icon: 'Lightbulb' },
];

interface Props {
  site?: string;
  total: number;
  calls: CallRecord[];
  autoStart?: boolean;
  tab: Tab;
  onTabChange: (t: Tab) => void;
  onShowReports: () => void;
  onLogout?: () => void;
}

export default function DashboardHeader({
  site, total, calls, autoStart, tab, onTabChange, onShowReports, onLogout,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Закрываем меню по клику вне
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const activeTab = TABS.find(t => t.id === tab);

  return (
    <header className="sticky top-0 z-40 border-b"
      style={{ background: 'rgba(10,10,10,0.96)', borderColor: 'var(--border-default)', backdropFilter: 'blur(12px)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-12 sm:h-14 gap-2">

          {/* Лого */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-md flex items-center justify-center font-black text-sm shrink-0"
              style={{ background: 'var(--brand-green)', color: '#000' }}>S</div>
            <span className="font-bold text-sm hidden sm:inline" style={{ color: 'var(--text-primary)' }}>СайтАктив</span>
            {site && (
              <span className="text-xs px-2 py-0.5 rounded-full hidden md:inline"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                {site}
              </span>
            )}
          </div>

          {/* Навигация — десктоп: таб-строка, мобиль: дропдаун */}
          <div className="flex-1 flex justify-center" ref={menuRef}>

            {/* Десктоп табы */}
            <div className="hidden sm:flex items-center gap-0">
              {TABS.map(t => (
                <button key={t.id} onClick={() => onTabChange(t.id)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-all"
                  style={{
                    borderColor: tab === t.id ? 'var(--brand-green)' : 'transparent',
                    color: tab === t.id ? 'var(--brand-green)' : 'var(--text-muted)',
                    marginBottom: '-1px',
                  }}>
                  <Icon name={t.icon} size={13} />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Мобиль — кнопка текущего раздела + дропдаун */}
            <div className="sm:hidden relative w-full max-w-xs">
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-sm font-semibold"
                style={{
                  background: menuOpen ? 'var(--bg-elevated)' : 'var(--bg-card)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--brand-green)',
                }}>
                <Icon name={activeTab?.icon || 'LayoutDashboard'} size={14} />
                <span className="flex-1 text-left">{activeTab?.label}</span>
                <Icon name={menuOpen ? 'ChevronUp' : 'ChevronDown'} size={13}
                  style={{ color: 'var(--text-muted)' }} />
              </button>

              {menuOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-50 shadow-xl"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                  {TABS.map((t, i) => (
                    <button key={t.id}
                      onClick={() => { onTabChange(t.id); setMenuOpen(false); }}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm transition-all text-left"
                      style={{
                        background: tab === t.id ? 'rgba(0,255,136,0.08)' : 'transparent',
                        color: tab === t.id ? 'var(--brand-green)' : 'var(--text-secondary)',
                        borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
                      }}>
                      <Icon name={t.icon} size={15}
                        style={{ color: tab === t.id ? 'var(--brand-green)' : 'var(--text-muted)' }} />
                      {t.label}
                      {tab === t.id && (
                        <Icon name="Check" size={13} style={{ color: 'var(--brand-green)', marginLeft: 'auto' }} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Правая панель */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="px-2 py-1 rounded-full text-xs flex items-center gap-1.5"
              style={{ background: 'var(--brand-green-muted)', border: '1px solid rgba(0,255,136,0.2)', color: 'var(--brand-green)' }}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--brand-green)' }} />
              <span className="font-semibold">{total.toLocaleString('ru-RU')}</span>
            </div>
            <AutoPilot calls={calls} autoStart={autoStart} />
            <button onClick={onShowReports}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
              <Icon name="FolderOpen" size={14} />
              <span className="hidden md:inline">Отчёты</span>
            </button>
            {onLogout && (
              <button onClick={onLogout}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
                <Icon name="LogOut" size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
