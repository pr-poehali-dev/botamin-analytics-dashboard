import Icon from '@/components/ui/icon';
import { type Analysis, interestColor, outcomeColor, scoreColor } from '@/components/calls/transcriptionTypes';

function ScoreBadge({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="w-3 h-3 rounded-sm"
            style={{ background: i < score ? scoreColor(score) : 'var(--bg-elevated)' }} />
        ))}
      </div>
      <span className="text-sm font-bold font-mono" style={{ color: scoreColor(score) }}>{score}/10</span>
    </div>
  );
}

export default function CallAnalysisCard({ analysis }: { analysis: Analysis }) {
  return (
    <div className="space-y-4 mt-4">
      {/* Краткое резюме */}
      <div className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>РЕЗЮМЕ ЗВОНКА</p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{analysis.summary}</p>
      </div>

      {/* Метрики */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Тип звонка', value: analysis.call_type_label, color: analysis.call_type === 'target' ? 'var(--brand-green)' : '#888' },
          { label: 'Квалификация', value: analysis.qualification_label, color: analysis.qualification ? 'var(--brand-green)' : '#ff8c00' },
          { label: 'Интерес', value: analysis.client_interest_label, color: interestColor[analysis.client_interest] },
          { label: 'Итог', value: analysis.outcome_label, color: outcomeColor[analysis.outcome] },
        ].map((m, i) => (
          <div key={i} className="p-3 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{m.label}</p>
            <p className="text-sm font-bold" style={{ color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Причина / фактор */}
      {(analysis.fail_reason || analysis.success_factor) && (
        <div className="p-4 rounded-xl" style={{
          background: analysis.outcome === 'success' ? 'rgba(0,255,136,0.06)' : 'rgba(255,68,68,0.06)',
          border: `1px solid ${analysis.outcome === 'success' ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,68,0.2)'}`,
        }}>
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
            {analysis.outcome === 'success' ? 'ФАКТОР УСПЕХА' : 'ПРИЧИНА ОТКАЗА'}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {analysis.success_factor || analysis.fail_reason}
          </p>
        </div>
      )}

      {/* Оценка оператора */}
      <div className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>ОЦЕНКА ОПЕРАТОРА</p>
        <ScoreBadge score={analysis.operator_score} />
        <div className="flex flex-wrap gap-3 mt-3">
          <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg"
            style={{ background: analysis.operator_followed_script ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,68,0.1)', color: analysis.operator_followed_script ? 'var(--brand-green)' : '#ff4444' }}>
            <Icon name={analysis.operator_followed_script ? 'CheckCircle' : 'XCircle'} size={12} />
            Скрипт {analysis.operator_followed_script ? 'соблюдён' : 'не соблюдён'}
          </span>
          <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg"
            style={{ background: analysis.operator_handled_objections ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,68,0.1)', color: analysis.operator_handled_objections ? 'var(--brand-green)' : '#ff4444' }}>
            <Icon name={analysis.operator_handled_objections ? 'CheckCircle' : 'XCircle'} size={12} />
            Возражения {analysis.operator_handled_objections ? 'обработаны' : 'не обработаны'}
          </span>
        </div>
        <p className="text-xs mt-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{analysis.operator_comment}</p>
      </div>

      {/* Ключевые фразы */}
      {(analysis.key_phrases_client?.length > 0 || analysis.key_phrases_operator?.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { label: 'Ключевые фразы клиента', phrases: analysis.key_phrases_client, color: '#00aaff' },
            { label: 'Ключевые фразы оператора', phrases: analysis.key_phrases_operator, color: 'var(--brand-green)' },
          ].map((group, i) => (
            <div key={i} className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>{group.label.toUpperCase()}</p>
              <div className="flex flex-wrap gap-1.5">
                {group.phrases.map((ph, j) => (
                  <span key={j} className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: `${group.color}18`, color: group.color }}>
                    «{ph}»
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
