/// <reference types="@capacitor/status-bar" />

import type { CapacitorConfig } from '@capacitor/cli';

const TOPJUG_ORIGIN = 'https://topjug.kr/';

const config: CapacitorConfig = {
  appId: 'kr.topjug.app',
  appName: '탑저그',
  webDir: 'native/ios-shell',
  loggingBehavior: 'debug',
  backgroundColor: '#ffffff',
  ios: {
    appendUserAgent: 'TopJug-iOS/0.1.0',
    allowsLinkPreview: false,
    backgroundColor: '#ffffff',
    preferredContentMode: 'mobile',
  },
  server: {
    url: TOPJUG_ORIGIN,
    cleartext: false,
    errorPath: 'error.html',
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'LIGHT',
    },
  },
};

export default config;
