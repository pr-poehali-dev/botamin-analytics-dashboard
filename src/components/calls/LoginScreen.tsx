import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { loadSite } from '@/lib/session';

interface Props {
  onLogin: (site: string) => void;
}

function normalizeSite(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '');
}

export default function LoginScreen({ onLogin }: Props) {
  const savedSite = loadSite();
  const [value, setValue]   = useState(savedSite || '');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode]     = useState<'saved' | 'manual'>(savedSite ? 'saved' : 'manual');

  const doLogin = (site: string) => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin(site);
    }, 600);
  };

  const handleSavedLogin = () => {
    doLogin(savedSite);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const site = normalizeSite(value);
    if (!site || !site.includes('.')) {
      setError('Введите корректный адрес сайта, например: siteactiv.ru');
      return;
    }
    setError('');
    doLogin(site);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'var(--bg-primary)', fontFamily: "'Golos Text', sans-serif" }}>

      {/* Логотип */}
      <div className="flex items-center gap-3 mb-12">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-xl"
          style={{ background: 'var(--brand-green)', color: '#000' }}>S</div>
        <div>
          <div className="font-bold text-lg leading-tight" style={{ color: 'var(--text-primary)' }}>СайтАктив</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Аналитика звонков</div>
        </div>
      </div>

      <div className="w-full max-w-sm rounded-2xl p-8"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>

        {/* Режим: сохранённый сайт */}
        {mode === 'saved' ? (
          <>
            <div className="mb-6 text-center">
              <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: 'var(--brand-green-muted)' }}>
                <Icon name="Globe" size={22} style={{ color: 'var(--brand-green)' }} />
              </div>
              <h1 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                Добро пожаловать
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Продолжить как
              </p>
            </div>

            {/* Карточка сайта */}
            <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.2)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(0,255,136,0.12)' }}>
                <Icon name="Globe" size={15} style={{ color: 'var(--brand-green)' }} />
              </div>
              <span className="text-sm font-semibold flex-1" style={{ color: 'var(--brand-green)' }}>
                {savedSite}
              </span>
            </div>

            <button
              onClick={handleSavedLogin}
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 mb-3"
              style={{ background: 'var(--brand-green)', color: '#000' }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full animate-pulse inline-block"
                        style={{ background: '#000', animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                  Входим…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Icon name="LogIn" size={15} />
                  Войти
                </span>
              )}
            </button>

            <button
              onClick={() => setMode('manual')}
              className="w-full py-2 text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}>
              Войти с другим сайтом
            </button>
          </>
        ) : (
          /* Режим: ручной ввод */
          <>
            <div className="mb-6 text-center">
              <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: 'var(--brand-green-muted)' }}>
                <Icon name="Globe" size={22} style={{ color: 'var(--brand-green)' }} />
              </div>
              <h1 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                Войти в аналитику
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Введите адрес вашего сайта
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex items-center rounded-xl overflow-hidden"
                style={{ border: `1px solid ${error ? '#ff4444' : 'var(--border-default)'}`, background: 'var(--bg-elevated)' }}>
                <input
                  type="text"
                  value={value}
                  onChange={e => { setValue(e.target.value); setError(''); }}
                  placeholder="siteactiv.ru"
                  autoFocus
                  className="flex-1 bg-transparent py-3 px-3 text-sm outline-none"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>

              {error && (
                <p className="text-xs px-1" style={{ color: '#ff6666' }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !value.trim()}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                style={{ background: 'var(--brand-green)', color: '#000' }}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full animate-pulse inline-block"
                          style={{ background: '#000', animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </span>
                    Подключаю…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Icon name="LogIn" size={15} />
                    Войти
                  </span>
                )}
              </button>

              {savedSite && (
                <button
                  type="button"
                  onClick={() => setMode('saved')}
                  className="w-full py-2 text-xs transition-opacity hover:opacity-70"
                  style={{ color: 'var(--text-muted)' }}>
                  ← Назад
                </button>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
