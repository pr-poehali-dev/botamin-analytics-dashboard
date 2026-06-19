import { useState, useRef, useCallback } from 'react';
import { loadFromUrl, loadFromFile, type CallsData } from '@/lib/dataParser';
import Icon from '@/components/ui/icon';

const DEMO_URL =
  'https://cdn.poehali.dev/projects/6a84af2c-c107-4039-b71a-e57da70119f0/bucket/f46cc9cf-190b-4379-8e94-6225cc11ec61.xlsx';

interface Props {
  onLoad: (d: CallsData) => void;
  onCancel?: () => void;
}

export default function UploadScreen({ onLoad, onCancel }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const process = useCallback(async (file?: File, url?: string) => {
    setLoading(true);
    setError('');
    try {
      const data = file ? await loadFromFile(file) : await loadFromUrl(url!);
      onLoad(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  }, [onLoad]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) process(e.target.files[0]);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files?.[0]) process(e.dataTransfer.files[0]);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'var(--bg-primary)' }}>

      {/* зона загрузки */}
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            Новый анализ
          </h2>
          {onCancel && (
            <button onClick={onCancel}
              className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}>
              <Icon name="X" size={14} />
              Отмена
            </button>
          )}
        </div>

        <div
          className="w-full rounded-2xl p-8 text-center cursor-pointer transition-all"
          style={{
            border: `2px dashed ${drag ? 'var(--brand-green)' : 'var(--border-default)'}`,
            background: drag ? 'var(--brand-green-muted)' : 'var(--bg-card)',
          }}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => !loading && inputRef.current?.click()}>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFile} />
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full animate-pulse"
                    style={{ background: 'var(--brand-green)', animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Анализирую звонки…</p>
            </div>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: 'var(--brand-green-muted)' }}>
                <Icon name="Upload" size={28} style={{ color: 'var(--brand-green)' }} />
              </div>
              <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                Загрузите Excel-файл со звонками
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Перетащите файл или нажмите для выбора
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Поддерживается экспорт из CoMagic / Битрикс24
              </p>
            </>
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm px-4 py-2 rounded-lg"
            style={{ background: 'rgba(255,68,68,0.1)', color: '#ff6666' }}>{error}</p>
        )}

        {!loading && (
          <button
            className="mt-5 w-full text-xs underline underline-offset-2 transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
            onClick={() => process(undefined, DEMO_URL)}>
            Открыть демо (3 263 звонка, апрель–июнь 2026)
          </button>
        )}
      </div>
    </div>
  );
}