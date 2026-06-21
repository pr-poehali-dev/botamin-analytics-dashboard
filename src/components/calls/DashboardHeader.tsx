import Icon from '@/components/ui/icon';
import AutoPilot from '@/components/calls/AutoPilot';
import { type CallRecord } from '@/lib/dataParser';

type Tab = 'overview' | 'calls' | 'transcription' | 'ai-insights' | 'recommendations';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview',         label: 'Обзор',         icon: 'LayoutDashboard' },
  { id: 'calls',            label: 'Все звонки',    icon: 'PhoneCall' },
  { id: 'transcription',    label: 'Транскрибация', icon: 'Mic' },
  { id: 'ai-insights',      label: 'Аналитика ИИ',  icon: 'Sparkles' },
  { id: 'recommendations',  label: 'Рекомендации',  icon: 'Lightbulb' },
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
  return (
    <header className="sticky top-0 z-40 border-b"
      style={{ background: 'rgba(10,10,10,0.96)', borderColor: 'var(--border-default)', backdropFilter: 'blur(12px)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-12 sm:h-14">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center font-black text-sm shrink-0"
              style={{ background: 'var(--brand-green)', color: '#000' }}>S</div>
            <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>СайтАктив</span>
            {site && (
              <span className="text-xs px-2 py-0.5 rounded-full hidden sm:inline"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                {site}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="px-2 py-1 rounded-full text-xs flex items-center gap-1.5"
              style={{ background: 'var(--brand-green-muted)', border: '1px solid rgba(0,255,136,0.2)', color: 'var(--brand-green)' }}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--brand-green)' }} />
              <span className="font-semibold">{total.toLocaleString('ru-RU')}</span>
              <span className="hidden sm:inline">звонков</span>
            </div>
            <AutoPilot calls={calls} autoStart={autoStart} />
            <button onClick={onShowReports}
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
              <Icon name="FolderOpen" size={14} />
              <span className="hidden sm:inline">Отчёты</span>
            </button>
            {onLogout && (
              <button onClick={onLogout}
                className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
                <Icon name="LogOut" size={14} />
                <span className="hidden sm:inline">Выйти</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-0 -mb-px overflow-x-auto scrollbar-none">
          {TABS.map(t => (
            <button key={t.id} onClick={() => onTabChange(t.id)}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-all"
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
  );
}
