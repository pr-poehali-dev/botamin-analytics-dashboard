import { useState } from 'react';
import { type CallsData } from '@/lib/dataParser';
import UploadScreen from '@/components/calls/UploadScreen';
import Dashboard from '@/components/calls/Dashboard';

export default function Index() {
  const [data, setData] = useState<CallsData | null>(null);

  if (!data) return <UploadScreen onLoad={setData} />;
  return <Dashboard data={data} onReset={() => setData(null)} />;
}
