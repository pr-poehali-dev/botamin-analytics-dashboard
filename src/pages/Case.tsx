import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import CaseHero from '@/components/case/CaseHero';
import CaseSteps from '@/components/case/CaseSteps';
import CaseFooter from '@/components/case/CaseFooter';

export default function Case() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)', fontFamily: "'Golos Text', sans-serif" }}>

      {/* ── NAV ── */}
      <header className="sticky top-0 z-40 border-b"
        style={{ background: 'rgba(10,10,10,0.96)', borderColor: 'var(--border-default)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/')}
            className="flex items-center gap-2 text-xs transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--brand-green)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
            <Icon name="ArrowLeft" size={14} />
            Вернуться к дашборду
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
              style={{ background: 'var(--brand-green)', color: '#000' }}>B</div>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Тестовое задание — Отчёт
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-16">
        <CaseHero onNavigate={() => navigate('/')} />
        <CaseSteps />
        <CaseFooter onNavigate={() => navigate('/')} />
      </main>

    </div>
  );
}
