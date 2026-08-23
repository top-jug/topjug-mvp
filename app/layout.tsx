import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '../src/styles/index.css';

export const metadata: Metadata = {
  title: 'TopJug',
  description: '클라이밍 기록과 암장 정보를 한곳에서 관리하세요.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
