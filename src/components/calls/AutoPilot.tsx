import { useState, useRef, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { type CallRecord } from '@/lib/dataParser';

const BATCH_API_URL     = 'https://functions.poehali.dev/f43c5cc1-1b9b-41aa-ac2a-416878c7f5b9';
const BATCH_STATUS_URL  = `${BATCH_API_URL}?action=status`;
const BATCH_ANALYZE_URL = `${BATCH_API_URL}?action=pending`;
const TRANSCRIBE_URL    = 'https://functions.poehali.dev/1cc0b8dc-c71b-4292-815d-cdae4f93cea8';
const ANALYZE_URL       = 'https://functions.poehali.dev/6f70becf-3fb4-43a7-98a5-747436055b2d';
const AI_INSIGHTS_URL   = 'https://functions.poehali.dev/d671000f-9e45-471d-870d-789e1dd542c6';
const AI_REC_URL        = `${AI_INSIGHTS_URL}?action=recs`;

type Phase = 'idle' | 'transcribing' | 'analyzing' | 'recommendations' | 'done';

interface Props {
  calls: CallRecord[];
  autoStart?: boolean;
}

export default function AutoPilot({ calls, autoStart }: Props) {
  const [open, setOpen]         = useState(false);
  const [phase, setPhase]       = useState<Phase>('idle');
  const [total, setTotal]       = useState(0);
  const [done, setDone]         = useState(0);
  const [current, setCurrent]   = useState('');
  const [summary, setSummary]   = useState('');
  const stopRef   = useRef(false);
  const didAuto   = useRef(false);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const [pendingTranscribe, setPendingTranscribe] = useState(0);
  const [pendingAnalyze, setPendingAnalyze]       = useState(0);

  // Автозапуск при autoStart=true (после загрузки файла с включённым тогглом)
  useEffect(() => {
    if (autoStart && !didAuto.current && calls.length > 0) {
      didAuto.current = true;
      setOpen(true);
      // Небольшая задержка чтобы модалка успела открыться
      setTimeout(() => handleStart(), 300);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, calls.length]);

  useEffect(() => {
    if (!open) return;
    // Узнаём сколько без транскрипта и без анализа
    fetch(BATCH_STATUS_URL)
      .then(r => r.json())
      .then(d => {
        const doneIds = new Set(Object.keys(d.done || {}));
        const withRecord = calls.filter(c => c.record_url);
        setPendingTranscribe(withRecord.filter(c => !doneIds.has(c.comm_id)).length);
      })
      .catch(() => {});

    fetch(BATCH_ANALYZE_URL)
      .then(r => r.json())
      .then(d => setPendingAnalyze(d.count || 0))
      .catch(() => {});
  }, [open, calls]);

  const handleStart = async () => {
    stopRef.current = false;

    // ── ЭТАП 1: транскрибация ──
    const statusRes = await fetch(BATCH_STATUS_URL);
    const statusData = await statusRes.json();
    const doneIds = new Set(Object.keys(statusData.done || {}));
    const toTranscribe = calls.filter(c => c.record_url && !doneIds.has(c.comm_id));

    if (toTranscribe.length > 0) {
      setPhase('transcribing');
      setTotal(toTranscribe.length);
      setDone(0);

      for (let i = 0; i < toTranscribe.length; i++) {
        if (stopRef.current) { setPhase('idle'); return; }
        const call = toTranscribe[i];
        setCurrent(call.comm_id);

        try {
          const res  = await fetch(TRANSCRIBE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audio_url:    call.record_url,
              comm_id:      call.comm_id,
              date:         call.date,
              duration:     call.duration,
              duration_sec: call.duration_sec,
            }),
          });
          const data = await res.json();
          // Если processing — ждём
          if (data.status === 'processing') {
            for (let p = 0; p < 12; p++) {
              await sleep(5000);
              if (stopRef.current) { setPhase('idle'); return; }
              const poll = await fetch(`${TRANSCRIBE_URL}?comm_id=${call.comm_id}`);
              const pd   = await poll.json();
              if (pd.status === 'done') break;
            }
          }
        } catch { /* продолжаем */ }

        setDone(i + 1);
        if (i < toTranscribe.length - 1) await sleep(1000);
      }
    }

    // ── ЭТАП 2: анализ ──
    if (stopRef.current) { setPhase('idle'); return; }

    const pendingRes  = await fetch(BATCH_ANALYZE_URL);
    const pendingData = await pendingRes.json();
    const toAnalyze   = pendingData.pending || [];

    if (toAnalyze.length > 0) {
      setPhase('analyzing');
      setTotal(toAnalyze.length);
      setDone(0);

      for (let i = 0; i < toAnalyze.length; i++) {
        if (stopRef.current) { setPhase('idle'); return; }
        const item = toAnalyze[i];
        setCurrent(item.comm_id);

        try {
          await fetch(ANALYZE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transcript:   item.full_text,
              comm_id:      item.comm_id,
              duration_sec: item.duration_sec,
            }),
          });
        } catch { /* продолжаем */ }

        setDone(i + 1);
        if (i < toAnalyze.length - 1) await sleep(1500);
      }
    }

    // ── ЭТАП 3: обновление рекомендаций ──
    if (!stopRef.current) {
      setPhase('recommendations');
      setCurrent('');
      try {
        await fetch(AI_REC_URL);
      } catch { /* ignore */ }
    }

    setPhase('done');
    setCurrent('');
    setSummary(`Транскрибировано: ${toTranscribe.length} · Проанализировано: ${toAnalyze.length} · Рекомендации обновлены`);
  };

  const handleStop = () => {
    stopRef.current = true;
    setPhase('idle');
    setCurrent('');
  };

  const handleClose = () => {
    if (phase !== 'idle' && phase !== 'done') return;
    setOpen(false);
    setPhase('idle');
    setSummary('');
    setDone(0);
  };

  const isRunning = phase === 'transcribing' || phase === 'analyzing' || phase === 'recommendations';
  const phaseLabel = phase === 'transcribing' ? 'Транскрибирую' : phase === 'analyzing' ? 'Анализирую' : phase === 'recommendations' ? 'Обновляю рекомендации' : '';
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <>
      {/* Кнопка в шапке */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90"
        style={isRunning ? {
          background: 'linear-gradient(135deg, var(--brand-green), #00ccaa)',
          color: '#000',
          boxShadow: '0 0 12px rgba(0,255,136,0.3)',
        } : {
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-secondary)',
        }}>
        <Icon name="Zap" size={13} style={{ color: isRunning ? '#000' : 'var(--brand-green)' }} />
        {isRunning ? `АВТО ${done}/${total}` : 'АВТО'}
      </button>

      {/* Модалка */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={e => e.target === e.currentTarget && handleClose()}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>

            {/* Шапка */}
            <div className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid var(--border-default)' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(0,255,136,0.15)' }}>
                  <Icon name="Zap" size={16} style={{ color: 'var(--brand-green)' }} />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Авто-режим</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Транскрибация + ИИ-анализ + Рекомендации</p>
                </div>
              </div>
              {!isRunning && (
                <button onClick={handleClose}
                  className="w-7 h-7 flex items-center justify-center rounded-lg"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                  <Icon name="X" size={13} />
                </button>
              )}
            </div>

            {/* Контент */}
            <div className="px-6 py-5 space-y-4">

              {phase === 'idle' && (
                <>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Автоматически обработает все звонки с записью:
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                      style={{ background: 'var(--bg-elevated)' }}>
                      <div className="flex items-center gap-2">
                        <Icon name="Mic" size={13} style={{ color: 'var(--brand-green)' }} />
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Шаг 1 — Транскрибация</span>
                      </div>
                      <span className="text-xs font-mono font-bold" style={{ color: pendingTranscribe > 0 ? '#ff8c00' : 'var(--brand-green)' }}>
                        {pendingTranscribe > 0 ? `${pendingTranscribe} ожидают` : '✓ готово'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                      style={{ background: 'var(--bg-elevated)' }}>
                      <div className="flex items-center gap-2">
                        <Icon name="Sparkles" size={13} style={{ color: '#00aaff' }} />
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Шаг 2 — ИИ-анализ</span>
                      </div>
                      <span className="text-xs font-mono font-bold" style={{ color: (pendingAnalyze + pendingTranscribe) > 0 ? '#ff8c00' : 'var(--brand-green)' }}>
                        {(pendingAnalyze + pendingTranscribe) > 0
                          ? `~${pendingAnalyze + pendingTranscribe} ожидают`
                          : '✓ готово'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                      style={{ background: 'var(--bg-elevated)' }}>
                      <div className="flex items-center gap-2">
                        <Icon name="Lightbulb" size={13} style={{ color: '#ff8c00' }} />
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Шаг 3 — Рекомендации</span>
                      </div>
                      <span className="text-xs font-mono font-bold" style={{ color: 'var(--text-muted)' }}>автоматически</span>
                    </div>
                  </div>
                  {pendingTranscribe === 0 && pendingAnalyze === 0 ? (
                    <div className="flex items-center gap-2 px-3 py-3 rounded-xl"
                      style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)' }}>
                      <Icon name="CheckCircle" size={14} style={{ color: 'var(--brand-green)' }} />
                      <p className="text-xs" style={{ color: 'var(--brand-green)' }}>Все звонки уже обработаны!</p>
                    </div>
                  ) : (
                    <button onClick={handleStart}
                      className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg, var(--brand-green), #00ccaa)', color: '#000' }}>
                      <Icon name="Zap" size={16} />
                      Запустить авто-режим
                    </button>
                  )}
                </>
              )}

              {isRunning && (
                <div className="space-y-4">

                  {/* Общий прогресс */}
                  <div className="px-4 py-3 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {[0,1,2].map(i => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full animate-pulse"
                              style={{ background: 'var(--brand-green)', animationDelay: `${i*0.2}s` }} />
                          ))}
                        </div>
                        <span className="text-xs font-semibold" style={{ color: 'var(--brand-green)' }}>
                          {phaseLabel}…
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                          {done}/{total}
                        </span>
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded-md"
                          style={{ background: 'rgba(0,255,136,0.12)', color: 'var(--brand-green)' }}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--brand-green), #00ccaa)' }} />
                    </div>
                  </div>

                  {/* Шаги с прогрессом */}
                  <div className="space-y-2">
                    {[
                      { id: 'transcribing',    label: 'Шаг 1 — Транскрибация', icon: 'Mic',       color: 'var(--brand-green)', bg: 'rgba(0,255,136,0.08)',   border: 'rgba(0,255,136,0.2)' },
                      { id: 'analyzing',       label: 'Шаг 2 — ИИ-анализ',     icon: 'Sparkles',  color: '#00aaff',            bg: 'rgba(0,170,255,0.08)',   border: 'rgba(0,170,255,0.2)' },
                      { id: 'recommendations', label: 'Шаг 3 — Рекомендации',  icon: 'Lightbulb', color: '#ff8c00',            bg: 'rgba(255,140,0,0.08)',   border: 'rgba(255,140,0,0.2)' },
                    ].map(step => {
                      const isActive = phase === step.id;
                      const isDone   = (step.id === 'transcribing' && (phase === 'analyzing' || phase === 'recommendations' || phase === 'done'))
                                    || (step.id === 'analyzing' && (phase === 'recommendations' || phase === 'done'));
                      const stepPct  = isActive ? pct : isDone ? 100 : 0;
                      const stepDone = isActive ? done : isDone ? total : 0;
                      const stepTotal = isActive ? total : 0;

                      return (
                        <div key={step.id} className="px-3 py-2.5 rounded-xl overflow-hidden"
                          style={{
                            background: isActive ? step.bg : isDone ? 'rgba(0,255,136,0.04)' : 'var(--bg-elevated)',
                            border: `1px solid ${isActive ? step.border : isDone ? 'rgba(0,255,136,0.1)' : 'transparent'}`,
                          }}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <Icon name={isDone ? 'CheckCircle' : step.icon} size={12}
                              style={{ color: isActive ? step.color : isDone ? 'var(--brand-green)' : 'var(--text-muted)', flexShrink: 0 }} />
                            <span className="text-xs flex-1 font-medium"
                              style={{ color: isActive ? step.color : isDone ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                              {step.label}
                            </span>
                            {isActive && stepTotal > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-mono" style={{ color: step.color }}>
                                  {stepDone}/{stepTotal}
                                </span>
                                <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
                                  style={{ background: 'rgba(0,0,0,0.25)', color: step.color }}>
                                  {stepPct}%
                                </span>
                              </div>
                            )}
                            {isDone && (
                              <span className="text-xs font-mono" style={{ color: 'var(--brand-green)' }}>✓ готово</span>
                            )}
                            {!isActive && !isDone && (
                              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--border-default)' }} />
                            )}
                          </div>

                          {/* Прогресс-бар внутри шага */}
                          {(isActive || isDone) && (
                            <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${stepPct}%`,
                                  background: isDone ? 'rgba(0,255,136,0.4)' : step.color,
                                }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    ID: {current}
                  </p>

                  <button onClick={handleStop}
                    className="w-full py-2 rounded-xl text-xs font-semibold"
                    style={{ background: 'rgba(255,68,68,0.1)', color: '#ff4444', border: '1px solid rgba(255,68,68,0.2)' }}>
                    Остановить
                  </button>
                </div>
              )}

              {phase === 'done' && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ background: 'rgba(0,255,136,0.15)' }}>
                      <Icon name="CheckCircle" size={24} style={{ color: 'var(--brand-green)' }} />
                    </div>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Авто-режим завершён</p>
                    <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>{summary}</p>
                  </div>
                  <button onClick={handleClose}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: 'var(--brand-green)', color: '#000' }}>
                    Закрыть
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}