# 📱 WitH(위드) 앱 (Android APK · iOS) — Capacitor

앱은 **화면(이 프로젝트의 Next.js 화면을 정적 파일로 만든 것)** 을 앱 안에 담고,
**AI 대화·보이스톡·사진은 서버(배포된 Next.js, Vercel 등)** 에 요청한다.
API 키는 서버에만 있고 앱에는 들어가지 않는다.

```
[앱: 화면 + 영상·사진]  ──https──▶  [서버: /api/chat · /api/voice · /api/memory · /api/media]  ──▶  Bedrock / Gemini
```

## 처음 한 번 준비 (Windows PC)

1. **Android Studio** 설치 (무료) — https://developer.android.com/studio
   - 설치 마법사에서 Android SDK 를 함께 설치.
2. 프로젝트 폴더에서 패키지 설치: `npm install`
3. `docs/env.mobile.example` 을 프로젝트 맨 위 폴더에 `.env.mobile` 이라는 이름으로 복사하고 서버 주소를 적는다.
   ```
   NEXT_PUBLIC_API_BASE=https://(배포된 서버 주소)
   ```
4. 서버(배포본)는 이번 코드(`middleware.ts` 포함)로 **다시 배포**해야 앱의 요청을 받는다.

## APK 만들기

1. 개발 서버(`npm run dev`)를 끈다. (빌드하는 동안 app/api 를 잠시 옮겨 두기 때문)
2. `npm run mobile:build` — 화면을 `out/` 에 만들고 `android/` 프로젝트에 복사.
3. `npm run android:open` — Android Studio 가 열린다.
4. 메뉴(☰) **Build › Generate App Bundles or APKs › Generate APKs** (버전에 따라 `Build APK(s)`)
   - 결과: `android/app/build/outputs/apk/debug/app-debug.apk` → 폰에 설치해서 테스트.
5. 스토어용은 **Build › Generate Signed App Bundle / APK** → AAB 로 서명해서 Play Console 에 올린다.
   - 서명 키(.jks)는 잃어버리면 앱을 업데이트할 수 없다. 회사 보관소에 백업.

화면·영상을 고친 뒤에는 2번(`npm run mobile:build`)만 다시 하고 Android Studio 에서 다시 빌드하면 된다.

## iOS (Mac 필요)

1. Mac 에 Xcode 설치, 프로젝트를 Mac 으로 가져와 `npm install`
2. 처음 한 번: `npx cap add ios`
3. `npm run mobile:build -- --ios` → `npm run ios:open` → Xcode 에서 회사 Apple 개발자 계정으로 서명 → Archive → App Store Connect 업로드

## 🔔 선톡 알림 (앱 전용)

인물이 먼저 말을 거는 알림. 자세한 동작·설정은 [`NOTIFICATIONS.md`](NOTIFICATIONS.md).
알림 플러그인(`@capacitor/local-notifications`, `@capacitor/app`)을 쓰므로 **이 기능이 들어간 뒤 처음 빌드할 때는 `npm install` 을 먼저** 한 다음 `npm run mobile:build` 를 한다
(`mobile:build` 가 `cap sync` 로 플러그인을 안드로이드 프로젝트에 등록해 준다).

## 앱 정보

| 항목 | 값 | 위치 |
| --- | --- | --- |
| 앱 ID | `kr.co.takeone.charactalk` (스토어 등록 후 변경 불가) | `capacitor.config.ts` |
| 앱 이름 | WitH | `android/app/src/main/res/values/strings.xml` |
| 버전 | versionCode 1 / 1.0 (스토어에 올릴 때마다 versionCode +1) | `android/app/build.gradle` |
| 권한 | 인터넷, 마이크(보이스톡), 알림(플러그인이 추가) | `android/app/src/main/AndroidManifest.xml` |
| 앱 아이콘 | 기본 아이콘 (교체 예정) | `android/app/src/main/res/mipmap-*` |

## 보안 (단계별)

- ✅ **1단계 (이번):** API 키는 서버에만. 서버는 앱 출처(`https://localhost`, `capacitor://localhost`)와 웹 자기 자신만 허용 (`middleware.ts`, 더 허용하려면 `APP_ORIGINS`). 백업 끔·평문 http 차단.
- ⏭ **2단계:** 정식 앱 확인 — Android **Play Integrity**, iOS **App Attest** 로 서버가 "진짜 우리 앱"인지 확인하고, 통과한 앱에만 짧게 유효한 토큰 발급. 토큰 없는 요청(브라우저·복제 앱)은 거절 → "앱에서만 동작".
  - Play Integrity 는 Play Console 에 앱을 등록(내부 테스트 트랙이면 충분)해야 정확하게 동작.
- ⏭ **3단계:** 유료 영상(premium·allure)을 비공개 저장소 + 서명 URL 로 이동, 코드 난독화(R8), 인앱 결제(Google Play 결제 / Apple IAP).
- 웹 버전을 막을지: 2단계 이후 서버에서 웹 요청을 거절하도록 설정 가능 (테스트용 웹은 남겨 두는 것을 권장).
