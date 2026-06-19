// Утилиты для сохранения сессии в localStorage

const SITE_KEY = 'sa_site';
const DATA_KEY = 'sa_data';

export function saveSite(site: string) {
  localStorage.setItem(SITE_KEY, site);
}

export function loadSite(): string {
  return localStorage.getItem(SITE_KEY) || '';
}

export function saveCallsData(data: object) {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('localStorage full', e);
  }
}

export function loadCallsData(): object | null {
  const raw = localStorage.getItem(DATA_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn('parse error', e);
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SITE_KEY);
  localStorage.removeItem(DATA_KEY);
}