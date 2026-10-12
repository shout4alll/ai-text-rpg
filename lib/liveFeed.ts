import "server-only";

/**
 * 💬 실시간 대화 모니터 (🛠 주인님 모드 전용) — 손님들과 캐릭터가 주고받은 턴을 서버 메모리에 최근 N개만 보관.
 *  · GET /api/owner/live?since=<ms> 로 그 뒤의 턴만 가져간다 (관리창이 3초마다).
 *  · 파일·DB 에 저장하지 않는다. Vercel 은 인스턴스마다 따로 쌓이고, 재배포·재시작하면 비워진다.
 *  · 손님 구분은 기기마다 만든 무작위 id(앞 4자리)와 프로필 이름만 쓴다.
 */
export interface LiveTurn {
  id: number;
  at: number;
  personaId: string;
  personaName: string;
  /** 기기 무작위 id 앞 4자리 */
  device: string;
  userName: string;
  /** 주인님(🛠) 대화인지 */
  owner: boolean;
  kind: string;
  userText: string;
  replies: string[];
  model: string;
  route: string;
  ms: number;
  /** 원래 고른 모델이 실패해 다른 모델로 넘어갔는지 + 시도 순서 */
  fellBack?: boolean;
  tried?: { model: string; ok: boolean; ms: number }[];
  /** 맥락 의존도 (lib/continuity.ts) */
  ctx?: { score: number; level: string; reason: string | null } | null;
  error?: string;
}

const MAX = 400;
const FEED: LiveTurn[] = [];
let seq = 0;
/** 이 서버 인스턴스 표시용 (여러 대가 떠 있으면 서로 다른 값) */
export const INSTANCE = Math.random().toString(36).slice(2, 6);

/* ── 공유 저장소 (선택) ─────────────────────────────────────────────────────
 *  Vercel 은 서버를 여러 대 띄워서, 메모리에만 두면 모니터가 붙은 서버의 대화만 보인다.
 *  Upstash Redis(Vercel 마켓플레이스 "Upstash for Redis" / 예전 Vercel KV)를 연결하면 모든 서버의 대화가 한곳에 모인다.
 *  env: KV_REST_API_URL + KV_REST_API_TOKEN  (또는 UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 *  패키지 없이 REST 로 호출한다. 실패해도 대화에는 영향 없음 (메모리 기록은 그대로).
 */
const KEY = "with:live";
function redis(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}
async function redisCall(cmds: (string | number)[][], timeoutMs = 1200): Promise<unknown[] | null> {
  const r = redis();
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
    console.warn(`[liveFeed] redis 실패: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}
export const liveStore = () => (redis() ? "redis" : "memory");

/** 대화 한 턴 기록 — 공유 저장소가 있으면 거기에도 (최대 1.2초 기다림) */
export async function pushLive(t: Omit<LiveTurn, "id">): Promise<void> {
  const row: LiveTurn = { ...t, id: ++seq, userText: t.userText.slice(0, 500), replies: t.replies.map((r) => r.slice(0, 500)) };
  FEED.push(row);
  if (FEED.length > MAX) FEED.splice(0, FEED.length - MAX);
  if (redis()) await redisCall([["LPUSH", KEY, JSON.stringify({ ...row, id: Number(`${row.at}${Math.floor(Math.random() * 1000)}`) })], ["LTRIM", KEY, 0, MAX - 1], ["EXPIRE", KEY, 60 * 60 * 24 * 3]]);
}

export async function liveSince(since: number): Promise<LiveTurn[]> {
  if (redis()) {
    const r = await redisCall([["LRANGE", KEY, 0, MAX - 1]], 3000);
    const list = r?.[0];
    if (Array.isArray(list)) {
      return list
        .map((x) => {
          try {
            return JSON.parse(String(x)) as LiveTurn;
          } catch {
            return null;
          }
        })
        .filter((t): t is LiveTurn => !!t && t.at > since)
        .sort((a, b) => a.at - b.at);
    }
  }
  return FEED.filter((t) => t.at > since);
}
