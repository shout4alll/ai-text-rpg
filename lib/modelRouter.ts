import "server-only";
/**
 * 💰 하이브리드 모델 라우팅 + 뻔한 대화 답장 풀 (서버 전용, 추가 AI 호출 없음)
 *
 *  ▸ 라우팅: 이번 턴을 메인 모델(예: Claude Sonnet 5)로 보낼지, 가벼운 모델(예: Claude Haiku 4.5 / Nova)로 보낼지
 *    규칙으로 정한다. 감정·고민·질문·긴 말·사진·선물·삐짐은 메인, 인사·맞장구·짧은 말·마음 리액션은 가벼운 모델.
 *  ▸ 답장 풀: "안녕", "잘 자", "고마워" 같은 맥락이 거의 필요 없는 말은 예전에 만든 답장을 재사용한다.
 *    같은 인물·같은 관계 단계·같은 종류의 답장이 minVariants 개 이상 모이면 useChance 확률로 AI 호출 없이 응답.
 *    (서버 메모리에 보관 — 서버가 다시 시작되면 비고, 다시 모인다)
 *  수치·단어 목록: config/balance.json 의 routing · replyPool (docs/BALANCE.md §7-4)
 */
import { BALANCE } from "@/config/balance";

export type Tier = "chat" | "light";

export interface RouteInput {
  kind: string;
  text: string;
  /** 지금까지 유저가 보낸 메시지 수 (이번 것 포함) */
  userTurns: number;
  sulking: boolean;
  allure: boolean;
}

/** 가벼운 턴이 연속된 횟수 (인물별) — mainEveryLight 마다 한 번은 메인으로 */
const lightStreak = new Map<string, number>();

let compiled: RegExp[] | null = null;
const lightRegexes = () => (compiled ??= BALANCE.routing.lightPatterns.map((p) => new RegExp(p, "i")));

export function routeTier(input: RouteInput, key: string): { tier: Tier; reason: string } {
  const R = BALANCE.routing;
  if (!R.enabled || process.env.AI_ROUTING?.trim() === "off") return { tier: "chat", reason: "routing-off" };
  const pick = (tier: Tier, reason: string) => {
    if (tier === "light") lightStreak.set(key, (lightStreak.get(key) ?? 0) + 1);
    else lightStreak.set(key, 0);
    return { tier, reason };
  };

  if (R.mainKinds.includes(input.kind)) return pick("chat", `kind:${input.kind}`);
  if (input.sulking && R.mainWhenSulking) return pick("chat", "sulking");
  if (input.allure && R.mainWhenAllure) return pick("chat", "allure");
  if (R.lightKinds.includes(input.kind)) return pick("light", `kind:${input.kind}`);
  if (input.userTurns <= R.firstTurnsMain) return pick("chat", "first-turns");
  if (R.mainEveryLight > 0 && (lightStreak.get(key) ?? 0) >= R.mainEveryLight) return pick("chat", "refresh");

  const t = input.text.trim();
  if (R.mainKeywords.some((k) => t.includes(k))) return pick("chat", "keyword");
  if (t.length <= R.lightMaxChars && lightRegexes().some((re) => re.test(t))) return pick("light", "small-talk");
  return pick("chat", "default");
}

/* ── 뻔한 대화 답장 풀 ─────────────────────────────────────────────────── */
export interface PooledReply {
  messages: string[];
  reaction: string;
  affectionDelta: number;
  at: number;
}

const pool = new Map<string, PooledReply[]>();

/** 맥락 없이 답해도 되는 짧은 말인지 → 종류 (아니면 null) */
export function poolCategory(kind: string, text: string): string | null {
  const P = BALANCE.replyPool;
  if (!P.enabled || kind !== "text") return null;
  const t = text.trim().toLowerCase();
  if (t.length > 20 || /[?？]/.test(t)) return null;
  for (const [cat, words] of Object.entries(P.categories)) {
    if (words.some((w) => t.startsWith(w.toLowerCase()) || t === w.toLowerCase())) return cat;
  }
  return null;
}

export function poolKey(personaId: string, stage: number, category: string, allure: boolean) {
  return `${personaId}|${stage}|${category}|${allure ? "a" : "n"}`;
}

/** 쓸 수 있는 답장이 충분하면 하나를 꺼낸다 (확률) */
export function takeFromPool(key: string, avoid?: string): PooledReply | null {
  const P = BALANCE.replyPool;
  const now = Date.now();
  const list = (pool.get(key) ?? []).filter((r) => now - r.at < P.ttlMin * 60_000);
  pool.set(key, list);
  if (list.length < P.minVariants || Math.random() >= P.useChance) return null;
  const choices = list.filter((r) => r.messages[0] !== avoid);
  const from = choices.length ? choices : list;
  return from[Math.floor(Math.random() * from.length)];
}

export function addToPool(key: string, r: Omit<PooledReply, "at">) {
  const P = BALANCE.replyPool;
  if (r.messages.length === 0) return;
  const list = pool.get(key) ?? [];
  if (list.some((x) => x.messages.join("|") === r.messages.join("|"))) return;
  list.push({ ...r, affectionDelta: Math.max(-1, Math.min(1, r.affectionDelta)), at: Date.now() });
  while (list.length > P.maxVariants) list.shift();
  pool.set(key, list);
}
