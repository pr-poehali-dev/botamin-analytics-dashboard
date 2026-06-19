// Типы данных для анализа звонков СайтАктив (CoMagic / Bitrix24)

export interface CallRecord {
  date: string;
  duration: string;
  duration_sec: number;
  call_type: string;
  record_url: string;
  status: string;
  comm_id: string;
}

export interface DayData {
  date: string;
  count: number;
  avg_sec: number;
}

export interface DurationBucket {
  label: string;
  count: number;
  pct: number;
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  desc: string;
  action: string;
}

export interface CallsData {
  total: number;
  avg_duration_sec: number;
  total_talk_sec: number;
  statuses: Record<string, number>;
  by_day: DayData[];
  duration_dist: DurationBucket[];
  recommendations: Recommendation[];
  calls: CallRecord[];
}

const PARSER_URL = 'https://functions.poehali.dev/ebde1cfa-0acf-4174-8af2-68fce35fda2d';

export async function loadFromUrl(xlsxUrl: string): Promise<CallsData> {
  const url = `${PARSER_URL}?url=${encodeURIComponent(xlsxUrl)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
  const data = await res.json() as CallsData;
  if (!data.total) throw new Error('Сервер вернул пустые данные');
  return data;
}

export async function loadFromFile(file: File): Promise<CallsData> {
  const buffer = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const res = await fetch(PARSER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_base64: base64 }),
  });
  if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
  const data = await res.json() as CallsData;
  if (!data.total) throw new Error('Файл не содержит данных о звонках');
  return data;
}

export function formatSec(sec: number): string {
  if (sec < 60) return `${sec}с`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s > 0 ? `${m}м ${s}с` : `${m}м`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}ч ${rm}м`;
}

export function formatTotalHours(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}ч ${m}м`;
}
