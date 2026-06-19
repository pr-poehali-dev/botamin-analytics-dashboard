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
  if (site) return 'login'; // сайт есть, данных нет — вход без файла
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
    if (!syncedData) { setHydrated(true); return; }

    hydrateCallsData(syncedData as Record<string, unknown>).then(full => {
      setData(full as CallsData);
      setHydrated(true);
    });
  }, []);

  const handleLogin = (domain: string) => {
    saveSite(domain);
    setSite(domain);
    // Если данные уже есть — идём на дашборд
    const existing = loadCallsDataSync();
    if (existing) {
      hydrateCallsData(existing as Record<string, unknown>).then(full => {
        setData(full as CallsData);
        setScreen('dashboard');
      });
    } else {
      setScreen('upload');
    }
  };

  const handleLoad = async (d: CallsData, auto?: boolean) => {
    await saveCallsData(d);
    setData(d);
    setAutoStart(!!auto);
    setScreen(auto ? 'dashboard' : 'transcribing');
  };

  const handleCancelUpload = () => {
    setScreen(data ? 'dashboard' : 'login');
  };

  const handleLogout = async () => {
    await clearSession();
    setSite('');
    setData(null);
    setScreen('login');
  };

  // Пока hydration не завершилась — не показываем ничего (мгновенно)
  if (!hydrated && screen === 'dashboard') {
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
