import { useState } from 'react';
import { type CallsData } from '@/lib/dataParser';
import LoginScreen from '@/components/calls/LoginScreen';
import UploadScreen from '@/components/calls/UploadScreen';
import Dashboard from '@/components/calls/Dashboard';

type Screen = 'login' | 'upload' | 'dashboard';

export default function Index() {
  const [screen, setScreen] = useState<Screen>('login');
  const [site, setSite] = useState('');
  const [data, setData] = useState<CallsData | null>(null);

  const handleLogin = (domain: string) => {
    setSite(domain);
    setScreen('upload');
  };

  const handleLoad = (d: CallsData) => {
    setData(d);
    setScreen('dashboard');
  };

  const handleNewAnalysis = () => {
    setScreen('upload');
  };

  const handleCancelUpload = () => {
    setScreen(data ? 'dashboard' : 'login');
  };

  if (screen === 'login') {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (screen === 'upload') {
    return <UploadScreen onLoad={handleLoad} onCancel={handleCancelUpload} />;
  }

  return (
    <Dashboard
      data={data!}
      site={site}
      onReset={handleNewAnalysis}
    />
  );
}
