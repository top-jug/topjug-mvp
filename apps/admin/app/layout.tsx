import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '../../../src/styles/index.css';

export const metadata: Metadata = {
  title: {
    default: 'TopJug 운영 콘솔',
    template: '%s | TopJug 운영 콘솔',
  },
  description: 'TopJug 암장 정보와 운영 일정을 관리합니다.',
  applicationName: 'TopJug Operations',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f8fafc',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
