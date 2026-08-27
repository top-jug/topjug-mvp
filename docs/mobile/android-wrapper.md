# Android `topjug.kr` wrapper

The Android application is a Capacitor wrapper around `https://topjug.kr`. The Next.js application and `/api/v1` API remain same-origin inside the remote Android WebView.

## Architecture and scope

- Application ID: `kr.topjug.app`
- Minimum Android SDK: 24
- Compile/target SDK: 36
- Remote application URL: `https://topjug.kr/`
- Cleartext HTTP: disabled
- Local assets: startup fallback and connection-error UI only
- Dependency manager: Gradle
- External top-level URLs: system browser

`server.url` is intentionally used for this wrapper proof of concept, although Capacitor documents it primarily for live reload and does not recommend it as a production deployment model. Before Play Store submission, decide whether to retain the remote-only approach or bundle the client. A remote-only wrapper depends on `topjug.kr` availability and may face store minimum-functionality review.

## Commands

```bash
npm run android:sync
npm run android:open
```

Open the `android/` directory in Android Studio and let Gradle sync. The generated project uses the Android Gradle wrapper and includes the Capacitor App and Status Bar plugins.

Do not add `server.allowNavigation` wildcards or cleartext exceptions. Keep the wrapper URL HTTPS and preserve the local error page for connection failures.

## Authentication and native-code gate

The existing same-origin authentication contract is unchanged:

- Access JWT stays in JavaScript memory.
- The rotating refresh JWT remains an `HttpOnly`, `Secure`, `SameSite=Strict` cookie scoped to `/api/v1/auth`.
- No refresh token is exposed to JavaScript or copied into Android storage.

The Android WebView cookie behavior must be verified on a physical device before changing this boundary. Do not add OAuth bridges, cookie/JWT extraction, Android Keystore storage, or custom WebView cookie code in this issue. Any such follow-up requires `tmin002` as a reviewer and explicit approval.

## Verification status

`npx cap add android` and `npx cap sync android` completed. OpenJDK 21.0.12.1, Gradle 8.14.3, and Android SDK 36 were used to complete a Debug APK build successfully:

```bash
cd android
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew assembleDebug
```

The generated local artifact is `android/app/build/outputs/apk/debug/app-debug.apk`. Build outputs are ignored by Git and are not committed.

Then use Android Studio or `npx cap run android` for emulator/device execution. Record Android version, device, build type, result, and redacted evidence for login, refresh, force-quit/relaunch, logout, offline launch, and external links. Never record tokens, cookies, authorization headers, passwords, or raw login identifiers.
