/**
 * 🎨 대화창 테마 (파스텔) — 색 값은 app/globals.css 의 [data-theme=...] 에 있다.
 * 순서가 고르기 화면의 순서. 첫 번째가 기본.
 */
export const THEMES = [
  { id: "blossom", label: "블러썸 핑크", swatch: ["rgb(251,238,245)", "rgb(255,214,230)", "rgb(236,119,167)"] },
  { id: "lavender", label: "라벤더", swatch: ["rgb(240,236,255)", "rgb(226,218,255)", "rgb(145,123,224)"] },
  { id: "mint", label: "민트", swatch: ["rgb(232,247,240)", "rgb(202,241,226)", "rgb(69,177,143)"] },
  { id: "sky", label: "스카이", swatch: ["rgb(233,243,252)", "rgb(210,232,253)", "rgb(90,157,227)"] },
  { id: "peach", label: "피치", swatch: ["rgb(253,240,231)", "rgb(255,222,202)", "rgb(239,130,83)"] },
  { id: "kakao", label: "카톡", swatch: ["rgb(178,199,217)", "rgb(254,229,0)", "rgb(232,201,0)"] },
  { id: "night", label: "나이트", swatch: ["rgb(28,26,35)", "rgb(124,94,196)", "rgb(196,126,214)"] },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const DEFAULT_THEME: ThemeId = "blossom";
export const THEME_KEY = "ai-rpg.theme";
/** 화면 모드: 영상 배경 / 메신저(카톡 모드) */
export const VIEW_KEY = "ai-rpg.kakaoMode";
export const isThemeId = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);
