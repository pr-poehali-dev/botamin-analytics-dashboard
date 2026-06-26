import { useState, useRef } from 'react';
import Icon from '@/components/ui/icon';
import { loadSite } from '@/lib/session';
import { loadFromFile } from '@/lib/dataParser';
import type { CallsData } from '@/lib/dataParser';

interface Props {
  onLogin: (site: string) => void;
  onLoad?: (d: CallsData, autoStart?: boolean) => void;
}

function normalizeSite(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '');
}

const Logo = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
    <rect width="44" height="44" rx="14" fill="#00FF88"/>
    <path d="M22 10C15.373 10 10 15.373 10 22C10 28.627 15.373 34 22 34C28.627 34 34 28.627 34 22" stroke="#000" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M28 10L34 10L34 16" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M22 22L33.5 10.5" stroke="#000" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="22" cy="22" r="3" fill="#000"/>
  </svg>
);

export default function LoginScreen({ onLogin, onLoad }: Props) {
  const savedSite = loadSite();
  const [value, setValue]       = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [fileError, setFileError] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode]         = useState<'saved' | 'manual'>(savedSite ? 'saved' : 'manual');
  const fileRef = useRef<HTMLInputElement>(null);

  const doLogin = (site: string) => {
    setLoading(true);
    setTimeout(() => { setLoading(false); onLogin(site); }, 600);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const site = normalizeSite(value);
    if (!site || !site.includes('.')) {
      setError('Введите корректный адрес, например: moysajt.ru');
      return;
    }
    setError('');
    doLogin(site);
  };

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setFileError('Нужен файл Excel (.xlsx или .xls)');
      return;
    }
    setFileError('');
    setFileLoading(true);
    try {
      const data = await loadFromFile(file);
      onLoad?.(data, false);
    } catch {
      setFileError('Не удалось разобрать файл. Проверьте формат.');
    } finally {
      setFileLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const Spinner = () => (
    <span className="flex gap-1">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-1.5 h-1.5 rounded-full animate-pulse inline-block"
          style={{ background: '#000', animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'var(--bg-primary)', fontFamily: "'Golos Text', sans-serif" }}>

      {/* Логотип */}
      <div className="flex items-center gap-3 mb-10">
        <Logo />
        <div>
          <div className="font-bold text-lg leading-tight" style={{ color: 'var(--text-primary)' }}>ЗвонокАктив</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Аналитика звонков</div>
        </div>
      </div>

      <div className="w-full max-w-sm rounded-2xl p-7 space-y-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>

        {/* ── БЛОК ВХОДА ── */}
        {mode === 'saved' ? (
          <div>
            <div className="text-center mb-5">
              <div className="w-11 h-11 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                style={{ background: 'var(--brand-green-muted)' }}>
                <Icon name="Globe" size={20} style={{ color: 'var(--brand-green)' }} />
              </div>
              <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Добро пожаловать</h1>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Продолжить как</p>
            </div>

            <div className="mb-3 flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.2)' }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(0,255,136,0.12)' }}>
                <Icon name="Globe" size={14} style={{ color: 'var(--brand-green)' }} />
              </div>
              <span className="text-sm font-semibold flex-1" style={{ color: 'var(--brand-green)' }}>
                {savedSite}
              </span>
            </div>

            <button onClick={() => doLogin(savedSite)} disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 mb-2"
              style={{ background: 'var(--brand-green)', color: '#000' }}>
              {loading
                ? <span className="flex items-center justify-center gap-2"><Spinner />Входим…</span>
                : <span className="flex items-center justify-center gap-2"><Icon name="LogIn" size={15} />Войти</span>}
            </button>

            <button onClick={() => setMode('manual')}
              className="w-full py-2 text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}>
              Войти с другим сайтом
            </button>
          </div>
        ) : (
          <div>
            <div className="text-center mb-5">
              <div className="w-11 h-11 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                style={{ background: 'var(--brand-green-muted)' }}>
                <Icon name="Globe" size={20} style={{ color: 'var(--brand-green)' }} />
              </div>
              <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Войти в аналитику</h1>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Введите адрес вашего сайта</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex items-center rounded-xl overflow-hidden"
                style={{ border: `1px solid ${error ? '#ff4444' : 'var(--border-default)'}`, background: 'var(--bg-elevated)' }}>
                <input
                  type="text" value={value} autoFocus
                  onChange={e => { setValue(e.target.value); setError(''); }}
                  placeholder="moysajt.ru"
                  className="flex-1 bg-transparent py-3 px-3 text-sm outline-none"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
              {error && <p className="text-xs px-1" style={{ color: '#ff6666' }}>{error}</p>}

              <button type="submit" disabled={loading || !value.trim()}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                style={{ background: 'var(--brand-green)', color: '#000' }}>
                {loading
                  ? <span className="flex items-center justify-center gap-2"><Spinner />Подключаю…</span>
                  : <span className="flex items-center justify-center gap-2"><Icon name="LogIn" size={15} />Войти</span>}
              </button>

              {savedSite && (
                <button type="button" onClick={() => setMode('saved')}
                  className="w-full py-2 text-xs transition-opacity hover:opacity-70"
                  style={{ color: 'var(--text-muted)' }}>
                  ← Назад
                </button>
              )}
            </form>
          </div>
        )}

        {/* ── РАЗДЕЛИТЕЛЬ ── */}
        {onLoad && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>или загрузите файл</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
            </div>

            {/* ── ЗОНА ЗАГРУЗКИ ── */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => !fileLoading && fileRef.current?.click()}
              className="rounded-xl py-5 px-4 flex flex-col items-center gap-2 cursor-pointer transition-all"
              style={{
                border: `1.5px dashed ${dragging ? 'var(--brand-green)' : 'var(--border-default)'}`,
                background: dragging ? 'rgba(0,255,136,0.04)' : 'var(--bg-elevated)',
              }}>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

              {fileLoading ? (
                <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <span className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full animate-pulse inline-block"
                        style={{ background: 'var(--brand-green)', animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                  Загружаю…
                </span>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'var(--brand-green-muted)' }}>
                    <Icon name="Upload" size={18} style={{ color: 'var(--brand-green)' }} />
                  </div>
                  <p className="text-sm font-medium text-center" style={{ color: 'var(--text-primary)' }}>
                    Загрузить файл звонков
                  </p>
                  <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                    Excel из CoMagic или Битрикс24 · .xlsx
                  </p>
                </>
              )}
            </div>

            {fileError && <p className="text-xs text-center" style={{ color: '#ff6666' }}>{fileError}</p>}
          </>
        )}
      </div>
    </div>
  );
}
