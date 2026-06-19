import { formatSec, formatTotalHours, type CallsData } from '@/lib/dataParser';
import Icon from '@/components/ui/icon';

const priorityColor = { high: '#ff4444', medium: '#ff8c00', low: 'var(--brand-green)' };
const priorityLabel = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
const priorityIcon = { high: 'AlertTriangle', medium: 'Info', low: 'CheckCircle' };

export default function RecommendationsBlock({ data }: { data: CallsData }) {
  return (
    <div className="space-y-4">
      {data.recommendations.map((r, i) => (
        <div key={i} className="rounded-2xl p-5"
          style={{ background: 'var(--bg-card)', border: `1px solid ${priorityColor[r.priority]}33` }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: `${priorityColor[r.priority]}18` }}>
              <Icon name={priorityIcon[r.priority]} size={16} style={{ color: priorityColor[r.priority] }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{r.title}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ background: `${priorityColor[r.priority]}18`, color: priorityColor[r.priority] }}>
                  {priorityLabel[r.priority]} приоритет
                </span>
              </div>
              <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{r.desc}</p>
              <div className="flex items-start gap-2 p-3 rounded-lg"
                style={{ background: 'var(--bg-elevated)' }}>
                <Icon name="Lightbulb" size={13} style={{ color: 'var(--brand-green)', marginTop: 1, flexShrink: 0 }} />
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{r.action}</p>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* контекст данных */}
      <div className="rounded-2xl p-5 mt-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="BarChart2" size={14} style={{ color: 'var(--brand-green)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            На чём основаны рекомендации
          </span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { label: 'Всего проанализировано', val: `${data.total.toLocaleString('ru-RU')} звонков` },
            { label: 'Средняя длительность', val: formatSec(data.avg_duration_sec) },
            { label: 'Суммарное время разговоров', val: formatTotalHours(data.total_talk_sec) },
            { label: 'Источник данных', val: 'CoMagic / Битрикс24' },
          ].map((row, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg"
              style={{ background: 'var(--bg-elevated)' }}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.label}</span>
              <span className="text-xs font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>{row.val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
