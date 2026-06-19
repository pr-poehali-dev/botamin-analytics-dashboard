import Icon from '@/components/ui/icon';
import SectionTitle from '@/components/case/SectionTitle';

const STACK = [
  { label: 'React + TypeScript', icon: 'Code2', desc: 'Frontend SPA' },
  { label: 'Python 3.11', icon: 'Terminal', desc: 'Cloud Function' },
  { label: 'Recharts', icon: 'BarChart2', desc: 'Визуализация' },
  { label: 'Tailwind CSS', icon: 'Palette', desc: 'Стилизация' },
  { label: 'Google Sheets API', icon: 'Database', desc: 'Источник данных' },
  { label: 'Cloud Functions', icon: 'Cloud', desc: 'Backend / CORS proxy' },
  { label: 'CSV Parser (Python)', icon: 'FileText', desc: 'Серверный парсинг' },
  { label: 'Regex + NLP эвристика', icon: 'Search', desc: 'Классификатор этапов' },
];

const SKILLS = [
  'MCP (Model Context Protocol)', 'RAG', 'API разработка и интеграция',
  'Платёжные шлюзы', 'VoIP / IP-телефония', 'NLP / машинное обучение',
  'CRM-системы', 'Мультиагентные системы', 'AI-классификация',
  'Голосовые ИИ-агенты', 'CAD / AI-редакторы', 'AI-аукционы',
  'Cursor', 'Claude Code', 'Bolt', 'Lovable', 'Replit', 'v0', 'poehali.dev',
];

export default function CaseFooter({ onNavigate }: { onNavigate: () => void }) {
  return (
    <>
      {/* ── СТЕК ── */}
      <section>
        <SectionTitle icon="Layers" title="Стек технологий в задании" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {STACK.map((s, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <Icon name={s.icon} size={18} style={{ color: 'var(--brand-green)', flexShrink: 0 }} />
              <div>
                <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{s.label}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── НАВЫКИ ── */}
      <section>
        <SectionTitle icon="Cpu" title="Технологическая экспертиза" />
        <p className="text-xs mt-1 mb-5" style={{ color: 'var(--text-muted)' }}>
          Unistory.app · 5 лет 3 месяца · AI-Архитектор бизнес-процессов
        </p>
        <div className="flex flex-wrap gap-2">
          {SKILLS.map((s, i) => (
            <span key={i} className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* ── ИТОГ ── */}
      <section>
        <div className="rounded-2xl p-8 text-center relative overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid rgba(0,255,136,0.2)' }}>
          {/* glow */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,255,136,0.08) 0%, transparent 70%)' }} />

          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4"
              style={{ background: 'var(--brand-green-muted)', border: '1px solid rgba(0,255,136,0.2)', color: 'var(--brand-green)' }}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--brand-green)' }} />
              Готов к работе
            </div>

            <h2 className="text-2xl font-black mb-3" style={{ color: 'var(--text-primary)' }}>
              Что вы получаете
            </h2>

            <div className="grid sm:grid-cols-3 gap-4 mt-6 text-left">
              {[
                {
                  icon: 'Search',
                  title: 'Нахожу реальные проблемы',
                  desc: 'Не просто пишу код — проверяю реальные диалоги, нахожу баги классификатора, исправляю методологию',
                },
                {
                  icon: 'Zap',
                  title: 'Быстро и самостоятельно',
                  desc: 'Полный цикл: анализ → архитектура → разработка → аудит → исправление — без ожидания ТЗ на каждый шаг',
                },
                {
                  icon: 'TrendingUp',
                  title: 'Думаю о бизнесе',
                  desc: 'CR 0.53% вместо ложных 3.25% — это честная аналитика, на которой можно принимать реальные решения',
                },
              ].map((item, i) => (
                <div key={i} className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                  <Icon name={item.icon} size={20} style={{ color: 'var(--brand-green)', marginBottom: 10 }} />
                  <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{item.title}</div>
                  <div className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.desc}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap justify-center gap-3 mt-8">
              <a href="https://ai-potolki.ru/LB" target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: 'var(--brand-green)', color: '#000' }}>
                <Icon name="ExternalLink" size={14} />
                Посмотреть портфолио
              </a>
              <button onClick={onNavigate}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                <Icon name="BarChart2" size={14} />
                Открыть аналитику
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t mt-10 py-6 text-center"
        style={{ borderColor: 'var(--border-default)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          AI-Архитектор бизнес-решений · Тестовое задание Botamin · 2026
        </p>
      </footer>
    </>
  );
}
