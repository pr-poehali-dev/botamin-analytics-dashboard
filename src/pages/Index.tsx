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
  if (site) return 'upload';
  return 'login';
}

export default function Index() {
  const [screen, setScreen] = useState<Screen>(getInitialScreen);
  const [site, setSite] = useState<string>(loadSite);
  const [data, setData] = useState<CallsData | null>(() => loadCallsData() as CallsData | null);

  const handleLogin = (domain: string) => {
    saveSite(domain);
    setSite(domain);
    setScreen('upload');
  };

  const handleLoad = (d: CallsData) => {
    saveCallsData(d);
    setData(d);
    setScreen('transcribing');
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
      onReset={() => setScreen('upload')}
      onLogout={handleLogout}
    />
  );
}
