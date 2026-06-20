import { useState, useEffect } from 'react';
import { type CallsData } from '@/lib/dataParser';
import {
  saveSite, saveCallsData, loadSite,
  loadCallsDataSync, hydrateCallsData, clearSession, rebuildFromCalls,
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

    // localStorage пуст — пробуем восстановить из IndexedDB напрямую
    const site = loadSite();
    if (!site) { setHydrated(true); return; }

    rebuildFromCalls().then(rebuilt => {
      if (rebuilt) {
        setData(rebuilt as CallsData);
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

    // Синхронных данных нет — пробуем восстановить из IndexedDB
    try {
      const rebuilt = await rebuildFromCalls();
      if (rebuilt) {
        setData(rebuilt as CallsData);
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
    return (
      <UploadScreen
        onLoad={handleLoad}
        onCancel={handleCancelUpload}
        onRestoreExisting={(d) => { setData(d); setScreen('dashboard'); }}
      />
    );
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