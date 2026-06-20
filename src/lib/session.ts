// Утилиты для сохранения сессии
// Агрегат (статистика) — localStorage (маленький)
// Список звонков (calls) — IndexedDB (без лимита размера)

const SITE_KEY = 'sa_site';
const DATA_KEY = 'sa_data';
const IDB_NAME = 'siteactiv';
const IDB_STORE = 'calls';

export function saveSite(site: string) {
  localStorage.setItem(SITE_KEY, site);
}

export function loadSite(): string {
  return localStorage.getItem(SITE_KEY) || '';
}

// ── IndexedDB helpers ──────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req   = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req   = store.get(key);
    req.onsuccess = () => resolve((req.result ?? null) as T | null);
    req.onerror   = () => reject(req.error);
  });
}

async function idbDel(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req   = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function saveCallsData(data: object): Promise<void> {
  const d = data as Record<string, unknown>;

  // Агрегат без calls — в localStorage (маленький, синхронный)
  try {
    const aggregate = { ...d, calls: [] };
    localStorage.setItem(DATA_KEY, JSON.stringify(aggregate));
  } catch (e) {
    console.warn('localStorage aggregate save failed', e);
  }

  // Полный список calls — в IndexedDB (нет лимита)
  try {
    await idbSet('calls', d.calls ?? []);
  } catch (e) {
    console.warn('IndexedDB calls save failed', e);
  }
}

export function loadCallsDataSync(): object | null {
  const raw = localStorage.getItem(DATA_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data.total) return null;
    return data; // calls будет [] — загрузится асинхронно
  } catch {
    return null;
  }
}

export async function hydrateCallsData(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    const calls = await idbGet<unknown[]>('calls');
    if (calls && calls.length > 0) {
      data.calls = calls;
    }
  } catch (e) {
    console.warn('IndexedDB calls load failed', e);
  }
  return data;
}

// Восстанавливает полный CallsData из сырого массива звонков (IndexedDB)
// и пересохраняет агрегат в localStorage
export async function rebuildFromCalls(): Promise<Record<string, unknown> | null> {
  try {
    const calls = await idbGet<Record<string, unknown>[]>('calls');
    if (!calls || calls.length === 0) return null;

    // Считаем by_day
    const dayMap: Record<string, { count: number; totalSec: number }> = {};
    let totalSec = 0;
    const statuses: Record<string, number> = {};

    for (const c of calls) {
      const date = (c.date as string)?.slice(0, 10) ?? '';
      if (date) {
        if (!dayMap[date]) dayMap[date] = { count: 0, totalSec: 0 };
        dayMap[date].count++;
        dayMap[date].totalSec += (c.duration_sec as number) || 0;
      }
      totalSec += (c.duration_sec as number) || 0;
      const st = (c.status as string) || 'unknown';
      statuses[st] = (statuses[st] || 0) + 1;
    }

    const by_day = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, count: v.count, avg_sec: Math.round(v.totalSec / v.count) }));

    // Считаем duration_dist по бакетам
    const buckets = [
      { label: '< 30с',  min: 0,    max: 30 },
      { label: '30–60с', min: 30,   max: 60 },
      { label: '1–3м',   min: 60,   max: 180 },
      { label: '3–5м',   min: 180,  max: 300 },
      { label: '> 5м',   min: 300,  max: Infinity },
    ];
    const duration_dist = buckets.map(b => {
      const count = calls.filter(c => {
        const s = (c.duration_sec as number) || 0;
        return s >= b.min && s < b.max;
      }).length;
      return { label: b.label, count, pct: Math.round(count / calls.length * 100) };
    });

    const rebuilt: Record<string, unknown> = {
      total: calls.length,
      avg_duration_sec: calls.length ? Math.round(totalSec / calls.length) : 0,
      total_talk_sec: totalSec,
      statuses,
      by_day,
      duration_dist,
      recommendations: [],
      calls,
    };

    // Пересохраняем агрегат в localStorage
    try {
      const aggregate = { ...rebuilt, calls: [] };
      localStorage.setItem(DATA_KEY, JSON.stringify(aggregate));
    } catch { /* ignore */ }

    return rebuilt;
  } catch (e) {
    console.warn('rebuildFromCalls failed', e);
    return null;
  }
}

export async function clearSession(): Promise<void> {
  localStorage.removeItem(SITE_KEY);
  localStorage.removeItem(DATA_KEY);
  try { await idbDel('calls'); } catch { /* ignore */ }
}