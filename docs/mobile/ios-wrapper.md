# iOS `topjug.kr` wrapper

The iOS application is a Capacitor wrapper around `https://topjug.kr`. It is not a separately deployed mobile frontend. The Next.js application and `/api/v1` API remain same-origin inside the remote WKWebView.

## Architecture decision

- Bundle ID: `kr.topjug.app`
- App name: `탑저그`
- Minimum iOS version: 15
- Remote application URL: `https://topjug.kr/`
- Local assets: startup fallback and connection-error UI only
- Dependency manager: Swift Package Manager
- External top-level URLs: system browser
- Cleartext HTTP: disabled
- Release logging: disabled by `loggingBehavior: debug`

Capacitor documents `server.url` as a live-reload option and does not recommend it for production. This repository uses it deliberately for the wrapper proof of concept. Before App Store submission, the team must record an explicit decision to retain this approach or replace it with a bundled client. A remote-only wrapper also depends on `topjug.kr` being reachable and can face App Store minimum-functionality review risk.

## Commands

```bash
npm run ios:sync
npm run ios:open
```

Capacitor 8 requires Node.js 22 or newer, Xcode 26 or newer, and iOS 15 or newer. The generated iOS project uses Swift Package Manager, so CocoaPods is not required.

Do not add `server.allowNavigation` wildcards or cleartext exceptions. Keep the wrapper URL ending in `/`; this prevents a similarly prefixed hostname from being treated as the application origin by Capacitor URL-prefix checks.

## Authentication model

The current web authentication contract remains unchanged during the proof of concept:

- Access JWT: returned in the response and held in JavaScript module memory for 15 minutes.
- Refresh JWT: 30-day rotating `HttpOnly`, `Secure`, `SameSite=Strict` cookie scoped to `/api/v1/auth`.
- Refresh-token reuse revokes the token family.
- Password reset revokes all refresh sessions.

Because both the page and API use `topjug.kr`, the refresh cookie should remain first-party in WKWebView. This must still be verified on a physical device. Do not enable `CapacitorCookies`, override global `fetch` with `CapacitorHttp`, expose the refresh token to JavaScript, or add Keychain storage before the matrix below shows it is necessary.

Any native OAuth, cookie, JWT, Keychain, or WKWebsiteDataStore implementation requires `tmin002` as a pull-request reviewer and must not merge without that approval.

## Device verification matrix

Record the iOS version, device, build type, result, and evidence for every row. Evidence must never contain tokens, cookies, authorization headers, passwords, or raw login identifiers.

| Scenario | Simulator | Physical device | Expected result |
| --- | --- | --- | --- |
| Login | Pending | Pending | Login succeeds and protected data loads |
| Access expiry | Pending | Pending | One refresh occurs and the request retries once |
| Background then foreground | Pending | Pending | User and in-progress record state remain consistent |
| Force quit then relaunch | Pending | Pending | Session restores through the refresh cookie |
| Device reboot | N/A | Pending | Session restores through the refresh cookie |
| App update | Pending | Pending | Session remains valid after installing a newer build |
| Logout | Pending | Pending | Local access token clears and refresh session is revoked |
| Password reset | Pending | Pending | Existing sessions can no longer refresh |
| Refresh expiry | Pending | Pending | User returns to the login screen |
| Offline launch | Pending | Pending | Local connection-error screen and retry are available |
| External link | Pending | Pending | URL opens outside the TopJug WebView |

## Native authentication decision gate

After the matrix is complete:

1. If default WKWebView persistence passes, keep the existing HttpOnly-cookie boundary.
2. If only lifecycle restoration fails, investigate the persistent default `WKWebsiteDataStore` before designing token storage.
3. If OAuth later uses `ASWebAuthenticationSession`, exchange a one-time authorization code on the server and establish the app session without copying browser cookies or raw provider tokens into the WebView.
4. If a custom bridge is still required, document its threat model, storage lifetime, rotation behavior, logout behavior, and redacted device tests in a dedicated pull request reviewed by `tmin002`.

## Initial scaffold verification

The scaffold was generated with Capacitor 8.5.0 and synchronized successfully. On 2026-09-05, the wrapper was verified on macOS Tahoe 26.6.2 with Xcode 26.6 (17F113) and the iOS 26.5 Simulator runtime. A no-signing Debug build completed successfully, and the app launched on an iPhone 17 simulator with Korean text rendering correctly.

The missing Korean glyphs observed with the iOS 26.3.1 Simulator runtime were an environment-specific simulator issue. Use the iOS 26.5 or newer runtime for verification; do not add a global web-font workaround to `topjug.kr` for that simulator-only failure. Physical-device verification remains pending and additionally requires Apple ID/team signing, a trusted device, and Developer Mode.

```bash
sudo xcodebuild -license
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

These commands change machine-wide developer settings and must be run or explicitly approved by the machine owner.
