// Утилиты для сохранения сессии в localStorage

const SITE_KEY  = 'sa_site';
const DATA_KEY  = 'sa_data';
const CALLS_KEY = 'sa_calls';

export function saveSite(site: string) {
  localStorage.setItem(SITE_KEY, site);
}

export function loadSite(): string {
  return localStorage.getItem(SITE_KEY) || '';
}

// Сохраняем данные в двух частях:
// 1. Агрегат (без calls) — небольшой, всегда влезает
// 2. Список звонков — сжимаем: убираем record_url (длинные S3-ссылки) чтобы влезло
export function saveCallsData(data: object) {
  const d = data as Record<string, unknown>;
  try {
    // Часть 1: агрегат без calls
    const aggregate = { ...d, calls: [] };
    localStorage.setItem(DATA_KEY, JSON.stringify(aggregate));
  } catch (e) {
    console.warn('localStorage aggregate save failed', e);
  }
  try {
    // Часть 2: звонки без record_url (экономим ~60% объёма)
    const calls = (d.calls as Record<string, unknown>[] || []).map(c => {
      const { record_url: _r, ...rest } = c as Record<string, unknown>;
      return rest;
    });
    localStorage.setItem(CALLS_KEY, JSON.stringify(calls));
  } catch (e) {
    // Если не влезло даже без record_url — сохраняем только первые 500
    try {
      const calls = (d.calls as Record<string, unknown>[] || []).slice(0, 500).map(c => {
        const { record_url: _r, ...rest } = c as Record<string, unknown>;
        return rest;
      });
      localStorage.setItem(CALLS_KEY, JSON.stringify(calls));
    } catch {
      console.warn('localStorage calls save failed', e);
    }
  }
}

export function loadCallsData(): object | null {
  const raw = localStorage.getItem(DATA_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    // Проверяем что данные валидные (не пустой объект)
    if (!data.total) return null;
    // Восстанавливаем calls (без record_url — транскрибация будет недоступна, но дашборд работает)
    try {
      const callsRaw = localStorage.getItem(CALLS_KEY);
      if (callsRaw) data.calls = JSON.parse(callsRaw);
    } catch { /* ignore */ }
    return data;
  } catch (e) {
    console.warn('parse error', e);
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SITE_KEY);
  localStorage.removeItem(DATA_KEY);
  localStorage.removeItem(CALLS_KEY);
}