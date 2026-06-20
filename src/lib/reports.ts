// Хранение и управление несколькими отчётами
// Каждый отчёт — отдельная запись в IndexedDB

import { type CallsData } from './dataParser';

const IDB_NAME    = 'siteactiv';
const IDB_VERSION = 2; // bump версии чтобы добавить стор reports
const STORE_CALLS = 'calls';
const STORE_REPORTS = 'reports';

export interface Report {
  id: string;           // уникальный ID (uuid)
  name: string;         // название, например "Апрель 2026"
  createdAt: string;    // ISO дата создания
  total: number;        // кол-во звонков для превью
  dateFrom: string;     // самая ранняя дата звонка
  dateTo: string;       // самая поздняя дата звонка
  aggregate: Omit<CallsData, 'calls'>; // статистика без звонков
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      // старый стор calls — оставляем
      if (!db.objectStoreNames.contains(STORE_CALLS)) {
        db.createObjectStore(STORE_CALLS);
      }
      // новый стор для мета-данных отчётов
      if (!db.objectStoreNames.contains(STORE_REPORTS)) {
        db.createObjectStore(STORE_REPORTS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbGet<T>(store: string, key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve((req.result ?? null) as T | null);
    req.onerror   = () => reject(req.error);
  });
}

async function idbSet(store: string, key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function idbDel(store: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function idbGetAll<T>(store: string): Promise<{ key: string; value: T }[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx      = db.transaction(store, 'readonly');
    const objStore = tx.objectStore(store);
    const keys: string[] = [];
    const values: T[] = [];
    const keyReq  = objStore.getAllKeys();
    const valReq  = objStore.getAll();
    keyReq.onsuccess = () => { keys.push(...(keyReq.result as string[])); };
    valReq.onsuccess = () => { values.push(...(valReq.result as T[])); };
    tx.oncomplete = () => resolve(keys.map((k, i) => ({ key: k, value: values[i] })));
    tx.onerror    = () => reject(tx.error);
  });
}

// Генерируем простой ID
function genId(): string {
  return `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// Определяем диапазон дат из массива звонков
function getDateRange(calls: CallsData['calls']): { from: string; to: string } {
  let from = '';
  let to   = '';
  for (const c of calls) {
    const d = c.date?.slice(0, 10) ?? '';
    if (!d) continue;
    if (!from || d < from) from = d;
    if (!to   || d > to)   to   = d;
  }
  return { from, to };
}

// Авто-генерируем название отчёта из диапазона дат
export function autoName(from: string, to: string): string {
  if (!from) return 'Отчёт';
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  if (fy === ty && fm === tm) return `${months[fm - 1]} ${fy}`;
  if (fy === ty) return `${months[fm - 1]}–${months[tm - 1]} ${fy}`;
  return `${months[fm - 1]} ${fy} – ${months[tm - 1]} ${ty}`;
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Сохранить новый отчёт. Возвращает его id. */
export async function saveReport(data: CallsData, name?: string): Promise<string> {
  const id = genId();
  const { from, to } = getDateRange(data.calls);
  const reportName = name || autoName(from, to);

  const meta: Report = {
    id,
    name: reportName,
    createdAt: new Date().toISOString(),
    total: data.total,
    dateFrom: from,
    dateTo: to,
    aggregate: {
      total: data.total,
      avg_duration_sec: data.avg_duration_sec,
      total_talk_sec: data.total_talk_sec,
      statuses: data.statuses,
      by_day: data.by_day,
      duration_dist: data.duration_dist,
      recommendations: data.recommendations ?? [],
    },
  };

  await idbSet(STORE_REPORTS, `meta_${id}`, meta);
  await idbSet(STORE_REPORTS, `calls_${id}`, data.calls);

  // Сохраняем активный ID
  setActiveReportId(id);
  return id;
}

/** Загрузить список всех отчётов (только мета, без звонков) */
export async function listReports(): Promise<Report[]> {
  const all = await idbGetAll<Report>(STORE_REPORTS);
  return all
    .filter(r => r.key.startsWith('meta_'))
    .map(r => r.value)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Загрузить один отчёт по id (с полным списком звонков) */
export async function loadReport(id: string): Promise<CallsData | null> {
  const meta  = await idbGet<Report>(STORE_REPORTS, `meta_${id}`);
  if (!meta) return null;

  let calls = await idbGet<CallsData['calls']>(STORE_REPORTS, `calls_${id}`);

  // Фоллбек: старые данные лежат в сторе 'calls' под ключом 'calls'
  if (!calls || calls.length === 0) {
    try {
      const db = await openDB();
      calls = await new Promise((resolve, reject) => {
        const tx  = db.transaction(STORE_CALLS, 'readonly');
        const req = tx.objectStore(STORE_CALLS).get('calls');
        req.onsuccess = () => resolve((req.result ?? []) as CallsData['calls']);
        req.onerror   = () => reject(req.error);
      });
      // Если нашли — сохраняем в правильное место чтобы в следующий раз не искать
      if (calls && calls.length > 0) {
        await idbSet(STORE_REPORTS, `calls_${id}`, calls);
      }
    } catch { /* ignore */ }
  }

  if (!calls) return null;
  return { ...meta.aggregate, calls };
}

/** Удалить отчёт */
export async function deleteReport(id: string): Promise<void> {
  await idbDel(STORE_REPORTS, `meta_${id}`);
  await idbDel(STORE_REPORTS, `calls_${id}`);
  if (getActiveReportId() === id) {
    localStorage.removeItem('sa_active_report');
  }
}

/** Переименовать отчёт */
export async function renameReport(id: string, name: string): Promise<void> {
  const meta = await idbGet<Report>(STORE_REPORTS, `meta_${id}`);
  if (!meta) return;
  await idbSet(STORE_REPORTS, `meta_${id}`, { ...meta, name });
}

/** Объединить несколько отчётов в один (не сохраняет — только возвращает данные) */
export async function mergeReports(ids: string[]): Promise<CallsData | null> {
  const results = await Promise.all(ids.map(id => loadReport(id)));
  const valid   = results.filter(Boolean) as CallsData[];
  if (!valid.length) return null;

  // Объединяем все звонки
  const allCalls = valid.flatMap(d => d.calls);

  // Пересчитываем агрегат
  const total    = allCalls.length;
  let totalSec   = 0;
  const statuses: Record<string, number>                  = {};
  const dayMap:   Record<string, { count: number; totalSec: number }> = {};

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
    { label: '< 30с',  min: 0,   max: 30 },
    { label: '30–60с', min: 30,  max: 60 },
    { label: '1–3м',   min: 60,  max: 180 },
    { label: '3–5м',   min: 180, max: 300 },
    { label: '> 5м',   min: 300, max: Infinity },
  ];
  const duration_dist = buckets.map(b => {
    const count = allCalls.filter(c => {
      const s = c.duration_sec || 0;
      return s >= b.min && s < b.max;
    }).length;
    return { label: b.label, count, pct: total ? Math.round(count / total * 100) : 0 };
  });

  return {
    total,
    avg_duration_sec: total ? Math.round(totalSec / total) : 0,
    total_talk_sec: totalSec,
    statuses,
    by_day,
    duration_dist,
    recommendations: [],
    calls: allCalls,
  };
}

/** Активный отчёт */
export function getActiveReportId(): string {
  return localStorage.getItem('sa_active_report') || '';
}
export function setActiveReportId(id: string): void {
  localStorage.setItem('sa_active_report', id);
}