import { useState, useEffect } from 'react';
import { type CallsData } from '@/lib/dataParser';
import { saveSite, loadSite, clearSession } from '@/lib/session';
import {
  saveReport, loadReport, listReports,
  getActiveReportId, setActiveReportId,
} from '@/lib/reports';
import LoginScreen from '@/components/calls/LoginScreen';
import UploadScreen from '@/components/calls/UploadScreen';
import TranscribingScreen from '@/components/calls/TranscribingScreen';
import Dashboard from '@/components/calls/Dashboard';

type Screen = 'login' | 'upload' | 'transcribing' | 'dashboard';

export default function Index() {
  const [screen, setScreen]   = useState<Screen>('login');
  const [site, setSite]       = useState<string>('');
  const [data, setData]       = useState<CallsData | null>(null);
  const [activeReportId, setActiveId] = useState<string>('');
  const [autoStart, setAutoStart]     = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bootstrap();
  }, []);

  async function bootstrap() {
    setLoading(true);
    try {
      const savedSite = loadSite();
      if (savedSite) setSite(savedSite);

      // Нет сайта — идём на логин
      if (!savedSite) {
        setScreen('login');
        setLoading(false);
        return;
      }

      // Есть активный отчёт — грузим его
      const activeId = getActiveReportId();
      if (activeId) {
        const reportData = await loadReport(activeId);
        if (reportData && reportData.calls?.length > 0) {
          setData(reportData);
          setActiveId(activeId);
          setScreen('dashboard');
          setLoading(false);
          return;
        }
        // Отчёт не найден или пустой — сбрасываем
        localStorage.removeItem('sa_active_report');
      }

      // Ищем любой отчёт на сервере
      const reports = await listReports();
      if (reports.length > 0) {
        const last = reports[0];
        const lastData = await loadReport(last.id);
        if (lastData && lastData.calls?.length > 0) {
          setActiveReportId(last.id);
          setActiveId(last.id);
          setData(lastData);
          setScreen('dashboard');
          setLoading(false);
          return;
        }
      }

      // Ничего не нашли — предлагаем загрузить файл
      setScreen('upload');
    } catch {
      setScreen('login');
    } finally {
      setLoading(false);
    }
  }

  const handleLogin = async (domain: string) => {
    saveSite(domain);
    setSite(domain);
    // После логина запускаем bootstrap заново
    await bootstrap();
  };

  const handleLoad = async (d: CallsData, auto?: boolean) => {
    const id = await saveReport(d);
    setActiveId(id);
    setData(d);
    setAutoStart(!!auto);
    setScreen(auto ? 'dashboard' : 'transcribing');
  };

  const handleSwitchReport = (d: CallsData, id: string) => {
    setData(d);
    if (id !== '__merged__') setActiveId(id);
  };

  const handleLogout = async () => {
    await clearSession();
    setSite('');
    setData(null);
    setActiveId('');
    setScreen('login');
  };

  // Загрузка
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ background: 'var(--brand-green)', animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  );

  if (screen === 'login') {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (screen === 'upload') {
    return (
      <UploadScreen
        onLoad={handleLoad}
        onCancel={() => setScreen(data ? 'dashboard' : 'login')}
        onRestoreExisting={(d) => { setData(d); setScreen('dashboard'); }}
      />
    );
  }

  if (screen === 'transcribing') {
    return (
      <TranscribingScreen
        data={data!}
        onDone={async (d) => {
          const id = await saveReport(d);
          setActiveId(id);
          setData(d);
          setScreen('dashboard');
        }}
        onSkip={() => setScreen('dashboard')}
      />
    );
  }

  return (
    <Dashboard
      data={data!}
      site={site}
      autoStart={autoStart}
      activeReportId={activeReportId}
      onSwitchReport={handleSwitchReport}
      onReset={() => { setAutoStart(false); setScreen('upload'); }}
      onLogout={handleLogout}
    />
  );
}
