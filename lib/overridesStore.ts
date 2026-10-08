import "server-only";
import type { PersonaOverride, RulesOverride } from "@/lib/ownerOverrides";

/**
 * 🗄 서비스 전체에 적용되는 편집값 저장소 — CMS 연결 자리 (지금은 비어 있어 아무 영향 없음)
 * ─────────────────────────────────────────────────────────────────────────────
 *  CMS 를 만들면: DB 에서 읽은 값을 setPersistedOverrides() 로 넣는다. (서버 시작 시 + 저장할 때마다)
 *    setPersistedOverrides({ personas: { character_a: { speech: "…" } }, rules: { safety: ["…"] } })
 *  채팅 서버는 요청마다 이 값을 인물 파일 위에 먼저 얹고, 주인님 모드의 🛠 테스트 값을 그 위에 얹는다.
 *  (파일 기본값 < CMS 저장값 < 🛠 테스트값) — 일반 유저는 CMS 저장값까지만 적용된다.
 */
let personas: Record<string, PersonaOverride> = {};
let rules: RulesOverride | undefined;

export function setPersistedOverrides(o: { personas?: Record<string, PersonaOverride>; rules?: RulesOverride }) {
  personas = o.personas ?? {};
  rules = o.rules;
}
export const persistedPersona = (id: string): PersonaOverride | undefined => personas[id];
export const persistedRules = (): RulesOverride | undefined => rules;
