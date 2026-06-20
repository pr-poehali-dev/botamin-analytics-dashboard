import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { type CallsCounts } from './callsTableTypes';

interface Props {
  search: string; setSearch: (v: string) => void;
  dateFrom: string; setDateFrom: (v: string) => void;
  dateTo: string; setDateTo: (v: string) => void;
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

const selStyle = (active: boolean) => ({
  background: 'var(--bg-elevated)',
  border: `1px solid ${active ? 'rgba(0,255,136,0.4)' : 'var(--border-default)'}`,
  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
});

const inputStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  color: 'var(--text-primary)',
};

export default function CallsFilters({
  search, setSearch,
  dateFrom, setDateFrom, dateTo, setDateTo,
  minSec, setMinSec, maxSec, setMaxSec,
  statusFilter, setStatusFilter,
  transcriptFilter, setTranscriptFilter,
  scoreFilter, setScoreFilter,
  interestFilter, setInterestFilter,
  qualFilter, setQualFilter,
  scriptFilter, setScriptFilter,
  objFilter, setObjFilter,
  ivrFilter, setIvrFilter,
  onReset, cnt,
}: Props) {
  const [open, setOpen] = useState(false);

  const activeCount = [
    dateFrom, dateTo, minSec, maxSec,
    statusFilter, transcriptFilter, scoreFilter,
    interestFilter, qualFilter, scriptFilter, objFilter, ivrFilter,
  ].filter(Boolean).length;

  const hasAny = !!(search || activeCount > 0);

  const labelCls = 'text-xs font-semibold mb-1 block';
  const labelStyle = { color: 'var(--text-muted)' };

  return (
    <div className="space-y-2">
      {/* Строка поиска + кнопка фильтров */}
      <div className="flex gap-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по ID звонка…"
          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
          style={inputStyle}
        />
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold shrink-0 relative transition-all"
          style={{
            background: open || activeCount > 0 ? 'rgba(0,255,136,0.12)' : 'var(--bg-elevated)',
            border: `1px solid ${activeCount > 0 ? 'rgba(0,255,136,0.5)' : open ? 'rgba(0,255,136,0.3)' : 'var(--border-default)'}`,
            color: activeCount > 0 ? 'var(--brand-green)' : 'var(--text-secondary)',
          }}>
          <Icon name="SlidersHorizontal" size={14} />
          Фильтры
          {activeCount > 0 && (
            <span className="w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold"
              style={{ background: 'var(--brand-green)', color: '#000' }}>
              {activeCount}
            </span>
          )}
        </button>
        {hasAny && (
          <button onClick={onReset}
            className="px-3 py-2 rounded-lg text-xs shrink-0"
            style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', color: '#ff6666' }}>
            <Icon name="X" size={14} />
          </button>
        )}
      </div>

      {/* Единая панель фильтров */}
      {open && (
        <div className="rounded-xl p-4 space-y-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>

          {/* Период */}
          <div>
            <label className={labelCls} style={labelStyle}>Период</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
                <span className="text-xs mt-0.5 block" style={{ color: 'var(--text-muted)' }}>С</span>
              </div>
              <div>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
                <span className="text-xs mt-0.5 block" style={{ color: 'var(--text-muted)' }}>По</span>
              </div>
            </div>
          </div>

          {/* Длительность */}
          <div>
            <label className={labelCls} style={labelStyle}>Длительность (секунды)</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={minSec} onChange={e => setMinSec(e.target.value)}
                placeholder="От (сек)" type="number" min="0"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
              <input
                value={maxSec} onChange={e => setMaxSec(e.target.value)}
                placeholder="До (сек)" type="number" min="0"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Статус + Транскрипт */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls} style={labelStyle}>Статус</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                style={selStyle(!!statusFilter)}>
                <option value="">Все</option>
                <option value="success">✅ Успех ({cnt.success})</option>
                <option value="failure">❌ Отказ ({cnt.failure})</option>
                <option value="pending">🔄 В работе ({cnt.pending})</option>
                <option value="target">🎯 Целевые ({cnt.target})</option>
                <option value="non_target">⛔ Нецелевые ({cnt.non_target})</option>
                <option value="no_ai">⚪ Без анализа ({cnt.no_ai})</option>
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Транскрипт</label>
              <select value={transcriptFilter} onChange={e => setTranscriptFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                style={selStyle(!!transcriptFilter)}>
                <option value="">Все</option>
                <option value="yes">📝 Есть ({cnt.withTranscript})</option>
                <option value="no">🔇 Нет ({cnt.noTranscript})</option>
              </select>
            </div>
          </div>

          {/* Оценка + Интерес */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls} style={labelStyle}>Оценка оператора</label>
              <select value={scoreFilter} onChange={e => setScoreFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                style={selStyle(!!scoreFilter)}>
                <option value="">Все</option>
                <option value="high">⭐ 8–10 ({cnt.scoreHigh})</option>
                <option value="mid">🟡 5–7 ({cnt.scoreMid})</option>
                <option value="low">🔴 1–4 ({cnt.scoreLow})</option>
                <option value="none">— Нет ({cnt.scoreNone})</option>
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Интерес клиента</label>
              <select value={interestFilter} onChange={e => setInterestFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                style={selStyle(!!interestFilter)}>
                <option value="">Все</option>
                <option value="high">🟢 Высокий ({cnt.interestHigh})</option>
                <option value="medium">🟡 Средний ({cnt.interestMedium})</option>
                <option value="low">🔴 Низкий ({cnt.interestLow})</option>
              </select>
            </div>
          </div>

          {/* Квалификация + Скрипт */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls} style={labelStyle}>Квалификация</label>
              <select value={qualFilter} onChange={e => setQualFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                style={selStyle(!!qualFilter)}>
                <option value="">Все</option>
                <option value="yes">✅ Да ({cnt.qualYes})</option>
                <option value="no">❌ Нет ({cnt.qualNo})</option>
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Соблюдение скрипта</label>
              <select value={scriptFilter} onChange={e => setScriptFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                style={selStyle(!!scriptFilter)}>
                <option value="">Все</option>
                <option value="yes">✅ Соблюдён ({cnt.scriptYes})</option>
                <option value="no">❌ Нарушен ({cnt.scriptNo})</option>
              </select>
            </div>
          </div>

          {/* Возражения + IVR */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls} style={labelStyle}>Возражения</label>
              <select value={objFilter} onChange={e => setObjFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                style={selStyle(!!objFilter)}>
                <option value="">Все</option>
                <option value="yes">✅ Отработаны ({cnt.objYes})</option>
                <option value="no">❌ Не отработаны ({cnt.objNo})</option>
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>IVR (автоответчик)</label>
              <select value={ivrFilter} onChange={e => setIvrFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                style={selStyle(!!ivrFilter)}>
                <option value="">Все</option>
                <option value="yes">🤖 Есть ({cnt.ivrYes})</option>
                <option value="no">👤 Без ({cnt.ivrNo})</option>
              </select>
            </div>
          </div>

          {/* Кнопка сброса */}
          {activeCount > 0 && (
            <button onClick={() => { onReset(); setOpen(false); }}
              className="w-full py-2 rounded-lg text-sm font-semibold"
              style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', color: '#ff6666' }}>
              Сбросить все фильтры
            </button>
          )}
        </div>
      )}
    </div>
  );
}
