/**
 * 🎬 리액션 영상 이름 → 화면에 보일 이름.
 * 리액션 보기(ReactionShop)·목소리 맞추기(VoiceLab)가 함께 쓴다.
 * 여기 없는 이름은 밑줄을 띄어쓰기로 바꿔 그대로 보여 주므로, 새 영상을 넣어도 동작한다.
 */
export const CLIP_LABELS: Record<string, string> = {
  idle: "평소",
  talk: "말하는 중",
  smile: "미소",
  shy: "부끄러움",
  laugh: "웃음",
  love: "설렘",
  pout: "토라짐",
  sad: "속상함",
  touched: "감동",
  excited: "신남",
  surprised: "놀람",
  comfort: "토닥임",
  turn_away: "등 돌림",
  touch_joy: "터치 웃음",
  touch_shy: "터치 부끄러움",
  kiss: "손 키스",
  kiss_close: "다가오는 키스",
  blow_kiss: "손키스(가벼운)",
  flying_kiss: "날리는 키스",
  hair_tuck: "머리 넘김",
  gaze: "그윽한 눈빛",
  glance: "곁눈질",
  lip: "입술 깨물기",
  hair: "머리 넘기기",
  feel: "그윽한 느낌",
  tease: "도발",
  seduce2: "유혹 2",
  seduce3: "유혹 3",
};

/** 영상 이름(allure_·special_ 접두사 포함 가능) → 보여 줄 이름 */
export function clipLabel(name: string): string {
  const base = name.replace(/^(allure_|special_)/, "");
  return CLIP_LABELS[name] ?? CLIP_LABELS[base] ?? base.replace(/_/g, " ");
}
