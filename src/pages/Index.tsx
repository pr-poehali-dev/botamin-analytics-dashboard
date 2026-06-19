import { useState } from 'react';
import { type CallsData } from '@/lib/dataParser';
import { saveSite, saveCallsData, loadSite, loadCallsData, clearSession } from '@/lib/session';
import LoginScreen from '@/components/calls/LoginScreen';
import UploadScreen from '@/components/calls/UploadScreen';
import TranscribingScreen from '@/components/calls/TranscribingScreen';
import Dashboard from '@/components/calls/Dashboard';

type Screen = 'login' | 'upload' | 'transcribing' | 'dashboard';

function getInitialScreen(): Screen {
  const site = loadSite();
  const data = loadCallsData();
  if (site && data) return 'dashboard';
  // Если сайт есть но данных нет — показываем login (с предзаполненным полем)
  // чтобы пользователь не видел непонятный экран загрузки файла
  return 'login';
}

export default function Index() {
  const [screen, setScreen]       = useState<Screen>(getInitialScreen);
  const [site, setSite]           = useState<string>(loadSite);
  const [data, setData]           = useState<CallsData | null>(() => loadCallsData() as CallsData | null);
  const [autoStart, setAutoStart] = useState(false);

  const handleLogin = (domain: string) => {
    saveSite(domain);
    setSite(domain);
    setScreen('upload');
  };

  const handleLoad = (d: CallsData, auto?: boolean) => {
    saveCallsData(d);
    setData(d);
    setAutoStart(!!auto);
    // При авто-режиме пропускаем TranscribingScreen и идём сразу на Dashboard
    setScreen(auto ? 'dashboard' : 'transcribing');
  };

  const handleCancelUpload = () => {
    setScreen(data ? 'dashboard' : 'login');
  };

  const handleLogout = () => {
    clearSession();
    setSite('');
    setData(null);
    setScreen('login');
  };

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
        onDone={(d) => { saveCallsData(d); setData(d); setScreen('dashboard'); }}
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