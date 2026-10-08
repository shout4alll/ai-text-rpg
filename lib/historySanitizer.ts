import { SPICY } from "@/config/spicy";

/**
 * 🧼 성인 대화 구간 정화 + 연속 라우팅 (서버 전용 로직, AI 호출 없음)
 *  설정·설명: config/spicy.ts
 */
export interface SanitizableTurn {
  role: "user" | "assistant";
  kind: string;
  content: string;
  target?: string;
  /** 앱이 붙이는 표시: 매혹 모드 중에 오간 말 */
  mature?: boolean;
}

/**
 * 메인 모델에게 보낼 대화: 매혹 모드 구간을 빼고, 그 구간이 있었다는 사실만 note 로 돌려준다.
 * 화면·저장소의 원문은 건드리지 않는다 (이 함수는 서버가 받은 사본만 다룬다).
 */
export function sanitizeHistory<T extends SanitizableTurn>(turns: T[]): { turns: T[]; removed: number; note: string | null } {
  const matureTexts = turns.filter((t) => t.mature && t.content).map((t) => t.content.slice(0, 80));
  const isMatureReaction = (t: T) => t.kind === "reaction" && !!t.target && matureTexts.some((m) => m.startsWith(t.target!.slice(0, 80)) || t.target!.startsWith(m));
  let removed = 0;
  const kept = turns.filter((t) => {
    if (t.mature || isMatureReaction(t)) {
      if (t.mature) removed++;
      return false;
    }
    return true;
  });
  return { turns: kept, removed, note: removed > 0 ? SPICY.sanitizedNote.replace("{n}", String(removed)) : null };
}

/**
 * 연속 라우팅: 매혹 모드를 끈 직후라도 최근에 성인 대화가 있었고, 지금 말이 그 일을 되묻는 회상이면
 * 아직 성인 전용 모델로 답한다. 일상 화제로 넘어갔으면(밥·일정 등) 바로 메인 모델로.
 */
export function stickyMature(turns: SanitizableTurn[], lastText: string): boolean {
  const t = lastText.trim();
  if (!t) return false;
  if (SPICY.topicChangeWords.some((w) => t.includes(w))) return false;
  if (!SPICY.recallWords.some((w) => t.includes(w))) return false;
  // 마지막 성인 대화 뒤로 유저가 몇 번 말했는지
  let userSince = 0;
  for (let i = turns.length - 2; i >= 0; i--) {
    const x = turns[i];
    if (x.mature) return userSince <= SPICY.stickyUserTurns;
    if (x.role === "user" && x.kind === "text") userSince++;
    if (userSince > SPICY.stickyUserTurns) return false;
  }
  return false;
}
