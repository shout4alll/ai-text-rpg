import type { CapacitorConfig } from "@capacitor/cli";

/**
 * 📱 캐릭톡 앱 (Capacitor) — docs/MOBILE_APP.md
 *  - webDir: npm run mobile:build 가 만드는 정적 화면 (out/)
 *  - appId 는 스토어에 올린 뒤에는 바꿀 수 없다. 회사 도메인 기준으로 정함.
 */
const config: CapacitorConfig = {
  appId: "kr.co.takeone.charactalk",
  appName: "캐릭톡",
  webDir: "out",
  android: {
    // 화면은 https://localhost 로 열린다 (쿠키·마이크 등 보안 기능 사용 가능)
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: "never",
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
