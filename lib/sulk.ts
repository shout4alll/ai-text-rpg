/**
 * 삐짐(등 돌림) 규칙 — 시작·단계·해제 판단 (클라이언트, 비용 0)
 *
 *  ▸ 시작: AI가 등 돌림을 고르고 호감도가 떨어졌거나, 호감도가 sulk.startDrop 이하로 크게 떨어지면.
 *          터치 연타가 심하면 터치 삐짐(sulk.touch).
 *  ▸ 단계(1~3): 떨어진 정도(levelByDrop) + 관계 단계 보너스(levelBonusByStage) + 반복 가중(escalateWindowMin 안에 또 삐지면 +1)
 *  ▸ 해제:
 *      1단계 — 하트·좋아요 같은 마음 리액션(freeHearts) 또는 다정한 말
 *      2단계 — 하트로는 안 풀림. 기분이 풀릴 말 (AI 판단 soothed 또는 호감도 +sootheDelta 이상)
 *      3단계 — 그런 말이 sootheNeeded 번 이상
 *      모든 단계 — 💎 선물(giftCost) 하면 즉시 풀리고 특별 리액션
 *      시간 — autoReleaseMin 이 지나면 저절로 풀림 (대화방을 다시 열 때 확인)
 *  수치: config/balance.json 의 sulk (docs/BALANCE.md)
 */
import { BALANCE, sulkLevelDef, type SulkLevel } from "@/config/balance";
import type { HeartReactionId } from "@/config/reactions";

export interface SulkState {
  level: SulkLevel;
  cause: "words" | "touch";
  /** 시작 시각 */
  at: number;
  /** 지금까지 받은 "기분 풀리는 말" 횟수 */
  soothe: number;
}

const clampLevel = (n: number): SulkLevel => (Math.max(1, Math.min(3, Math.round(n))) as SulkLevel);

/** 이번 답장으로 삐짐을 시작할지, 한다면 몇 단계인지 (null = 시작 안 함) */
export function sulkStartLevel(opts: {
  delta: number;
  aiTurnAway: boolean;
  stageIndex: number;
  lastReleaseAt?: number;
  now?: number;
}): SulkLevel | null {
  const S = BALANCE.sulk;
  const { delta } = opts;
  const start = (opts.aiTurnAway && delta < 0) || delta <= S.startDrop;
  if (!start) return null;
  // 떨어진 정도: 조건을 만족하는 가장 깊은 단계
  let base = 1;
  for (const r of [...S.levelByDrop].sort((a, b) => b.maxDelta - a.maxDelta)) if (delta <= r.maxDelta) base = r.level;
  const bonusList = S.levelBonusByStage;
  const bonus = bonusList[Math.min(opts.stageIndex, bonusList.length - 1)] ?? 0;
  const now = opts.now ?? Date.now();
  const repeat = opts.lastReleaseAt && now - opts.lastReleaseAt < S.escalateWindowMin * 60_000 ? 1 : 0;
  return clampLevel(base + bonus + repeat);
}

/** 터치 연타로 삐짐 */
export function touchSulk(now = Date.now()): SulkState {
  return { level: clampLevel(BALANCE.sulk.touch.level), cause: "touch", at: now, soothe: 0 };
}

/**
 * 삐져 있는 동안 받은 반응으로 풀리는지 판단.
 * @returns release: 풀렸으면 이유 / next: 갱신된 상태 (풀렸으면 null)
 */
export function checkRelease(
  s: SulkState,
  ev: { kind: string; heart?: HeartReactionId; delta: number; soothed?: boolean }
): { release?: "heart" | "words"; next: SulkState | null } {
  const def = sulkLevelDef(s.level);
  if (ev.kind === "reaction") {
    if (ev.heart && (def.freeHearts as string[]).includes(ev.heart)) return { release: "heart", next: null };
    return { next: s };
  }
  const soothing = ev.soothed === true || ev.delta >= BALANCE.sulk.sootheDelta;
  if (!soothing) return { next: s };
  const soothe = s.soothe + 1;
  if (soothe >= def.sootheNeeded) return { release: "words", next: null };
  return { next: { ...s, soothe } };
}

/** 시간이 지나 저절로 풀렸는지 */
export function sulkExpired(s: SulkState, now = Date.now()): boolean {
  const ms = s.cause === "touch" ? BALANCE.sulk.touch.autoReleaseSec * 1000 : sulkLevelDef(s.level).autoReleaseMin * 60_000;
  return ms > 0 && now - s.at >= ms;
}

export function giftCost(s: SulkState): number {
  return sulkLevelDef(s.level).giftCost;
}

/** 서버(프롬프트)에 넘길 요약 */
export function sulkSummary(s: SulkState | null) {
  if (!s) return null;
  const def = sulkLevelDef(s.level);
  return {
    level: s.level,
    label: def.label,
    cause: s.cause,
    soothe: s.soothe,
    sootheNeeded: def.sootheNeeded,
    heartsWork: def.freeHearts.length > 0,
  };
}
export type SulkSummary = NonNullable<ReturnType<typeof sulkSummary>>;
