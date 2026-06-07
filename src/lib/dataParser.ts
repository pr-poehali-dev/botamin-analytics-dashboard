// Все типы данных, которые возвращает бэкенд
export type CallStage = 0 | 1 | 2 | 3 | 4;

export interface SampleRecord {
  phone: string;
  datetime: string;
  durationSec: number;
  endReason: string;
  dialogue: string;
  stage: CallStage;
  industry: string;
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
  records: SampleRecord[];
  total: number;
  withDialogue: number;
  leads: number;
  overallCR: number;
  avgDurationSec: number;
  stageCounts: number[];
  funnel: FunnelData[];
  hourly: HourlyData[];
  byDay: DayData[];
  refusalPhrases: RefusalPhrase[];
  successPhrases: RefusalPhrase[];
  byIndustry: IndustryData[];
  endReasonBreakdown: { name: string; value: number; color: string }[];
  durationBuckets: { label: string; count: number }[];
}

const BACKEND_URL = 'https://functions.poehali.dev/89fd1760-0a4d-4d43-8d04-954d72d384fc';

export async function loadData(
  sheetId = '18lZSxc5G6lhj9hoDgVZKMtrYDYzr2tJ692txym3L7oI',
  gid = '1903196005'
): Promise<DashboardData> {
  const url = `${BACKEND_URL}?sheet_id=${sheetId}&gid=${gid}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Ошибка сервера: ${response.status}`);
  }
  const data = await response.json() as DashboardData;
  if (!data.total) throw new Error('Сервер вернул пустые данные');
  return data;
}
