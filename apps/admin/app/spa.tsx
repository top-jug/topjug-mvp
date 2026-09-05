'use client';

import dynamic from 'next/dynamic';

const OperationsApp = dynamic(() => import('../src/OperationsApp'), {
  ssr: false,
  loading: () => <main className="min-h-screen bg-slate-50" aria-label="TopJug 운영 콘솔 불러오는 중" />,
});

export default function Spa() {
  return <OperationsApp />;
}
