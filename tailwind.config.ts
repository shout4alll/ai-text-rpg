import type { Config } from "tailwindcss";

/** 테마 변수 → Tailwind 색 (투명도 /50 등도 동작) */
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Pretendard Variable"', "Pretendard", "-apple-system", "BlinkMacSystemFont", "system-ui", '"Apple SD Gothic Neo"', '"Noto Sans KR"', "sans-serif"],
      },
      colors: {
        // 🎨 모든 색은 테마 변수(app/globals.css)에서 온다 → 테마를 바꾸면 전체가 바뀐다
        brand: { 50: v("--b50"), 100: v("--b100"), 200: v("--b200"), 300: v("--b300"), 400: v("--b400"), 500: v("--b500"), 600: v("--b600"), 700: v("--b700") },
        onbrand: v("--onbrand"),
        paper: v("--paper"),
        surface: v("--surface"),
        ink: { DEFAULT: v("--ink"), soft: v("--ink-soft"), mute: v("--ink-mute"), line: v("--line") },
        me: { DEFAULT: v("--me"), ink: v("--me-ink") },
        ai: { DEFAULT: v("--ai"), ink: v("--ai-ink") },
        chat: { DEFAULT: v("--chat"), meta: v("--chat-meta"), name: v("--chat-name") },
        kakao: { bg: "#b2c7d9", yellow: "#fee500", ink: "#191919", line: "#9fb3c5" },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(29,27,32,.04), 0 4px 16px rgba(29,27,32,.06)",
        lift: "0 2px 6px rgba(29,27,32,.06), 0 18px 40px -12px rgba(29,27,32,.18)",
        glow: "0 6px 20px -6px rgb(var(--b500) / .55)",
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
