import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      screens: {
        // 가로로 넓은 화면(태블릿 가로·데스크톱): 좌우 분할 / 그 외(폰·세로): 배경 위에 채팅
        wide: { raw: "(min-aspect-ratio: 5/4) and (min-width: 640px)" },
      },
    },
  },
  plugins: [],
};

export default config;
