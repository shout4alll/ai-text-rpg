/**
 * 밸런스 데이터 (클라이언트·서버 공용) — 실제 값은 config/balance.json 한 곳에 있다.
 * 설명서: docs/BALANCE.md · 형식 검사: config/balanceSchema.ts (빌드 시)
 */
import raw from "@/config/balance.json";
import type { Balance } from "@/config/balanceSchema";

export const BALANCE = raw as unknown as Balance;

export type SulkLevel = 1 | 2 | 3;
export type SulkLevelDef = Balance["sulk"]["levels"][number];

export function sulkLevelDef(level: number): SulkLevelDef {
  const L = BALANCE.sulk.levels;
  return L.find((l) => l.level === level) ?? L[0];
}
