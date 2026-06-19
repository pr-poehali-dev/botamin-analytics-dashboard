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

export async function clearSession(): Promise<void> {
  localStorage.removeItem(SITE_KEY);
  localStorage.removeItem(DATA_KEY);
  try { await idbDel('calls'); } catch { /* ignore */ }
}
