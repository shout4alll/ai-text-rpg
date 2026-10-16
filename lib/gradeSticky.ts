import { BALANCE } from "@/config/balance";

/**
 * 🧲 모델 등급 유지(하향 제한) — Sonnet 이 이어 오던 대화를 갑자기 Haiku 가 받으면 말투·분량·온도·맥락이 어긋난다.
 *  그래서 직전 AI 답장이 L(Haiku)이 아니었고 대화가 이어지는 중이면, 가벼운 말("ㅋㅋ", "응", "그래서?")이라도 L 로 내리지 않고 M(Sonnet) 에 둔다.
 *  L 로 내려가도 되는 경우만: ① 인사·작별·고마움 같은 사교 한마디 ② 대화를 새로 시작할 때(마지막 AI 답장이 오래전) ③ 직전 답장도 L 이었을 때(같은 모델이 계속 받는 중)
 *  수치: config/balance.json routing.lightStickyMin
 */
export type Grade = "L" | "M" | "P" | "T";

/** 짧은 사교 한마디 — 맥락 없이도 어색하지 않다 */
const SOCIAL_RE = /^(안녕|하이\b|hi\b|hello|좋은 ?(아침|밤|꿈)|굿 ?모닝|굿 ?나잇|굿밤|잘 ?자|잘 ?있|고마워|고맙|감사|땡큐|ㄱㅅ|바이|내일 (봐|보자)|이만|다녀올게|다녀왔)/i;

export interface StickyInput {
  grade: Grade;
  text: string;
  /** 직전 AI 답장 (없으면 대화 시작) */
  lastAi?: { at?: number; grade?: Grade };
  now?: number;
}

export function stickyGrade(i: StickyInput): { grade: Grade; held: boolean } {
  if (i.grade !== "L") return { grade: i.grade, held: false };
  const min = BALANCE.routing.lightStickyMin;
  if (!min || min <= 0) return { grade: "L", held: false };
  const ai = i.lastAi;
  if (!ai) return { grade: "L", held: false }; // 대화 시작
  const now = i.now ?? Date.now();
  const fresh = !!ai.at && now - ai.at < min * 60_000; // 직전 답장이 최근 = 대화가 이어지는 중
  if (!fresh) return { grade: "L", held: false }; // 오랜만에 시작하는 대화
  if (ai.grade === "L") return { grade: "L", held: false }; // 같은 모델이 계속 받는 중
  if (SOCIAL_RE.test(i.text.trim()) && i.text.trim().length <= 14) return { grade: "L", held: false };
  return { grade: "M", held: true };
}
