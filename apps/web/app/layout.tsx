import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '../../../src/styles/index.css';

export const metadata: Metadata = {
  title: {
    default: 'TopJug',
    template: '%s | TopJug',
  },
  description: '클라이밍 기록과 암장 정보를 한곳에서 관리하세요.',
  applicationName: 'TopJug',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', type: 'image/png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f3faf8',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
