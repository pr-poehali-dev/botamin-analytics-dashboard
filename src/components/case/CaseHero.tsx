import Icon from '@/components/ui/icon';

const PHOTO_URL = 'https://cdn.poehali.dev/projects/6a84af2c-c107-4039-b71a-e57da70119f0/bucket/952982a4-e99a-471e-914c-50aea2b1e2b5.jpg';

export default function CaseHero({ onNavigate }: { onNavigate: () => void }) {
  return (
    <section className="flex flex-col md:flex-row gap-8 items-center md:items-start">
      {/* фото */}
      <div className="shrink-0">
        <div className="w-36 h-36 rounded-2xl overflow-hidden ring-2"
          style={{ ringColor: 'var(--brand-green)', boxShadow: '0 0 0 2px var(--brand-green), 0 0 32px rgba(0,255,136,0.15)' }}>
          <img src={PHOTO_URL} alt="Фото" className="w-full h-full object-cover" />
        </div>
      </div>

      {/* текст */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--brand-green)' }} />
          <span className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--brand-green)' }}>
            Тестовое задание выполнено
          </span>
        </div>

        {/* Имя */}
        <h1 className="text-2xl sm:text-3xl font-black mb-0.5" style={{ color: 'var(--text-primary)' }}>
          Красноруцкий Евгений Геннадиевич
        </h1>

        {/* Должность */}
        <p className="text-lg font-bold mb-1" style={{ color: 'var(--brand-green)' }}>
          AI-Архитектор бизнес-решений
        </p>

        {/* Телефон */}
        <a href="tel:+79776068901"
          className="inline-flex items-center gap-1.5 text-sm font-semibold mb-3 transition-opacity hover:opacity-80"
          style={{ color: 'var(--text-primary)' }}>
          <Icon name="Phone" size={14} style={{ color: 'var(--brand-green)' }} />
          +7 977 606-89-01
        </a>

        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
          5 лет 3 месяца · Unistory.app Технологии для бизнеса
        </p>
        <p className="text-sm leading-relaxed max-w-xl mb-5" style={{ color: 'var(--text-secondary)' }}>
          Не просто пишу код — строю бизнес на стыке цифр и реальных бизнес-процессов.
          Навыки создания и продвижения офлайн-проектов дают редкую способность
          мгновенно погружаться в любую бизнес-логику.
        </p>

        {/* Кнопки контактов + портфолио */}
        <div className="flex flex-wrap gap-2">
          {/* WhatsApp */}
          <a href="https://wa.me/79776068901" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
            style={{ background: '#25D366', color: '#fff' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </a>

          {/* Telegram */}
          <a href="https://telegram.me/JoniKras" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
            style={{ background: '#229ED9', color: '#fff' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
            Telegram
          </a>

          {/* MAX */}
          <a href="https://max.ru/u/f9LHodD0cOKSEfyoFHNHDKKda2DJEQla4TIbxIDSi7pGygeScJtM9PafS5g" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
            style={{ background: '#5B5FEF', color: '#fff' }}>
            <Icon name="MessageCircle" size={14} />
            MAX
          </a>

          {/* Портфолио */}
          <a href="https://ai-potolki.ru/LB" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
            style={{ background: 'var(--brand-green)', color: '#000' }}>
            <Icon name="ExternalLink" size={12} />
            Портфолио
          </a>

          {/* Дашборд */}
          <button onClick={onNavigate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
            <Icon name="BarChart2" size={12} />
            Открыть дашборд
          </button>
        </div>
      </div>

      {/* правый блок — кратко о задании */}
      <div className="shrink-0 w-full md:w-56 rounded-2xl p-4 space-y-3"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        {[
          { icon: 'Database', label: 'Строк данных', val: '11 486' },
          { icon: 'Clock', label: 'Итоговый CR', val: '0.53%' },
          { icon: 'Bug', label: 'Найдено багов', val: '7' },
          { icon: 'ShieldCheck', label: 'Точность счётчиков', val: '100%' },
          { icon: 'Layers', label: 'Итераций аудита', val: '4' },
        ].map((r, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name={r.icon} size={13} style={{ color: 'var(--brand-green)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.label}</span>
            </div>
            <span className="text-xs font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{r.val}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
