import { useEffect, useState, useRef } from 'react';
import { type CallsData, type CallRecord } from '@/lib/dataParser';
import Icon from '@/components/ui/icon';

const TRANSCRIBE_URL = 'https://functions.poehali.dev/1cc0b8dc-c71b-4292-815d-cdae4f93cea8';
const ANALYZE_URL = 'https://functions.poehali.dev/6f70becf-3fb4-43a7-98a5-747436055b2d';

// Параллельно не больше N запросов
const CONCURRENCY = 3;

type JobStatus = 'waiting' | 'transcribing' | 'analyzing' | 'done' | 'error' | 'skipped';

interface Job {
  call: CallRecord;
  status: JobStatus;
  error?: string;
}

interface Props {
  data: CallsData;
  onDone: (data: CallsData) => void;
  onSkip: () => void;
}

async function transcribeCall(call: CallRecord): Promise<void> {
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
  if (data.error) throw new Error(data.error);
  if (data.status === 'pending') throw new Error('timeout');

  // Если транскрипт не пустой — анализируем
  if (data.full_text && data.replica_count > 0) {
    const res2 = await fetch(ANALYZE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: data.full_text,
        comm_id: call.comm_id,
        duration_sec: call.duration_sec,
      }),
    });
    await res2.json();
  }
}

export default function TranscribingScreen({ data, onDone, onSkip }: Props) {
  const callsWithUrl = data.calls.filter(c => c.record_url);
  const total = callsWithUrl.length;

  const [jobs, setJobs] = useState<Job[]>(
    callsWithUrl.map(c => ({ call: c, status: 'waiting' as JobStatus }))
  );
  const [started, setStarted] = useState(false);
  const activeRef = useRef(0);
  const indexRef = useRef(0);
  const doneRef = useRef(0);

  const updateJob = (comm_id: string, patch: Partial<Job>) => {
    setJobs(prev => prev.map(j => j.call.comm_id === comm_id ? { ...j, ...patch } : j));
  };

  const processNext = async () => {
    if (indexRef.current >= total) return;
    const idx = indexRef.current++;
    const job = callsWithUrl[idx];
    activeRef.current++;

    updateJob(job.comm_id, { status: 'transcribing' });

    try {
      await transcribeCall(job);
      updateJob(job.comm_id, { status: 'done' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ошибка';
      // timeout — помечаем как skipped (CoMagic требует auth для скачивания)
      updateJob(job.comm_id, {
        status: msg === 'timeout' ? 'skipped' : 'error',
        error: msg,
      });
    }

    activeRef.current--;
    doneRef.current++;

    // Запускаем следующий
    processNext();
  };

  const startAll = () => {
    setStarted(true);
    // Запускаем CONCURRENCY параллельных воркеров
    for (let i = 0; i < Math.min(CONCURRENCY, total); i++) {
      processNext();
    }
  };

  const done = jobs.filter(j => j.status === 'done' || j.status === 'error' || j.status === 'skipped').length;
  const errors = jobs.filter(j => j.status === 'error').length;
  const skipped = jobs.filter(j => j.status === 'skipped').length;
  const success = jobs.filter(j => j.status === 'done').length;
  const inProgress = jobs.filter(j => j.status === 'transcribing' || j.status === 'analyzing').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = done === total && total > 0;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'var(--bg-primary)', fontFamily: "'Golos Text', sans-serif" }}>

      {/* Лого */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-xl"
          style={{ background: 'var(--brand-green)', color: '#000' }}>S</div>
        <div>
          <div className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>СайтАктив</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Транскрибация звонков</div>
        </div>
      </div>

      <div className="w-full max-w-lg rounded-2xl p-8"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>

        {/* Заголовок */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: allDone ? 'rgba(0,255,136,0.12)' : 'var(--brand-green-muted)' }}>
            {allDone
              ? <Icon name="CheckCircle" size={28} style={{ color: 'var(--brand-green)' }} />
              : <Icon name="Mic" size={28} style={{ color: 'var(--brand-green)' }} />
            }
          </div>
          <h1 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            {!started ? 'Готов к транскрибации' : allDone ? 'Транскрибация завершена' : 'Транскрибирую звонки…'}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {!started
              ? `Найдено ${total} звонков с записью. Yandex SpeechKit распознает речь и ИИ проанализирует каждый звонок.`
              : allDone
              ? `Готово: ${success} обработано, ${errors} ошибок, ${skipped} пропущено`
              : `Обрабатываю одновременно ${CONCURRENCY} звонка…`
            }
          </p>
        </div>

        {/* Прогресс-бар */}
        {started && (
          <div className="mb-6">
            <div className="flex justify-between text-xs mb-2">
              <span style={{ color: 'var(--text-muted)' }}>Прогресс</span>
              <span style={{ color: 'var(--brand-green)' }} className="font-mono font-bold">
                {done} / {total} ({pct}%)
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: 'var(--brand-green)' }} />
            </div>
            {/* Статусы */}
            <div className="flex gap-4 mt-3 text-xs">
              {[
                { label: 'Готово', count: success, color: 'var(--brand-green)' },
                { label: 'В работе', count: inProgress, color: '#ff8c00' },
                { label: 'Пропущено', count: skipped, color: 'var(--text-muted)' },
                { label: 'Ошибок', count: errors, color: '#ff4444' },
              ].map((s, i) => s.count > 0 && (
                <span key={i} style={{ color: s.color }}>
                  {s.label}: {s.count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Список активных задач */}
        {started && !allDone && (
          <div className="mb-5 max-h-40 overflow-y-auto space-y-1.5 pr-1">
            {jobs.filter(j => j.status === 'transcribing' || j.status === 'analyzing').map((j, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ background: 'var(--bg-elevated)' }}>
                <div className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
                  style={{ background: 'var(--brand-green)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>{j.call.date} · {j.call.duration}</span>
                <span className="ml-auto font-mono" style={{ color: 'var(--text-muted)' }}>
                  {j.call.comm_id}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Кнопки */}
        <div className="flex flex-col gap-3">
          {!started && (
            <>
              <button onClick={startAll}
                className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                style={{ background: 'var(--brand-green)', color: '#000' }}>
                <Icon name="Mic" size={16} />
                Запустить транскрибацию
              </button>
              <button onClick={onSkip}
                className="w-full py-2.5 rounded-xl text-sm transition-opacity hover:opacity-70"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                Пропустить — открыть дашборд
              </button>
            </>
          )}

          {started && !allDone && (
            <button onClick={onSkip}
              className="w-full py-2.5 rounded-xl text-sm transition-opacity hover:opacity-70"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
              Не ждать — открыть дашборд (фоновая обработка продолжится)
            </button>
          )}

          {allDone && (
            <button onClick={() => onDone(data)}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: 'var(--brand-green)', color: '#000' }}>
              <Icon name="LayoutDashboard" size={16} />
              Открыть дашборд с аналитикой
            </button>
          )}
        </div>
      </div>

      {/* Инфо о стоимости */}
      {!started && (
        <p className="mt-5 text-xs text-center max-w-sm" style={{ color: 'var(--text-muted)' }}>
          Повторная обработка бесплатна — результаты кэшируются в базе данных
        </p>
      )}
    </div>
  );
}
