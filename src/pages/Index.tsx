import { useState, useEffect } from 'react';
import { type CallsData } from '@/lib/dataParser';
import {
  saveSite, loadSite,
  loadCallsDataSync, hydrateCallsData, clearSession,
  loadAggregateFromIDB, rebuildFromCalls,
} from '@/lib/session';
import {
  saveReport, loadReport, listReports,
  getActiveReportId, setActiveReportId,
} from '@/lib/reports';
import LoginScreen from '@/components/calls/LoginScreen';
import UploadScreen from '@/components/calls/UploadScreen';
import TranscribingScreen from '@/components/calls/TranscribingScreen';
import Dashboard from '@/components/calls/Dashboard';

type Screen = 'login' | 'upload' | 'transcribing' | 'dashboard';

function getInitialScreen(): Screen {
  const site = loadSite();
  const data = loadCallsDataSync();
  if (site && data) return 'dashboard';
  if (site && getActiveReportId()) return 'dashboard'; // будет загружен в useEffect
  return 'login';
}

export default function Index() {
  const [screen, setScreen]         = useState<Screen>(getInitialScreen);
  const [site, setSite]             = useState<string>(loadSite);
  const [data, setData]             = useState<CallsData | null>(
    () => loadCallsDataSync() as CallsData | null
  );
  const [activeReportId, setActiveId] = useState<string>(getActiveReportId);
  const [autoStart, setAutoStart]   = useState(false);
  const [hydrated, setHydrated]     = useState(false);

  useEffect(() => {
    (async () => {
      // 1. Пробуем загрузить активный отчёт из новой системы
      const reportId = getActiveReportId();
      if (reportId) {
        const reportData = await loadReport(reportId);
        if (reportData) {
          setData(reportData);
          setScreen('dashboard');
          setHydrated(true);
          return;
        }
      }

      // 2. Fallback: старый localStorage/IDB
      const syncedData = loadCallsDataSync();
      if (syncedData) {
        const full = await hydrateCallsData(syncedData as Record<string, unknown>);
        setData(full as CallsData);
        // Мигрируем в новую систему отчётов если данные есть
        if ((full as CallsData).total > 0 && !reportId) {
          const id = await saveReport(full as CallsData);
          setActiveId(id);
        }
        setScreen('dashboard');
        setHydrated(true);
        return;
      }

      // 3. Нет localStorage — проверяем нет ли отчётов вообще
      const site = loadSite();
      if (!site) { setHydrated(true); return; }

      const agg = await loadAggregateFromIDB();
      if (agg) {
        const full = await hydrateCallsData(agg);
        const id = await saveReport(full as CallsData);
        setActiveId(id);
        setData(full as CallsData);
        setScreen('dashboard');
        setHydrated(true);
        return;
      }

      const rebuilt = await rebuildFromCalls();
      if (rebuilt) {
        const id = await saveReport(rebuilt as CallsData);
        setActiveId(id);
        setData(rebuilt as CallsData);
        setScreen('dashboard');
        setHydrated(true);
        return;
      }

      // 4. Есть отчёты но нет активного — берём последний
      const reports = await listReports();
      if (reports.length > 0) {
        const last = reports[0];
        const lastData = await loadReport(last.id);
        if (lastData) {
          setActiveReportId(last.id);
          setActiveId(last.id);
          setData(lastData);
          setScreen('dashboard');
          setHydrated(true);
          return;
        }
      }

      setHydrated(true);
    })().catch(() => setHydrated(true));
  }, []);

  const handleLogin = async (domain: string) => {
    saveSite(domain);
    setSite(domain);

    const reportId = getActiveReportId();
    if (reportId) {
      const reportData = await loadReport(reportId);
      if (reportData) {
        setData(reportData);
        setScreen('dashboard');
        return;
      }
    }

    // Проверяем есть ли вообще отчёты
    const reports = await listReports();
    if (reports.length > 0) {
      const last = reports[0];
      const lastData = await loadReport(last.id);
      if (lastData) {
        setActiveReportId(last.id);
        setActiveId(last.id);
        setData(lastData);
        setScreen('dashboard');
        return;
      }
    }

    // Старый fallback
    const existing = loadCallsDataSync();
    if (existing) {
      const full = await hydrateCallsData(existing as Record<string, unknown>);
      setData(full as CallsData);
      setScreen('dashboard');
      return;
    }

    const agg = await loadAggregateFromIDB();
    if (agg) {
      const full = await hydrateCallsData(agg);
      setData(full as CallsData);
      setScreen('dashboard');
      return;
    }

    const rebuilt = await rebuildFromCalls();
    if (rebuilt) {
      setData(rebuilt as CallsData);
      setScreen('dashboard');
      return;
    }

    setScreen('upload');
  };

  const handleLoad = async (d: CallsData, auto?: boolean) => {
    // Сохраняем как новый отчёт
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

  const handleCancelUpload = () => {
    setScreen(data ? 'dashboard' : 'login');
  };

  const handleLogout = async () => {
    await clearSession();
    setSite('');
    setData(null);
    setActiveId('');
    setScreen('login');
  };

  if (!hydrated && loadSite()) return null;

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
