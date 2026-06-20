import { useState, useEffect } from 'react';
import { type CallsData } from '@/lib/dataParser';
import {
  saveSite, saveCallsData, loadSite,
  loadCallsDataSync, hydrateCallsData, clearSession,
} from '@/lib/session';
import LoginScreen from '@/components/calls/LoginScreen';
import UploadScreen from '@/components/calls/UploadScreen';
import TranscribingScreen from '@/components/calls/TranscribingScreen';
import Dashboard from '@/components/calls/Dashboard';

type Screen = 'login' | 'upload' | 'transcribing' | 'dashboard';

function getInitialScreen(): Screen {
  const site = loadSite();
  const data = loadCallsDataSync();
  if (site && data) return 'dashboard';
  return 'login';
}

export default function Index() {
  const [screen, setScreen]       = useState<Screen>(getInitialScreen);
  const [site, setSite]           = useState<string>(loadSite);
  const [data, setData]           = useState<CallsData | null>(
    () => loadCallsDataSync() as CallsData | null
  );
  const [autoStart, setAutoStart] = useState(false);
  const [hydrated, setHydrated]   = useState(false);

  // Подгружаем calls из IndexedDB асинхронно после монтирования
  useEffect(() => {
    const syncedData = loadCallsDataSync();
    if (syncedData) {
      hydrateCallsData(syncedData as Record<string, unknown>).then(full => {
        setData(full as CallsData);
        setHydrated(true);
      });
      return;
    }

    // localStorage пуст — проверяем есть ли звонки в IndexedDB напрямую
    const site = loadSite();
    if (!site) { setHydrated(true); return; }

    hydrateCallsData({ total: 1, calls: [] } as Record<string, unknown>).then(full => {
      const calls = full.calls as unknown[];
      if (calls && calls.length > 0) {
        const reconstructed = {
          total: calls.length,
          calls,
          by_day: [],
          duration_dist: [],
        } as CallsData;
        setData(reconstructed);
        setScreen('dashboard');
      }
      setHydrated(true);
    }).catch(() => setHydrated(true));
  }, []);

  const handleLogin = async (domain: string) => {
    saveSite(domain);
    setSite(domain);

    // Сначала пробуем синхронный путь (localStorage)
    const existing = loadCallsDataSync();
    if (existing) {
      hydrateCallsData(existing as Record<string, unknown>).then(full => {
        setData(full as CallsData);
        setScreen('dashboard');
      });
      return;
    }

    // Синхронных данных нет — проверяем IndexedDB напрямую
    try {
      const stub: Record<string, unknown> = { total: 1, calls: [] };
      const full = await hydrateCallsData(stub);
      const calls = full.calls as unknown[];
      if (calls && calls.length > 0) {
        // Есть звонки в IndexedDB — восстанавливаем сессию из них
        const reconstructed = {
          total: calls.length,
          calls,
          by_day: [],
          duration_dist: [],
        } as CallsData;
        setData(reconstructed);
        setScreen('dashboard');
        return;
      }
    } catch { /* ignore */ }

    // Данных нет нигде — предлагаем загрузить файл
    setScreen('upload');
  };

  const handleLoad = async (d: CallsData, auto?: boolean) => {
    await saveCallsData(d);
    setData(d);
    setAutoStart(!!auto);
    setScreen(auto ? 'dashboard' : 'transcribing');
  };

  const handleCancelUpload = () => {
    // Если есть хоть какие-то данные — разрешаем вернуться на дашборд
    setScreen(data ? 'dashboard' : 'login');
  };

  const handleLogout = async () => {
    await clearSession();
    setSite('');
    setData(null);
    setScreen('login');
  };

  // Пока hydration не завершилась и есть сохранённый сайт — не мигаем пустым экраном
  if (!hydrated && loadSite()) {
    return null;
  }

  if (screen === 'login') {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (screen === 'upload') {
    return <UploadScreen onLoad={handleLoad} onCancel={handleCancelUpload} />;
  }

  if (screen === 'transcribing') {
    return (
      <TranscribingScreen
        data={data!}
        onDone={async (d) => { await saveCallsData(d); setData(d); setScreen('dashboard'); }}
        onSkip={() => setScreen('dashboard')}
      />
    );
  }

  return (
    <Dashboard
      data={data!}
      site={site}
      autoStart={autoStart}
      onReset={() => { setAutoStart(false); setScreen('upload'); }}
      onLogout={handleLogout}
    />
  );
}