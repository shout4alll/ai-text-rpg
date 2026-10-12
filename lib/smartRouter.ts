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

export async function classifyIntent(text: string, timeoutMs = 2500): Promise<Classified> {
  const t0 = Date.now();
  const key = text.trim().slice(0, 200);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return { category: categoryById(hit.id), by: "cache", ms: 0 };
  try {
    const r = resolveModel("router");
    const res = await generateText({
      model: r.model,
      system: classifierPrompt(),
      prompt: `유저의 마지막 말: """${key}"""\n번호:`,
      maxOutputTokens: 4,
      temperature: 0,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(timeoutMs),
    });
    const n = Number((res.text.match(/\d+/) ?? [""])[0]);
    const cat = ROUTE_CATEGORIES.find((c) => c.n === n) ?? categoryById(DEFAULT_CATEGORY);
    cache.set(key, { id: cat.id, at: Date.now() });
    if (cache.size > 2000) cache.delete(cache.keys().next().value as string);
    return { category: cat, by: r.modelId, ms: Date.now() - t0 };
  } catch (err) {
    console.warn(`[smartRouter] 분류 실패 → 기본(${DEFAULT_CATEGORY}): ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`);
    return { category: categoryById(DEFAULT_CATEGORY), by: "default", ms: Date.now() - t0 };
  }
}
