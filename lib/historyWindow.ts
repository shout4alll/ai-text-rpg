import { BALANCE } from "@/config/balance";

/**
 * ⏳ 대화 간격에 따라 "앞 대화를 얼마나 참조할지" 정한다 (서버 전용 로직, AI 호출 없음)
 *
 *  최근 대화 창(balance.json cost.historyTurns)을 그대로 모델에게 주면, 몇 시간·며칠 전의 얘기에 끌려가
 *  지금의 인사·새 화제가 어색해진다. 그래서 가장 최근의 "대화 끊김"(턴 사이가 breakMin 분 이상)을 찾아
 *    · 끊김 없음            → 그대로 (full)
 *    · 짧게 끊김 (< goneHours) → 끊김 앞 대화는 맥락 의존도에 따라 최근 1~5턴만 (recent)
 *    · 오래 끊김 (≥ goneHours) → 끊김 앞 대화는 참조하지 않음 (none)
 *    · 유저가 어제·며칠 전 일을 떠올리는 말을 하면 → 최근 recallKeep 턴까지 다시 참조 (recall)
 *  끊김 뒤(이번 대화) 턴은 항상 전부 유지한다. 장기 기억은 별도로 "기억 목록"이 맡는다.
 *  수치·말 목록: config/balance.json cost.gap
 */
export interface WindowTurn {
  role: "user" | "assistant";
  content: string;
  kind?: string;
  at?: number;
}

export type WindowMode = "full" | "recent" | "none" | "recall";

export interface WindowResult<T> {
  turns: T[];
  mode: WindowMode;
  /** 끊김 앞에서 버린 턴 수 */
  dropped: number;
  /** 끊김 간격(ms) — 끊김이 없으면 undefined */
  gapMs?: number;
}

let recallRe: RegExp | null = null;
const recall = () => (recallRe ??= new RegExp(BALANCE.cost.gap.recallPatterns.join("|"), "i"));

const isText = (t: WindowTurn) => t.kind === undefined || t.kind === "text";

/**
 * @param turns      오래된 순서의 턴 (마지막이 이번 유저 턴)
 * @param dependency 이번 말의 맥락 의존도 0~1 (짧은 간격일 때 몇 턴을 남길지에 쓴다)
 */
export function windowByGap<T extends WindowTurn>(turns: T[], dependency = 0.5): WindowResult<T> {
  const cfg = BALANCE.cost.gap;
  if (!cfg.enabled || turns.length < 2) return { turns, mode: "full", dropped: 0 };

  // 가장 최근의 대화 끊김 찾기 (끊김 뒤 = 이번 대화)
  const breakMs = cfg.breakMin * 60_000;
  let b = -1;
  for (let i = turns.length - 1; i >= 1; i--) {
    const a = turns[i].at;
    const p = turns[i - 1].at;
    if (a && p && a - p >= breakMs) {
      b = i;
      break;
    }
  }
  if (b < 0) return { turns, mode: "full", dropped: 0 };

  const gapMs = (turns[b].at as number) - (turns[b - 1].at as number);
  const session = turns.slice(b);
  const older = turns.slice(0, b);

  // 유저가 지난 일을 떠올리는 말을 했는가 (이번 대화 안의 유저 말 기준)
  const recalled = session.some((t) => t.role === "user" && isText(t) && recall().test(t.content));
  if (recalled) {
    const keep = turns.slice(-cfg.recallKeep);
    return { turns: keep, mode: "recall", dropped: turns.length - keep.length, gapMs };
  }

  if (gapMs >= cfg.goneHours * 3_600_000) {
    return { turns: session, mode: "none", dropped: older.length, gapMs };
  }

  const n = Math.min(cfg.recentMax, Math.max(cfg.recentMin, Math.round(cfg.recentMin + (cfg.recentMax - cfg.recentMin) * dependency)));
  let from = older.length - n;
  // AI 말이 맨 앞에 오면 모델 입력에서 잘려 나가므로, 유저 말부터 시작하도록 하나 더 붙인다
  if (from > 0 && older[from].role === "assistant") from -= 1;
  const keepOlder = older.slice(Math.max(0, from));
  return { turns: [...keepOlder, ...session], mode: "recent", dropped: older.length - keepOlder.length, gapMs };
}
