/**
 * ✍️ 유저가 직접 적어 두는 인물별 요청 — 기억 고정·세계관 요청·나의 요청사항
 *
 *  · memory.pinned : 기억 목록에서 ⭐ 로 고정한 것. 기억 정리 때 지워지지 않고 대화에 먼저 반영된다.
 *  · userNotes.world : 이 인물의 세계관·배경에 더하고 싶은 설정 (예: "카페를 운영하는 단골손님 설정")
 *  · userNotes.wants : 이 인물이 나에게 이렇게 해 줬으면 하는 것 (예: "내 이야기를 먼저 물어봐 줘")
 *
 * 무료 개수는 config/balance.json 의 userNotes. 한도를 넘겨 추가할 때만 보석을 쓴다 (지워도 환불 없음).
 * 값은 대화방 기록(StoredChat)에 들어 있어서 백업·복원에 자동으로 포함된다.
 */
import { BALANCE } from "@/config/balance";

export interface UserNotes {
  /** 세계관 추가 요청 */
  world: string[];
  /** 나의 요청사항 */
  wants: string[];
}

export const EMPTY_NOTES: UserNotes = { world: [], wants: [] };

export type NoteKind = keyof UserNotes;

export const NOTE_LIMITS = {
  /** 한 줄 최대 글자 */
  maxChars: BALANCE.userNotes.maxChars,
  /** 종류별 최대 개수 (이 이상은 저장 불가) */
  maxItems: BALANCE.userNotes.maxItems,
} as const;

/** 무료로 쓸 수 있는 개수 */
export const freeCount = (kind: NoteKind): number => (kind === "world" ? BALANCE.userNotes.freeWorld : BALANCE.userNotes.freeWants);

/** 지금 개수에서 하나 더 추가할 때의 보석 값 (0 이면 무료) */
export function nextNoteCost(kind: NoteKind, currentCount: number): number {
  return currentCount < freeCount(kind) ? 0 : BALANCE.userNotes.extraCost;
}

/** 저장 형태 정리: 문자열만, 공백 정리, 길이·개수 제한, 중복 제거 */
export function cleanNotes(raw: unknown): UserNotes {
  const norm = (v: unknown): string[] => {
    if (!Array.isArray(v)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const x of v) {
      if (typeof x !== "string") continue;
      const t = x.replace(/\s+/g, " ").trim().slice(0, NOTE_LIMITS.maxChars);
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
      if (out.length >= NOTE_LIMITS.maxItems) break;
    }
    return out;
  };
  const o = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<NoteKind, unknown>>;
  return { world: norm(o.world), wants: norm(o.wants) };
}

/** 고정 기억 목록 정리 (기억 고정용: 개수만 제한) */
export function cleanPinned(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const t = x.trim().slice(0, 300);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= BALANCE.userNotes.maxPinned) break;
  }
  return out;
}
