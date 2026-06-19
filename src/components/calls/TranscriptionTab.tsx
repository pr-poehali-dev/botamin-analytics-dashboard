import { useState } from 'react';
import { type CallRecord } from '@/lib/dataParser';
import Icon from '@/components/ui/icon';

const TRANSCRIBE_URL = 'https://functions.poehali.dev/1cc0b8dc-c71b-4292-815d-cdae4f93cea8';
const ANALYZE_URL = 'https://functions.poehali.dev/6f70becf-3fb4-43a7-98a5-747436055b2d';

type JobStatus = 'idle' | 'transcribing' | 'analyzing' | 'done' | 'error';

interface Replica {
  speaker: 'operator' | 'client';
  speaker_label: string;
  text: string;
  start_time: number;
}

interface Analysis {
  call_type: string;
  call_type_label: string;
  qualification: boolean;
  qualification_label: string;
  client_interest: 'high' | 'medium' | 'low';
  client_interest_label: string;
  outcome: 'success' | 'failure' | 'pending';
  outcome_label: string;
  fail_reason: string | null;
  success_factor: string | null;
  operator_score: number;
  operator_followed_script: boolean;
  operator_handled_objections: boolean;
  operator_comment: string;
  summary: string;
  key_phrases_client: string[];
  key_phrases_operator: string[];
}

interface TranscriptResult {
  comm_id: string;
  full_text: string;
  replicas: Replica[];
  replica_count: number;
  operator_replicas: number;
  client_replicas: number;
  analysis?: Analysis;
  status: JobStatus;
  error?: string;
  cached?: boolean;
}

const interestColor = { high: 'var(--brand-green)', medium: '#ff8c00', low: '#ff4444' };
const outcomeColor = { success: 'var(--brand-green)', failure: '#ff4444', pending: '#ff8c00' };
const scoreColor = (s: number) => s >= 8 ? 'var(--brand-green)' : s >= 6 ? '#ff8c00' : '#ff4444';

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

function AnalysisCard({ analysis }: { analysis: Analysis }) {
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

function TranscriptView({ result, onAnalyze }: { result: TranscriptResult; onAnalyze: () => void }) {
  const [showReplicas, setShowReplicas] = useState(true);

  return (
    <div className="space-y-4">
      {/* Статистика транскрипта */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Реплик всего', val: result.replica_count },
          { label: 'Оператор', val: result.operator_replicas },
          { label: 'Клиент', val: result.client_replicas },
        ].map((s, i) => (
          <div key={i} className="p-3 rounded-xl text-center" style={{ background: 'var(--bg-elevated)' }}>
            <div className="text-lg font-black font-mono" style={{ color: 'var(--brand-green)' }}>{s.val}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Кнопка анализа */}
      {!result.analysis && result.status !== 'analyzing' && (
        <button onClick={onAnalyze}
          className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90"
          style={{ background: 'var(--brand-green)', color: '#000' }}>
          <Icon name="Sparkles" size={16} />
          Анализировать через ИИ
        </button>
      )}
      {result.status === 'analyzing' && (
        <div className="w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: 'var(--brand-green)', animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          ИИ анализирует звонок…
        </div>
      )}

      {/* Результат анализа */}
      {result.analysis && <AnalysisCard analysis={result.analysis} />}

      {/* Диалог */}
      <div>
        <button onClick={() => setShowReplicas(v => !v)}
          className="flex items-center gap-2 text-xs mb-3 transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-muted)' }}>
          <Icon name={showReplicas ? 'ChevronUp' : 'ChevronDown'} size={13} />
          {showReplicas ? 'Скрыть' : 'Показать'} транскрипт ({result.replica_count} реплик)
        </button>
        {showReplicas && (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {result.replicas.map((r, i) => (
              <div key={i} className={`flex gap-3 ${r.speaker === 'operator' ? '' : 'flex-row-reverse'}`}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                  style={{
                    background: r.speaker === 'operator' ? 'rgba(0,255,136,0.2)' : 'rgba(0,170,255,0.2)',
                    color: r.speaker === 'operator' ? 'var(--brand-green)' : '#00aaff',
                  }}>
                  {r.speaker === 'operator' ? 'О' : 'К'}
                </div>
                <div className={`flex-1 ${r.speaker === 'client' ? 'text-right' : ''}`}>
                  <div className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>
                    {r.speaker_label} · {r.start_time}с
                  </div>
                  <div className="inline-block px-3 py-2 rounded-xl text-xs leading-relaxed"
                    style={{
                      background: r.speaker === 'operator' ? 'var(--bg-elevated)' : 'rgba(0,170,255,0.1)',
                      color: 'var(--text-secondary)',
                      maxWidth: '85%',
                    }}>
                    {r.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TranscriptionTab({ calls }: { calls: CallRecord[] }) {
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [search, setSearch] = useState('');

  const filteredCalls = calls
    .filter(c => c.record_url)
    .filter(c => !search || c.date.includes(search) || c.comm_id.includes(search))
    .slice(0, 100);

  const handleTranscribe = async (call: CallRecord) => {
    setSelectedCall(call);
    setResult({ comm_id: call.comm_id, full_text: '', replicas: [], replica_count: 0, operator_replicas: 0, client_replicas: 0, status: 'transcribing' });

    try {
      const res = await fetch(TRANSCRIBE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_url: call.record_url,
          comm_id: call.comm_id,
          date: call.date,
          duration: call.duration,
          duration_sec: call.duration_sec,
        }),
      });
      const data = await res.json();

      if (data.status === 'pending') {
        setResult(prev => prev ? { ...prev, status: 'error', error: 'Звонок слишком длинный для быстрой обработки. Попробуйте позже.' } : null);
        return;
      }
      if (data.error) {
        setResult(prev => prev ? { ...prev, status: 'error', error: data.error } : null);
        return;
      }

      setResult({
        comm_id: call.comm_id,
        full_text: data.full_text || '',
        replicas: data.replicas || [],
        replica_count: data.replica_count || 0,
        operator_replicas: data.operator_replicas || 0,
        client_replicas: data.client_replicas || 0,
        status: 'done',
        cached: data.cached === true,
      });
    } catch (e) {
      setResult(prev => prev ? { ...prev, status: 'error', error: 'Ошибка соединения' } : null);
    }
  };

  const handleAnalyze = async () => {
    if (!result || !selectedCall) return;
    setResult(prev => prev ? { ...prev, status: 'analyzing' } : null);

    try {
      const res = await fetch(ANALYZE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: result.full_text,
          comm_id: selectedCall.comm_id,
          duration_sec: selectedCall.duration_sec,
        }),
      });
      const analysis = await res.json();
      setResult(prev => prev ? { ...prev, status: 'done', cached: prev.cached, analysis } : null);
    } catch {
      setResult(prev => prev ? { ...prev, status: 'done' } : null);
    }
  };

  const callsWithRecords = calls.filter(c => c.record_url).length;

  return (
    <div className="flex gap-6 h-[calc(100vh-120px)]">

      {/* Левая панель — список звонков */}
      <div className="w-72 shrink-0 flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Транскрибация</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {callsWithRecords} звонков с записью
          </p>
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по дате или ID…"
          className="px-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {filteredCalls.map((call, i) => {
            const isSelected = selectedCall?.comm_id === call.comm_id;
            const durMin = Math.floor(call.duration_sec / 60);
            const durSec = call.duration_sec % 60;
            return (
              <div key={i}
                onClick={() => handleTranscribe(call)}
                className="p-3 rounded-xl cursor-pointer transition-all"
                style={{
                  background: isSelected ? 'var(--brand-green-muted)' : 'var(--bg-card)',
                  border: `1px solid ${isSelected ? 'rgba(0,255,136,0.3)' : 'var(--border-default)'}`,
                }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono" style={{ color: isSelected ? 'var(--brand-green)' : 'var(--text-secondary)' }}>
                    {call.date}
                  </span>
                  <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    {durMin}:{String(durSec).padStart(2, '0')}
                  </span>
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  ID: {call.comm_id || '—'}
                </div>
                {isSelected && result && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {result.status === 'transcribing' && (
                      <span className="text-xs flex items-center gap-1" style={{ color: 'var(--brand-green)' }}>
                        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--brand-green)' }} />
                        Транскрибирую…
                      </span>
                    )}
                    {result.status === 'analyzing' && (
                      <span className="text-xs flex items-center gap-1" style={{ color: '#ff8c00' }}>
                        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#ff8c00' }} />
                        Анализирую…
                      </span>
                    )}
                    {result.status === 'done' && (
                      <span className="text-xs flex items-center gap-1" style={{ color: 'var(--brand-green)' }}>
                        <Icon name="CheckCircle" size={11} />
                        Готово
                      </span>
                    )}
                    {result.status === 'error' && (
                      <span className="text-xs flex items-center gap-1" style={{ color: '#ff4444' }}>
                        <Icon name="XCircle" size={11} />
                        Ошибка
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {filteredCalls.length === 0 && (
            <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>Нет звонков с записью</p>
          )}
        </div>
      </div>

      {/* Правая панель — результат */}
      <div className="flex-1 overflow-y-auto">
        {!selectedCall && (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--brand-green-muted)' }}>
              <Icon name="Mic" size={28} style={{ color: 'var(--brand-green)' }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                Выберите звонок
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Нажмите на звонок слева — он будет транскрибирован через Yandex SpeechKit,<br/>
                затем проанализирован ИИ
              </p>
            </div>
          </div>
        )}

        {selectedCall && result && (
          <div>
            {/* Заголовок */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    Звонок {selectedCall.date} · {selectedCall.duration}
                  </h3>
                  {result.cached && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--brand-green)' }}>
                      <Icon name="Database" size={10} />
                      из кэша
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  ID: {selectedCall.comm_id} · {selectedCall.call_type}
                </p>
              </div>
              {selectedCall.record_url && (
                <a href={selectedCall.record_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                  <Icon name="Play" size={12} />
                  Слушать
                </a>
              )}
            </div>

            {result.status === 'transcribing' && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-3 h-3 rounded-full animate-pulse"
                      style={{ background: 'var(--brand-green)', animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Yandex SpeechKit транскрибирует звонок…
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Обычно занимает 10–30 секунд
                </p>
              </div>
            )}

            {result.status === 'error' && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Icon name="AlertTriangle" size={32} style={{ color: '#ff4444' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Ошибка транскрибации</p>
                <p className="text-xs text-center max-w-sm" style={{ color: 'var(--text-muted)' }}>{result.error}</p>
                <button onClick={() => handleTranscribe(selectedCall)}
                  className="px-4 py-2 rounded-lg text-xs font-medium mt-2"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                  Попробовать снова
                </button>
              </div>
            )}

            {(result.status === 'done' || result.status === 'analyzing') && result.replica_count > 0 && (
              <TranscriptView result={result} onAnalyze={handleAnalyze} />
            )}

            {result.status === 'done' && result.replica_count === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Icon name="FileX" size={32} style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Транскрипт пуст — возможно, запись недоступна</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}