import type { RefusalPhrase } from '@/lib/dataParser';

interface Props {
  refusalPhrases: RefusalPhrase[];
  successPhrases: RefusalPhrase[];
}

function PhraseRow({ phrase, count, color, max }: { phrase: string; count: number; color: string; max: number }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="flex-1 min-w-0">
        <span className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          «{phrase}»
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${(count / max) * 100}%`, background: color }}
          />
        </div>
        <span className="text-xs font-mono-data w-5 text-right" style={{ color }}>
          {count}
        </span>
      </div>
    </div>
  );
}

export default function PhrasesPanel({ refusalPhrases, successPhrases }: Props) {
  const maxRefusal = Math.max(...refusalPhrases.map(p => p.count), 1);
  const maxSuccess = Math.max(...successPhrases.map(p => p.count), 1);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="card-glass p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full" style={{ background: '#ff4444' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Фразы отказа
          </h3>
          <span className="text-xs ml-auto font-mono-data" style={{ color: 'var(--text-muted)' }}>
            {refusalPhrases.reduce((s, p) => s + p.count, 0)} случаев
          </span>
        </div>
        {refusalPhrases.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Нет данных</p>
        ) : (
          <div>
            {refusalPhrases.map((p, i) => (
              <PhraseRow key={i} phrase={p.phrase} count={p.count} color="#ff4444" max={maxRefusal} />
            ))}
          </div>
        )}
        <div className="mt-4 p-3 rounded-lg" style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)' }}>
          <p className="text-xs leading-relaxed" style={{ color: '#ff8888' }}>
            <span className="font-semibold">Узкое место:</span> Большинство отказов происходят на этапе приветствия. Клиент распознаёт скрипт и кладёт трубку до оффера.
          </p>
        </div>
      </div>

      <div className="card-glass p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--brand-green)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Фразы прохода
          </h3>
          <span className="text-xs ml-auto font-mono-data" style={{ color: 'var(--text-muted)' }}>
            {successPhrases.reduce((s, p) => s + p.count, 0)} случаев
          </span>
        </div>
        {successPhrases.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Нет данных</p>
        ) : (
          <div>
            {successPhrases.map((p, i) => (
              <PhraseRow key={i} phrase={p.phrase} count={p.count} color="var(--brand-green)" max={maxSuccess} />
            ))}
          </div>
        )}
        <div className="mt-4 p-3 rounded-lg" style={{ background: 'var(--brand-green-muted)', border: '1px solid rgba(0,255,136,0.2)' }}>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--brand-green)' }}>
            <span className="font-semibold">Инсайт:</span> Клиенты, задающие уточняющий вопрос («А это бесплатно?», «Расскажи подробнее»), конвертируются значительно лучше.
          </p>
        </div>
      </div>
    </div>
  );
}
