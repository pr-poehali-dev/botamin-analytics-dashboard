export type CallStage = 0 | 1 | 2 | 3 | 4;

export interface CallRecord {
  phone: string;
  datetime: Date;
  durationSec: number;
  status: string;
  audioUrl: string;
  endReason: string;
  dialogue: string;
  stage: CallStage;
  industry: string;
  replicaCount: number;
  lastClientPhrase: string;
}

export interface FunnelData {
  stage: number;
  label: string;
  count: number;
  pct: number;
  dropPct: number;
  color: string;
}

export interface HourlyData {
  hour: number;
  label: string;
  calls: number;
  converted: number;
  cr: number;
}

export interface DayData {
  day: string;
  calls: number;
  converted: number;
  cr: number;
}

export interface RefusalPhrase {
  phrase: string;
  count: number;
  stage: number;
}

export interface IndustryData {
  industry: string;
  calls: number;
  converted: number;
  cr: number;
}

export interface DashboardData {
  records: CallRecord[];
  total: number;
  withDialogue: number;
  leads: number;
  overallCR: number;
  avgDurationSec: number;
  funnel: FunnelData[];
  hourly: HourlyData[];
  byDay: DayData[];
  refusalPhrases: RefusalPhrase[];
  successPhrases: RefusalPhrase[];
  byIndustry: IndustryData[];
  endReasonBreakdown: { name: string; value: number; color: string }[];
  durationBuckets: { label: string; count: number }[];
}

const STAGE_COLORS = ['#555555', '#ff4444', '#ff8c00', '#00aaff', '#00ff88'];

const STAGE_LABELS = [
  'Не вступил в диалог',
  'Отказ на приветствии',
  'Слушал, но ушёл',
  'Согласился на встречу',
  'Квалифицирован (лид)',
];

const MEETING_KEYWORDS = [
  'понедельник', 'вторник', 'среда', 'среду', 'четверг', 'четверга',
  'пятница', 'пятницу', 'суббота', 'воскресенье',
  'завтра', 'послезавтра', 'сегодня',
  'утром', 'вечером', 'часов', 'час', 'дня',
  'в два', 'в три', 'в четыре', 'в пять', 'в шесть',
  'записал', 'отлично', 'договорились', 'встречаемся', 'встретимся',
  'подходит', 'хорошо', 'записываю', 'жду',
];

const QUALIFICATION_KEYWORDS = [
  'квалифицир', 'сколько человек', 'сколько менеджеров', 'оборот',
  'бюджет', 'ответственный', 'решение принимает',
];

const OFFER_KEYWORDS = [
  'кейс', 'внедрили', 'процентов', '%', 'результат', 'конверсия',
  'автоматизац', 'ИИ', 'бот', 'сократили', 'выросла', 'экономия',
];

const REFUSAL_KEYWORDS = [
  'не интересует', 'не интересно', 'не нужно', 'нет спасибо',
  'не звоните', 'занят', 'спам', 'не буду', 'некогда',
  'не надо', 'откажусь', 'не хочу',
];

function parseDuration(raw: string): number {
  if (!raw) return 0;
  const parts = raw.trim().split(':');
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  }
  return 0;
}

function extractIndustry(text: string): string {
  const match = text.match(/кейс по ([^,.]+)/i);
  if (match && match[1].trim()) return match[1].trim();
  return 'Не указана';
}

function containsAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw.toLowerCase()));
}

function classifyStage(dialogue: string, endReason: string, durationSec: number): CallStage {
  if (!dialogue || dialogue.trim() === '') return 0;

  const lines = dialogue.split('\n').filter(l => l.trim());
  const clientLines = lines.filter(l => l.toLowerCase().startsWith('client:'));
  const botLines = lines.filter(l => l.toLowerCase().startsWith('bot:'));

  if (clientLines.length === 0 && durationSec < 10) return 0;

  const fullText = dialogue.toLowerCase();

  if (containsAny(fullText, QUALIFICATION_KEYWORDS) && endReason === 'bot_hangup') return 4;

  if (containsAny(fullText, MEETING_KEYWORDS) &&
    (endReason === 'bot_hangup' || botLines.length > 3)) return 3;

  if (containsAny(fullText, OFFER_KEYWORDS) && clientLines.length > 0) return 2;

  if (botLines.length >= 1 && clientLines.length === 0) return 1;

  if (clientLines.length > 0 && containsAny(fullText, REFUSAL_KEYWORDS)) return 1;

  if (clientLines.length > 0) return 2;

  return 1;
}

function extractLastClientPhrase(dialogue: string): string {
  if (!dialogue) return '';
  const lines = dialogue.split('\n').filter(l => l.trim());
  const clientLines = lines.filter(l => l.toLowerCase().startsWith('client:'));
  if (clientLines.length === 0) return '';
  const last = clientLines[clientLines.length - 1];
  return last.replace(/^client:\s*/i, '').trim();
}

function parseCSV(raw: string): string[][] {
  const rows: string[][] = [];
  let i = 0;
  while (i < raw.length) {
    const row: string[] = [];
    while (i < raw.length && raw[i] !== '\n') {
      if (raw[i] === '"') {
        let cell = '';
        i++;
        while (i < raw.length) {
          if (raw[i] === '"' && raw[i + 1] === '"') {
            cell += '"';
            i += 2;
          } else if (raw[i] === '"') {
            i++;
            break;
          } else {
            cell += raw[i];
            i++;
          }
        }
        row.push(cell);
      } else {
        let cell = '';
        while (i < raw.length && raw[i] !== ',' && raw[i] !== '\n') {
          cell += raw[i];
          i++;
        }
        row.push(cell.trim());
      }
      if (i < raw.length && raw[i] === ',') i++;
    }
    if (i < raw.length && raw[i] === '\n') i++;
    if (row.some(c => c !== '')) rows.push(row);
  }
  return rows;
}

export function processCSV(raw: string): DashboardData {
  const rows = parseCSV(raw);
  if (rows.length < 2) throw new Error('Нет данных');

  const records: CallRecord[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 4) continue;

    const phone = row[0] || '';
    const datetimeStr = row[1] || '';
    const durationRaw = row[2] || '0:00';
    const status = row[3] || '';
    const audioUrl = row[4] || '';
    const endReason = row[5] || '';
    const dialogue = row[6] || '';

    const durationSec = parseDuration(durationRaw);
    const datetime = new Date(datetimeStr);

    const stage = classifyStage(dialogue, endReason, durationSec);
    const industry = dialogue ? extractIndustry(dialogue) : 'Не указана';
    const replicaCount = dialogue
      ? dialogue.split('\n').filter(l => l.trim()).length
      : 0;
    const lastClientPhrase = extractLastClientPhrase(dialogue);

    records.push({
      phone, datetime, durationSec, status, audioUrl,
      endReason, dialogue, stage, industry, replicaCount, lastClientPhrase,
    });
  }

  const total = records.length;
  const withDialogue = records.filter(r => r.dialogue.trim() !== '').length;
  const leads = records.filter(r => r.stage >= 3).length;
  const overallCR = total > 0 ? (leads / total) * 100 : 0;
  const avgDurationSec = records.length > 0
    ? records.reduce((s, r) => s + r.durationSec, 0) / records.length
    : 0;

  // Funnel
  const stageCounts = [0, 1, 2, 3, 4].map(s => records.filter(r => r.stage === s).length);
  const cumulativeCounts = [
    total,
    total - stageCounts[0],
    total - stageCounts[0] - stageCounts[1],
    stageCounts[3] + stageCounts[4],
    stageCounts[4],
  ];

  const funnel: FunnelData[] = STAGE_LABELS.map((label, idx) => {
    const count = cumulativeCounts[idx];
    const prev = idx === 0 ? total : cumulativeCounts[idx - 1];
    return {
      stage: idx,
      label,
      count,
      pct: total > 0 ? (count / total) * 100 : 0,
      dropPct: prev > 0 ? ((prev - count) / prev) * 100 : 0,
      color: STAGE_COLORS[idx],
    };
  });

  // Hourly
  const hourMap = new Map<number, { calls: number; converted: number }>();
  for (let h = 0; h < 24; h++) hourMap.set(h, { calls: 0, converted: 0 });
  records.forEach(r => {
    if (!isNaN(r.datetime.getTime())) {
      const h = r.datetime.getHours();
      const entry = hourMap.get(h)!;
      entry.calls++;
      if (r.stage >= 3) entry.converted++;
    }
  });
  const hourly: HourlyData[] = Array.from(hourMap.entries())
    .filter(([, v]) => v.calls > 0)
    .map(([h, v]) => ({
      hour: h,
      label: `${h}:00`,
      calls: v.calls,
      converted: v.converted,
      cr: v.calls > 0 ? (v.converted / v.calls) * 100 : 0,
    }));

  // By day of week
  const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const dayMap = new Map<string, { calls: number; converted: number }>();
  dayNames.forEach(d => dayMap.set(d, { calls: 0, converted: 0 }));
  records.forEach(r => {
    if (!isNaN(r.datetime.getTime())) {
      const d = dayNames[r.datetime.getDay()];
      const entry = dayMap.get(d)!;
      entry.calls++;
      if (r.stage >= 3) entry.converted++;
    }
  });
  const byDay: DayData[] = dayNames
    .filter(d => (dayMap.get(d)?.calls ?? 0) > 0)
    .map(d => {
      const v = dayMap.get(d)!;
      return { day: d, calls: v.calls, converted: v.converted, cr: v.calls > 0 ? (v.converted / v.calls) * 100 : 0 };
    });

  // Refusal phrases (stage 0-1, last client phrase)
  const refusalMap = new Map<string, { count: number; stage: number }>();
  records
    .filter(r => r.stage <= 1 && r.lastClientPhrase)
    .forEach(r => {
      const phrase = r.lastClientPhrase.slice(0, 60);
      const existing = refusalMap.get(phrase);
      if (existing) existing.count++;
      else refusalMap.set(phrase, { count: 1, stage: r.stage });
    });
  const refusalPhrases: RefusalPhrase[] = Array.from(refusalMap.entries())
    .map(([phrase, v]) => ({ phrase, count: v.count, stage: v.stage }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // Success phrases (stage 3+)
  const successMap = new Map<string, { count: number; stage: number }>();
  records
    .filter(r => r.stage >= 3 && r.lastClientPhrase)
    .forEach(r => {
      const phrase = r.lastClientPhrase.slice(0, 60);
      const existing = successMap.get(phrase);
      if (existing) existing.count++;
      else successMap.set(phrase, { count: 1, stage: r.stage });
    });
  const successPhrases: RefusalPhrase[] = Array.from(successMap.entries())
    .map(([phrase, v]) => ({ phrase, count: v.count, stage: v.stage }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // By industry
  const indMap = new Map<string, { calls: number; converted: number }>();
  records.forEach(r => {
    if (!r.industry || r.industry === 'Не указана') return;
    const entry = indMap.get(r.industry) ?? { calls: 0, converted: 0 };
    entry.calls++;
    if (r.stage >= 3) entry.converted++;
    indMap.set(r.industry, entry);
  });
  const byIndustry: IndustryData[] = Array.from(indMap.entries())
    .map(([industry, v]) => ({ industry, calls: v.calls, converted: v.converted, cr: v.calls > 0 ? (v.converted / v.calls) * 100 : 0 }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 10);

  // End reason breakdown
  const reasonMap = new Map<string, number>();
  records.forEach(r => {
    reasonMap.set(r.endReason, (reasonMap.get(r.endReason) ?? 0) + 1);
  });
  const reasonColors: Record<string, string> = {
    bot_hangup: '#00ff88',
    client_hangup: '#ff4444',
    timeout: '#ff8c00',
    error: '#888888',
  };
  const endReasonBreakdown = Array.from(reasonMap.entries()).map(([name, value]) => ({
    name,
    value,
    color: reasonColors[name] ?? '#555555',
  }));

  // Duration buckets
  const buckets = [
    { label: '0–5 сек', min: 0, max: 5 },
    { label: '5–15 сек', min: 5, max: 15 },
    { label: '15–30 сек', min: 15, max: 30 },
    { label: '30–60 сек', min: 30, max: 60 },
    { label: '1–2 мин', min: 60, max: 120 },
    { label: '2–5 мин', min: 120, max: 300 },
    { label: '5+ мин', min: 300, max: Infinity },
  ];
  const durationBuckets = buckets.map(b => ({
    label: b.label,
    count: records.filter(r => r.durationSec >= b.min && r.durationSec < b.max).length,
  }));

  return {
    records, total, withDialogue, leads, overallCR, avgDurationSec,
    funnel, hourly, byDay, refusalPhrases, successPhrases,
    byIndustry, endReasonBreakdown, durationBuckets,
  };
}

export async function loadData(): Promise<DashboardData> {
  const SHEET_ID = '18lZSxc5G6lhj9hoDgVZKMtrYDYzr2tJ692txym3L7oI';
  const GID = '1903196005';
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Ошибка загрузки данных: ${response.status}`);
  const text = await response.text();
  return processCSV(text);
}