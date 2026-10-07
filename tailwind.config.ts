import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Pretendard Variable"', "Pretendard", "-apple-system", "BlinkMacSystemFont", "system-ui", '"Apple SD Gothic Neo"', '"Noto Sans KR"', "sans-serif"],
      },
      colors: {
        // 브랜드 (로즈) — 버튼·내 말풍선·강조
        brand: { 50: "#fff1f4", 100: "#ffe1e8", 200: "#ffc8d5", 300: "#ff9fb6", 400: "#ff6d91", 500: "#f43f6e", 600: "#e1245a", 700: "#bd1749" },
        // 바탕·글자 (따뜻한 아이보리 / 잉크)
        paper: "#f7f5f2",
        ink: { DEFAULT: "#1d1b20", soft: "#4a4650", mute: "#8b8690", line: "#ebe7e2" },
        // 카톡 모드
        kakao: { bg: "#b2c7d9", yellow: "#fee500", ink: "#191919", line: "#9fb3c5" },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(29,27,32,.04), 0 4px 16px rgba(29,27,32,.06)",
        lift: "0 2px 6px rgba(29,27,32,.06), 0 18px 40px -12px rgba(29,27,32,.18)",
        glow: "0 6px 20px -6px rgba(244,63,110,.55)",
      },
      screens: {
        // 가로로 넓은 화면(태블릿 가로·데스크톱): 좌우 분할 / 그 외(폰·세로): 배경 위에 채팅
        wide: { raw: "(min-aspect-ratio: 5/4) and (min-width: 640px)" },
      },
    },
  },
  plugins: [],
};

export default config;
