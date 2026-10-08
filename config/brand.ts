/**
 * 🏷 서비스 이름 — 화면·알림·메타에 쓰는 이름은 여기서만 바꾼다.
 * (앱 이름은 capacitor.config.ts 의 appName 과 android/app/src/main/res/values/strings.xml 도 함께)
 */
export const BRAND = {
  /** 로고·앱 이름 (영문 표기) */
  name: "WitH",
  /** 한글 이름 */
  ko: "위드",
  /** 둘 다 보여야 할 때 */
  full: "위드 WitH",
  tagline: "마음이 닿는 대화",
  description: "정해진 인물과 메신저로 교감하는 AI 채팅",
} as const;
