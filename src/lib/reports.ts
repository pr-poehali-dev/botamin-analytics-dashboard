// Хранение и управление несколькими отчётами
// Данные хранятся на сервере (PostgreSQL) — доступны с любого устройства и домена
// IndexedDB используется как кэш для быстрого старта

import { type CallsData } from './dataParser';

const API_URL = 'https://functions.poehali.dev/6dbf1220-e56e-47c8-a3ec-0660d68b062a';

// Ключ сайта для изоляции отчётов между аккаунтами
function getSite(): string {
  return localStorage.getItem('sa_site') || 'default';
}

export interface Report {
  id: string;
  name: string;
  createdAt: string;
  total: number;
  dateFrom: string;
  dateTo: string;
  aggregate?: Omit<CallsData, 'calls'>;
}

// ── Активный отчёт (localStorage) ──────────────────────────────────────────

export function getActiveReportId(): string {
  return localStorage.getItem('sa_active_report') || '';
}

export function setActiveReportId(id: string): void {
  localStorage.setItem('sa_active_report', id);
}

// ── Авто-имя отчёта ─────────────────────────────────────────────────────────

export function autoName(from: string, to: string): string {
  if (!from) return 'Отчёт';
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const parseDate = (d: string) => {
    // dd.mm.yyyy или yyyy-mm-dd
    if (d.includes('.')) {
      const [dd, mm, yyyy] = d.split('.');
      return { y: parseInt(yyyy), m: parseInt(mm) };
    }
    const [y, m] = d.split('-').map(Number);
    return { y, m };
  };
  const f = parseDate(from);
  const t = parseDate(to);
  if (f.y === t.y && f.m === t.m) return `${months[f.m - 1]} ${f.y}`;
  if (f.y === t.y) return `${months[f.m - 1]}–${months[t.m - 1]} ${f.y}`;
  return `${months[f.m - 1]} ${f.y} – ${months[t.m - 1]} ${t.y}`;
}

function getDateRange(calls: CallsData['calls']): { from: string; to: string } {
  let from = '';
  let to = '';
  for (const c of calls) {
    const d = c.date?.slice(0, 10) ?? '';
    if (!d) continue;
    if (!from || d < from) from = d;
    if (!to || d > to) to = d;
  }
  return { from, to };
}

function genId(): string {
  return `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Локальный кэш в IndexedDB ────────────────────────────────────────────────

const IDB_NAME = 'siteactiv';
const IDB_VERSION = 3;
const STORE_CACHE = 'reports_cache';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('calls')) db.createObjectStore('calls');
      if (!db.objectStoreNames.contains('reports')) db.createObjectStore('reports');
      if (!db.objectStoreNames.contains(STORE_CACHE)) db.createObjectStore(STORE_CACHE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function cacheSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CACHE, 'readwrite');
      const req = tx.objectStore(STORE_CACHE).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch { /* ignore cache errors */ }
}

async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE_CACHE, 'readonly');
      const req = tx.objectStore(STORE_CACHE).get(key);
      req.onsuccess = () => resolve((req.result ?? null) as T | null);
      req.onerror = () => reject(req.error);
    });
  } catch { return null; }
}

// Читаем звонки из старого стора (миграция)
async function legacyGetCalls(): Promise<CallsData['calls'] | null> {
  try {
    const db = await openDB();
    // Пробуем новый стор reports
    const keys = await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction('reports', 'readonly');
      const req = tx.objectStore('reports').getAllKeys();
      req.onsuccess = () => resolve(req.result as string[]);
      req.onerror = () => reject(req.error);
    });
    const callsKey = keys.find(k => String(k).startsWith('calls_'));
    if (callsKey) {
      const calls = await new Promise<CallsData['calls'] | null>((resolve, reject) => {
        const tx = db.transaction('reports', 'readonly');
        const req = tx.objectStore('reports').get(callsKey);
        req.onsuccess = () => resolve((req.result ?? null) as CallsData['calls'] | null);
        req.onerror = () => reject(req.error);
      });
      if (calls && calls.length > 0) return calls;
    }
    // Пробуем старый стор calls
    const calls = await new Promise<CallsData['calls'] | null>((resolve, reject) => {
      const tx = db.transaction('calls', 'readonly');
      const req = tx.objectStore('calls').get('calls');
      req.onsuccess = () => resolve((req.result ?? null) as CallsData['calls'] | null);
      req.onerror = () => reject(req.error);
    });
    return calls;
  } catch { return null; }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Сохранить новый отчёт. Возвращает его id. */
export async function saveReport(data: CallsData, name?: string): Promise<string> {
  const id = genId();
  const { from, to } = getDateRange(data.calls);
  const reportName = name || autoName(from, to);

  const aggregate = {
    total: data.total,
    avg_duration_sec: data.avg_duration_sec,
    total_talk_sec: data.total_talk_sec,
    statuses: data.statuses,
    by_day: data.by_day,
    duration_dist: data.duration_dist,
    recommendations: data.recommendations ?? [],
  };

  const payload = {
    id,
    name: reportName,
    total: data.total,
    dateFrom: from,
    dateTo: to,
    aggregate,
    calls: data.calls,
  };

  // Сохраняем на сервер
  try {
    await fetch(`${API_URL}?action=save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Site': getSite() },
      body: JSON.stringify(payload),
    });
  } catch { /* если нет сети — только кэш */ }

  // Кэшируем локально
  await cacheSet(`data_${id}`, { ...aggregate, calls: data.calls });
  await cacheSet('reports_list', null); // инвалидируем список

  setActiveReportId(id);
  return id;
}

/** Загрузить список всех отчётов */
export async function listReports(): Promise<Report[]> {
  try {
    const res = await fetch(`${API_URL}?action=list`, {
      headers: { 'X-Site': getSite() },
    });
    const json = await res.json();
    return json.reports || [];
  } catch {
    return [];
  }
}

/** Загрузить один отчёт (с полным списком звонков) */
export async function loadReport(id: string): Promise<CallsData | null> {
  // 1. Пробуем локальный кэш
  const cached = await cacheGet<CallsData>(`data_${id}`);
  if (cached && cached.calls && cached.calls.length > 0) {
    return cached;
  }

  // 2. Загружаем с сервера
  try {
    const res = await fetch(`${API_URL}?action=load&id=${encodeURIComponent(id)}`, {
      headers: { 'X-Site': getSite() },
    });
    if (res.ok) {
      const json = await res.json();
      const data = json.data as CallsData;
      if (data) {
        // Кэшируем
        await cacheSet(`data_${id}`, data);
        return data;
      }
    }
  } catch { /* fall through */ }

  // 3. Фоллбек: старые данные из IndexedDB (миграция)
  const legacyCalls = await legacyGetCalls();
  if (legacyCalls && legacyCalls.length > 0) {
    // Синхронизируем старые данные на сервер
    const syncedData: CallsData = {
      total: legacyCalls.length,
      avg_duration_sec: 0,
      total_talk_sec: 0,
      statuses: {},
      by_day: [],
      duration_dist: [],
      recommendations: [],
      calls: legacyCalls,
    };
    await cacheSet(`data_${id}`, syncedData);
    // Пробуем залить на сервер в фоне
    fetch(`${API_URL}?action=save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Site': getSite() },
      body: JSON.stringify({ id, name: 'Отчёт', total: legacyCalls.length, dateFrom: '', dateTo: '', aggregate: {}, calls: legacyCalls }),
    }).catch(() => {});
    return syncedData;
  }

  return null;
}

/** Удалить отчёт */
export async function deleteReport(id: string): Promise<void> {
  try {
    await fetch(`${API_URL}?action=delete&id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'X-Site': getSite() },
    });
  } catch { /* ignore */ }
  await cacheSet(`data_${id}`, null);
  if (getActiveReportId() === id) {
    localStorage.removeItem('sa_active_report');
  }
}

/** Переименовать отчёт */
export async function renameReport(id: string, name: string): Promise<void> {
  try {
    await fetch(`${API_URL}?action=rename&id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Site': getSite() },
      body: JSON.stringify({ name }),
    });
  } catch { /* ignore */ }
}

/** Объединить несколько отчётов */
export async function mergeReports(ids: string[]): Promise<CallsData | null> {
  const results = await Promise.all(ids.map(id => loadReport(id)));
  const valid = results.filter(Boolean) as CallsData[];
  if (!valid.length) return null;

  const allCalls = valid.flatMap(d => d.calls);
  const total = allCalls.length;
  let totalSec = 0;
  const statuses: Record<string, number> = {};
  const dayMap: Record<string, { count: number; totalSec: number }> = {};

  for (const c of allCalls) {
    totalSec += c.duration_sec || 0;
    const st = c.status || 'unknown';
    statuses[st] = (statuses[st] || 0) + 1;
    const d = c.date?.slice(0, 10) ?? '';
    if (d) {
      if (!dayMap[d]) dayMap[d] = { count: 0, totalSec: 0 };
      dayMap[d].count++;
      dayMap[d].totalSec += c.duration_sec || 0;
    }
  }

  const by_day = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, count: v.count, avg_sec: Math.round(v.totalSec / v.count) }));

  const buckets = [
    { label: '< 30с', min: 0, max: 30 },
    { label: '30–60с', min: 30, max: 60 },
    { label: '1–3м', min: 60, max: 180 },
    { label: '3–5м', min: 180, max: 300 },
    { label: '> 5м', min: 300, max: Infinity },
  ];
  const duration_dist = buckets.map(b => {
    const count = allCalls.filter(c => { const s = c.duration_sec || 0; return s >= b.min && s < b.max; }).length;
    return { label: b.label, count, pct: total ? Math.round(count / total * 100) : 0 };
  });

  return { total, avg_duration_sec: total ? Math.round(totalSec / total) : 0, total_talk_sec: totalSec, statuses, by_day, duration_dist, recommendations: [], calls: allCalls };
}
