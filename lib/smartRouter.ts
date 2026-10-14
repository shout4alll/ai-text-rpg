import "server-only";
import { generateText } from "ai";
import { resolveModel } from "@/config/ai";
import { classifierPrompt, DEFAULT_CATEGORY, EXPLICIT_PATTERNS, ROUTE_CATEGORIES, type RouteCategory } from "@/config/routing";

/**
 * 🧭 3단계 라우팅의 1·2단계 (config/routing.ts 표를 따른다)
 *  · explicitHit: 1단계 — 직설적 표현 키워드 (정규식, 비용 0)
 *  · classifyIntent: 2단계 — 초경량 모델에게 마지막 말만 주고 번호 하나를 받는다 (짧은 시간 제한, 실패하면 기본 분류)
 */
let explicitRe: RegExp[] | null = null;
export function explicitHit(text: string): boolean {
  explicitRe ??= EXPLICIT_PATTERNS.map((p) => new RegExp(p, "i"));
  return explicitRe.some((re) => re.test(text));
}

export const categoryById = (id: string): RouteCategory => ROUTE_CATEGORIES.find((c) => c.id === id) ?? ROUTE_CATEGORIES.find((c) => c.id === DEFAULT_CATEGORY)!;

/** 같은 말을 또 분류하지 않게 (서버 메모리, 짧게) */
const cache = new Map<string, { id: string; at: number }>();

export interface Classified {
  category: RouteCategory;
  /** 분류에 쓴 모델 (실패면 "default") */
  by: string;
  ms: number;
}

export async function classifyIntent(text: string, timeoutMs = 2500, prev = ""): Promise<Classified> {
  const t0 = Date.now();
  const key = text.trim().slice(0, 200);
  const ctx = prev.trim().slice(-120);
  const ck = `${ctx}|${key}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < 10 * 60_000) return { category: categoryById(hit.id), by: "cache", ms: 0 };
  try {
    const r = resolveModel("router");
    const res = await generateText({
      model: r.model,
      system: classifierPrompt(),
      prompt: `${ctx ? `직전에 상대(캐릭터)가 한 말: """${ctx}"""\n` : ""}유저의 마지막 말: """${key}"""\n(앞의 말을 받아서 하는 대답·되묻기·정정이면 일상이 아니라 다른 번호로 분류)\n번호:`,
      maxOutputTokens: 4,
      temperature: 0,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(timeoutMs),
    });
    const n = Number((res.text.match(/\d+/) ?? [""])[0]);
    const cat = ROUTE_CATEGORIES.find((c) => c.n === n) ?? categoryById(DEFAULT_CATEGORY);
    cache.set(ck, { id: cat.id, at: Date.now() });
    if (cache.size > 2000) cache.delete(cache.keys().next().value as string);
    return { category: cat, by: r.modelId, ms: Date.now() - t0 };
  } catch (err) {
    console.warn(`[smartRouter] 분류 실패 → 기본(${DEFAULT_CATEGORY}): ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`);
    return { category: categoryById(DEFAULT_CATEGORY), by: "default", ms: Date.now() - t0 };
  }
}


/* ── 🧭 대화 분석 라우터 (매 턴 · 기본 Sonnet 5.5) ─────────────────────────────
 *  최근 대화 몇 턴 + 유저의 마지막 말을 보고 이번 답장 등급 하나를 고른다.
 *    L = 하이쿠 5.5(가장 저렴) · M = 소넷 5(메인) · P = 소넷 5.5(맥락 깊음) · T = 오퍼스(고난도, 하루 한도)
 *  기본 분석 모델: Haiku 5.5 (분석 1회 ≈ 소넷 5 답장의 2%) — config/settings.ts analyzerModel
 *  💰 비용 절약: ① 뻔한 말·되묻기는 호출 전에 규칙으로 처리(route.ts) ② 대화는 최근 8턴·턴당 160자로 압축
 *    ③ 출력은 한 줄 JSON ④ 같은 장면(직전 AI 말+유저 말)은 10분 캐시 ⑤ 1.5초 안에 못 정하면 M(소넷 5)
 */
export type Grade = "L" | "M" | "P" | "T";
export interface Analyzed {
  grade: Grade;
  why: string;
  by: string;
  ms: number;
  /** 분석 호출에 쓴 토큰 (비용 표시용) */
  usage?: { in: number; out: number; cache: number };
  /** 이번 답장에 어울리는 분량 (S 짧게 · N 보통 · L 길게) — 분석 실패면 없음 */
  len?: ReplyLen;
}
export type ReplyLen = "S" | "N" | "L";
const ANALYZE_SYSTEM = `너는 메신저 대화 라우터다. 캐릭터와 유저의 최근 대화, 유저의 마지막 말을 보고 이번 답장을 쓸 모델 등급 하나를 고른다.
반드시 JSON 한 줄만 출력: {"t":"L|M|P|T","l":"S|N|L","r":"이유(12자 이내)"}
L: 앞 대화 없이도 바로 답할 수 있는 단순한 말 — 인사·작별·고마움·맞장구·웃음·짧은 리액션, 맥락과 무관한 가벼운 질문.
M: 평범한 대화 — 앞 대화를 이어받는 일상 이야기·감정 교류·가벼운 질문. 대부분의 턴.
P: 맥락이 깊게 얽힌 턴 — 여러 턴 전 내용 참조, 지시어·생략이 많아 앞뒤를 잘 읽어야 함, 유저가 되묻거나 바로잡음, 진지한 고민·민감한 감정, 미묘한 뉘앙스·관계의 전환점.
T: 고난도 — 전문 지식·분석·추론·창작이 필요한 어렵고 긴 질문, 앞 답장이 여러 번 어긋나 대화가 꼬임.
비용이 중요하다: 애매하면 M. 확실할 때만 P·T. 대화 맥락이 필요 없는 게 확실할 때만 L.
l(답장 분량): S=짧게(맞장구·리액션·가벼운 말·짧은 대답이면 충분) / N=보통(일상 대화 대부분) / L=길게(유저가 길게 털어놓음·고민·감정 상담, 설명·추천·방법을 물음, 이야기를 들려 달라고 함). 필요 없는데 길게 쓰면 대화가 흐트러진다 — 애매하면 S 나 N.`;
const gradeCache = new Map<string, { g: Grade; why: string; at: number; len?: ReplyLen }>();

export async function analyzeTurn(
  text: string,
  turns: { role: string; content: string; kind?: string }[],
  personaName: string,
  timeoutMs = 4500
): Promise<Analyzed> {
  const t0 = Date.now();
  const texts = turns.filter((t) => (t.kind ?? "text") === "text" && t.content);
  // 마지막 유저 말(이번 말)은 따로 보여 준다
  const prior = texts.length && texts[texts.length - 1].role === "user" && texts[texts.length - 1].content === text ? texts.slice(0, -1) : texts;
  const ctx = prior
    .slice(-8)
    .map((t) => `${t.role === "user" ? "유저" : personaName}: ${t.content.replace(/\s+/g, " ").slice(0, 160)}`)
    .join("\n");
  const key = `${prior.slice(-1)[0]?.content.slice(-80) ?? ""}|${text.slice(0, 200)}`;
  const hit = gradeCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return { grade: hit.g, why: hit.why, by: "cache", ms: 0, len: hit.len };
  try {
    const r = resolveModel("analyzer");
    const res = await generateText({
      model: r.model,
      system: ANALYZE_SYSTEM,
      prompt: `[최근 대화]\n${ctx || "(없음 — 첫 대화)"}\n\n[유저의 마지막 말]\n${text.slice(0, 400)}`,
      maxOutputTokens: 400, // Haiku 5.5 는 짧은 생각(effort low)을 거친 뒤 답한다
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(timeoutMs),
      ...(r.providerOptions ? { providerOptions: r.providerOptions as never } : {}),
    });
    const out = res.text ?? "";
    const g = ((/"t"\s*:\s*"([LMPT])"/.exec(out) ?? /\b([LMPT])\b/.exec(out))?.[1] ?? "M") as Grade;
    const why = (/"r"\s*:\s*"([^"]{0,40})"/.exec(out)?.[1] ?? "").trim();
    const len = /"l"\s*:\s*"([SNL])"/.exec(out)?.[1] as ReplyLen | undefined;
    gradeCache.set(key, { g, why, at: Date.now(), len });
    if (gradeCache.size > 3000) gradeCache.delete(gradeCache.keys().next().value as string);
    return { grade: g, why, len, by: r.modelId, ms: Date.now() - t0, usage: { in: res.usage?.inputTokens ?? 0, out: res.usage?.outputTokens ?? 0, cache: res.usage?.inputTokenDetails?.cacheReadTokens ?? 0 } };
  } catch (err) {
    console.warn(`[smartRouter] 분석 실패 → 규칙 결과: ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`);
    const timedOut = err instanceof Error && /timeout|abort/i.test(err.name + err.message);
    return { grade: "M", why: timedOut ? "분석 시간초과" : "분석 실패", by: "default", ms: Date.now() - t0 };
  }
}

/** 등급 → 답할 모델 순서 (실패하면 다음, 마지막은 항상 메인) */
export const GRADE_TIERS: Record<Grade, string[]> = {
  L: ["light", "bedrock:global.anthropic.claude-haiku-4-5-20251001-v1:0", "chat"], // Haiku 5.5 → Haiku 4.5 → 소넷 5
  M: ["chat"],
  P: ["plus", "chat"],
  T: ["deep", "plus", "chat"],
};
