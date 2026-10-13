/**
 * 💵 모델 단가 (USD / 100만 토큰) — 🛠 실시간 창의 "턴별 예상 비용"과 "소넷 5 고정 대비 %" 계산용 (추정치)
 *  2026-10-13 조사: Sonnet 5 는 Anthropic 공식 발표($2/$10), 나머지는 공개 정리 글 기준. 실제 청구는 Bedrock 요금표가 기준.
 *  ✏️ 단가가 바뀌면 여기만 고치면 된다 (위에서부터 처음 맞는 줄을 쓴다).
 */
export interface Price {
  label: string;
  in: number;
  out: number;
  cacheRead: number;
}
export const PRICES: { re: RegExp; p: Price }[] = [
  { re: /claude-haiku-5-5/, p: { label: "Haiku 5.5", in: 0.1, out: 0.5, cacheRead: 0.01 } },
  { re: /claude-haiku-4-5/, p: { label: "Haiku 4.5", in: 1, out: 5, cacheRead: 0.1 } },
  { re: /claude-sonnet-5-5/, p: { label: "Sonnet 5.5", in: 2, out: 10, cacheRead: 0.2 } },
  { re: /claude-sonnet-5/, p: { label: "Sonnet 5", in: 2, out: 10, cacheRead: 0.2 } },
  { re: /claude-opus-5-5/, p: { label: "Opus 5.5", in: 4, out: 20, cacheRead: 0.2 } },
  { re: /claude-opus-5/, p: { label: "Opus 5", in: 5, out: 25, cacheRead: 0.5 } },
  { re: /grok-4\.3/, p: { label: "Grok 4.3", in: 1.25, out: 2.5, cacheRead: 0.2 } },
  { re: /grok/, p: { label: "Grok", in: 2, out: 10, cacheRead: 0.5 } },
  { re: /llama4-maverick/, p: { label: "Llama 4 Maverick", in: 0.17, out: 0.85, cacheRead: 0.17 } },
  { re: /nova-micro/, p: { label: "Nova Micro", in: 0.035, out: 0.14, cacheRead: 0.035 } },
  { re: /nova-2-lite|nova-lite/, p: { label: "Nova 2 Lite", in: 0.3, out: 2.5, cacheRead: 0.075 } },
];
/** 비교 기준: 모든 턴을 소넷 5 로 답했다면 */
export const BASELINE: Price = { label: "Sonnet 5", in: 2, out: 10, cacheRead: 0.2 };

export const priceOf = (modelId: string): Price => PRICES.find((x) => x.re.test(modelId))?.p ?? BASELINE;

export interface Tokens {
  in: number;
  out: number;
  /** in 중 캐시에서 읽은 토큰 */
  cache: number;
}
/** 토큰 → 달러 */
export function costUsd(p: Price, t: Tokens): number {
  const cache = Math.min(t.cache, t.in);
  return ((t.in - cache) * p.in + cache * p.cacheRead + t.out * p.out) / 1_000_000;
}
