/**
 * 👤 유저 정보 (이 기기에 저장) — 첫 입장 때 받는 성별·호칭.
 *  · 호칭(name): 인물들이 처음에 부를 이름. 대화 중 유저가 바꿔 달라고 하면 인물이 알아서 바꾼다(서버 프롬프트).
 *  · 성별(gender): 로비 쪽지 선톡(이성 인물이 먼저 인사)·말투 참고용.
 */
export type UserGender = "male" | "female";
export interface UserProfile {
  name: string;
  gender: UserGender;
  at: number;
}

const KEY = "ai-rpg.user";

export function loadUserProfile(): UserProfile | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as UserProfile | null;
    return v && typeof v.name === "string" && (v.gender === "male" || v.gender === "female") ? v : null;
  } catch {
    return null;
  }
}

export function saveUserProfile(p: { name: string; gender: UserGender }): UserProfile {
  const v = { name: p.name.trim().slice(0, 12), gender: p.gender, at: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* 저장 불가 */
  }
  return v;
}
