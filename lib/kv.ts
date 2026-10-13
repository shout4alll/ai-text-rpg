import "server-only";

/**
 * 🗄 공유 저장소 (선택) — Upstash Redis REST (Vercel 마켓플레이스 "Upstash for Redis" / 예전 Vercel KV)
 *  env: KV_REST_API_URL + KV_REST_API_TOKEN (또는 UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 *  패키지 없이 REST 로 호출한다. 없거나 실패하면 null → 호출하는 쪽이 서버 메모리로 대신한다.
 */
export function kvConfig(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

/** 명령 여러 개를 한 번에 (pipeline). 결과 배열 또는 null(미설정·실패) */
export async function kvPipeline(cmds: (string | number)[][], timeoutMs = 1200): Promise<unknown[] | null> {
  const r = kvConfig();
  if (!r) return null;
  try {
    const res = await fetch(`${r.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${r.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return ((await res.json()) as { result?: unknown; error?: string }[]).map((x) => x.result);
  } catch (e) {
    console.warn(`[kv] 실패: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}
