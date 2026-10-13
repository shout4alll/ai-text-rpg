import "server-only";
import { kvPipeline } from "@/lib/kv";
import { BALANCE } from "@/config/balance";

/**
 * 🧠 최상위 모델(Opus) 하루 사용 한도 — 손님 1명(기기)당 하루 N번 (balance.json routing.opusDailyLimit)
 *  넘으면 그날은 Sonnet 5.5 → Sonnet 5 로 대신 답한다. 날짜는 한국 시간 기준.
 *  공유 저장소(Upstash Redis)가 있으면 서버 여러 대가 같은 횟수를 보고, 없으면 서버 메모리로 센다.
 */
const mem = new Map<string, number>();

const today = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);

/** 한 번 쓰겠다고 신청 → 한도 안이면 true (그리고 1 증가) */
export async function takeOpus(who: string): Promise<{ ok: boolean; used: number; limit: number }> {
  const limit = BALANCE.routing.opusDailyLimit;
  if (limit <= 0) return { ok: false, used: 0, limit };
  const key = `with:opus:${today()}:${who || "anon"}`;
  const r = await kvPipeline([["INCR", key], ["EXPIRE", key, 60 * 60 * 30]]);
  let used: number;
  if (r && typeof r[0] === "number") used = r[0];
  else {
    used = (mem.get(key) ?? 0) + 1;
    mem.set(key, used);
    if (mem.size > 20_000) mem.delete(mem.keys().next().value as string);
  }
  return { ok: used <= limit, used, limit };
}
