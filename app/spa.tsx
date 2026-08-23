'use client';

import dynamic from 'next/dynamic';

const TopJugApp = dynamic(() => import('../src/app/App'), {
  ssr: false,
  loading: () => <main className="min-h-screen bg-white" aria-label="TopJug 불러오는 중" />,
});

export default function Spa() {
  return <TopJugApp />;
}
