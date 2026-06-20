import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { type CallsCounts } from './callsTableTypes';

interface Props {
  search: string; setSearch: (v: string) => void;
  minSec: string; setMinSec: (v: string) => void;
  maxSec: string; setMaxSec: (v: string) => void;
  statusFilter: string; setStatusFilter: (v: string) => void;
  transcriptFilter: string; setTranscriptFilter: (v: string) => void;
  scoreFilter: string; setScoreFilter: (v: string) => void;
  interestFilter: string; setInterestFilter: (v: string) => void;
  qualFilter: string; setQualFilter: (v: string) => void;
  scriptFilter: string; setScriptFilter: (v: string) => void;
  objFilter: string; setObjFilter: (v: string) => void;
  ivrFilter: string; setIvrFilter: (v: string) => void;
  onReset: () => void;
  cnt: CallsCounts;
}

const selCls = 'w-full px-3 py-2 rounded-lg text-xs outline-none';
const selStyle = (active: boolean) => ({
  background: 'var(--bg-elevated)',
  border: `1px solid ${active ? 'rgba(0,255,136,0.4)' : 'var(--border-default)'}`,
  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
});

export default function CallsFilters({
  search, setSearch, minSec, setMinSec, maxSec, setMaxSec,
  statusFilter, setStatusFilter, transcriptFilter, setTranscriptFilter,
  scoreFilter, setScoreFilter, interestFilter, setInterestFilter,
  qualFilter, setQualFilter, scriptFilter, setScriptFilter,
  objFilter, setObjFilter, ivrFilter, setIvrFilter,
  onReset, cnt,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const hasAny = !!(search || minSec || maxSec || statusFilter || transcriptFilter
    || scoreFilter || interestFilter || qualFilter || scriptFilter || objFilter || ivrFilter);

  const activeCount = [statusFilter, transcriptFilter, scoreFilter, interestFilter,
    qualFilter, scriptFilter, objFilter, ivrFilter].filter(Boolean).length;

  return (
    <>
      {/* ── МОБИЛЬНЫЙ вид ─────────────────────────────────────────────── */}
      <div className="sm:hidden space-y-2">
        {/* Поиск + кнопка фильтров */}
        <div className="flex gap-2">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Дата или ID звонка…"
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shrink-0 relative"
            style={{
              background: expanded || activeCount > 0 ? 'rgba(0,255,136,0.1)' : 'var(--bg-elevated)',
              border: `1px solid ${activeCount > 0 ? 'rgba(0,255,136,0.4)' : 'var(--border-default)'}`,
              color: activeCount > 0 ? 'var(--brand-green)' : 'var(--text-secondary)',
            }}>
            <Icon name="SlidersHorizontal" size={13} />
            Фильтры
            {activeCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold"
                style={{ background: 'var(--brand-green)', color: '#000' }}>
                {activeCount}
              </span>
            )}
          </button>
          {hasAny && (
            <button onClick={onReset}
              className="px-3 py-2 rounded-lg text-xs shrink-0"
              style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', color: '#ff6666' }}>
              <Icon name="X" size={13} />
            </button>
          )}
        </div>

        {/* Быстрые фильтры (всегда видны) */}
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs outline-none"
            style={selStyle(!!statusFilter)}>
            <option value="">Все статусы</option>
            <option value="success">✅ Успех ({cnt.success})</option>
            <option value="failure">❌ Отказ ({cnt.failure})</option>
            <option value="pending">🔄 В работе ({cnt.pending})</option>
            <option value="target">🎯 Целевые ({cnt.target})</option>
            <option value="non_target">⛔ Нецелевые ({cnt.non_target})</option>
            <option value="no_ai">⚪ Без анализа ({cnt.no_ai})</option>
          </select>
          <select value={transcriptFilter} onChange={e => setTranscriptFilter(e.target.value)}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs outline-none"
            style={selStyle(!!transcriptFilter)}>
            <option value="">Транскрипт: все</option>
            <option value="yes">📝 Есть ({cnt.withTranscript})</option>
            <option value="no">🔇 Нет ({cnt.noTranscript})</option>
          </select>
          <select value={scoreFilter} onChange={e => setScoreFilter(e.target.value)}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs outline-none"
            style={selStyle(!!scoreFilter)}>
            <option value="">Оценка: все</option>
            <option value="high">⭐ 8–10 ({cnt.scoreHigh})</option>
            <option value="mid">🟡 5–7 ({cnt.scoreMid})</option>
            <option value="low">🔴 1–4 ({cnt.scoreLow})</option>
            <option value="none">— Нет ({cnt.scoreNone})</option>
          </select>
        </div>

        {/* Раскрывающаяся панель доп. фильтров */}
        {expanded && (
          <div className="rounded-xl p-3 space-y-2"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <div className="grid grid-cols-2 gap-2">
              <input value={minSec} onChange={e => setMinSec(e.target.value)}
                placeholder="Мин. сек." type="number"
                className="px-3 py-2 rounded-lg text-xs outline-none"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
              <input value={maxSec} onChange={e => setMaxSec(e.target.value)}
                placeholder="Макс. сек." type="number"
                className="px-3 py-2 rounded-lg text-xs outline-none"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={interestFilter} onChange={e => setInterestFilter(e.target.value)} className={selCls} style={selStyle(!!interestFilter)}>
                <option value="">Интерес: все</option>
                <option value="high">🟢 Высокий ({cnt.interestHigh})</option>
                <option value="medium">🟡 Средний ({cnt.interestMedium})</option>
                <option value="low">🔴 Низкий ({cnt.interestLow})</option>
              </select>
              <select value={qualFilter} onChange={e => setQualFilter(e.target.value)} className={selCls} style={selStyle(!!qualFilter)}>
                <option value="">Квалиф.: все</option>
                <option value="yes">✅ Да ({cnt.qualYes})</option>
                <option value="no">❌ Нет ({cnt.qualNo})</option>
              </select>
              <select value={scriptFilter} onChange={e => setScriptFilter(e.target.value)} className={selCls} style={selStyle(!!scriptFilter)}>
                <option value="">Скрипт: все</option>
                <option value="yes">✅ Соблюдён ({cnt.scriptYes})</option>
                <option value="no">❌ Нарушен ({cnt.scriptNo})</option>
              </select>
              <select value={objFilter} onChange={e => setObjFilter(e.target.value)} className={selCls} style={selStyle(!!objFilter)}>
                <option value="">Возражения: все</option>
                <option value="yes">✅ Отработаны ({cnt.objYes})</option>
                <option value="no">❌ Нет ({cnt.objNo})</option>
              </select>
              <select value={ivrFilter} onChange={e => setIvrFilter(e.target.value)} className={`${selCls} col-span-2`} style={selStyle(!!ivrFilter)}>
                <option value="">IVR: все</option>
                <option value="yes">🤖 Есть автоответчик ({cnt.ivrYes})</option>
                <option value="no">👤 Без автоответчика ({cnt.ivrNo})</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── ДЕСКТОПНЫЙ вид ────────────────────────────────────────────── */}
      <div className="hidden sm:flex flex-wrap gap-3">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по дате или ID звонка…"
          className="flex-1 min-w-48 px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
        <input
          value={minSec} onChange={e => setMinSec(e.target.value)}
          placeholder="Мин. сек." type="number" className="w-32 px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
        <input
          value={maxSec} onChange={e => setMaxSec(e.target.value)}
          placeholder="Макс. сек." type="number" className="w-32 px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />

        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs outline-none" style={selStyle(!!statusFilter)}>
          <option value="">Все статусы</option>
          <option value="success">✅ Успех ({cnt.success})</option>
          <option value="failure">❌ Отказ ({cnt.failure})</option>
          <option value="pending">🔄 В работе ({cnt.pending})</option>
          <option value="target">🎯 Целевые ({cnt.target})</option>
          <option value="non_target">⛔ Нецелевые ({cnt.non_target})</option>
          <option value="no_ai">⚪ Без анализа ({cnt.no_ai})</option>
        </select>
        <select value={transcriptFilter} onChange={e => setTranscriptFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs outline-none" style={selStyle(!!transcriptFilter)}>
          <option value="">Транскрипт: все</option>
          <option value="yes">📝 С транскриптом ({cnt.withTranscript})</option>
          <option value="no">🔇 Без транскрипта ({cnt.noTranscript})</option>
        </select>
        <select value={scoreFilter} onChange={e => setScoreFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs outline-none" style={selStyle(!!scoreFilter)}>
          <option value="">Оценка: все</option>
          <option value="high">⭐ Высокая 8–10 ({cnt.scoreHigh})</option>
          <option value="mid">🟡 Средняя 5–7 ({cnt.scoreMid})</option>
          <option value="low">🔴 Низкая 1–4 ({cnt.scoreLow})</option>
          <option value="none">— Без оценки ({cnt.scoreNone})</option>
        </select>
        <select value={interestFilter} onChange={e => setInterestFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs outline-none" style={selStyle(!!interestFilter)}>
          <option value="">Интерес клиента: все</option>
          <option value="high">🟢 Высокий ({cnt.interestHigh})</option>
          <option value="medium">🟡 Средний ({cnt.interestMedium})</option>
          <option value="low">🔴 Низкий ({cnt.interestLow})</option>
        </select>
        <select value={qualFilter} onChange={e => setQualFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs outline-none" style={selStyle(!!qualFilter)}>
          <option value="">Квалификация: все</option>
          <option value="yes">✅ Квалифицирован ({cnt.qualYes})</option>
          <option value="no">❌ Не квалифицирован ({cnt.qualNo})</option>
        </select>
        <select value={scriptFilter} onChange={e => setScriptFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs outline-none" style={selStyle(!!scriptFilter)}>
          <option value="">Скрипт: все</option>
          <option value="yes">✅ Соблюдён ({cnt.scriptYes})</option>
          <option value="no">❌ Нарушен ({cnt.scriptNo})</option>
        </select>
        <select value={objFilter} onChange={e => setObjFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs outline-none" style={selStyle(!!objFilter)}>
          <option value="">Возражения: все</option>
          <option value="yes">✅ Отработаны ({cnt.objYes})</option>
          <option value="no">❌ Не отработаны ({cnt.objNo})</option>
        </select>
        <select value={ivrFilter} onChange={e => setIvrFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs outline-none" style={selStyle(!!ivrFilter)}>
          <option value="">IVR: все</option>
          <option value="yes">🤖 Есть автоответчик ({cnt.ivrYes})</option>
          <option value="no">👤 Без автоответчика ({cnt.ivrNo})</option>
        </select>
        {hasAny && (
          <button onClick={onReset}
            className="px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', color: '#ff6666' }}>
            Сбросить всё
          </button>
        )}
      </div>
    </>
  );
}
