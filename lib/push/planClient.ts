/**
 * 🗓 일과표 불러오기 (앱) — 서버(/api/notify/plan, CMS 값)에서 받아 기기에 저장해 두고, 못 받으면 마지막 값 → 기본값 순으로 쓴다.
 */
import { DEFAULT_NOTIFY_PLAN } from "@/config/notifications";
import { apiUrl } from "@/lib/apiBase";
import { parseNotifyPlan, type NotifyPlan } from "@/lib/push/planSchema";

const KEY = "ai-rpg.notify.plan";

/** 지금 쓸 일과표 (동기) */
export function loadNotifyPlan(): NotifyPlan {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return parseNotifyPlan(JSON.parse(raw)) ?? DEFAULT_NOTIFY_PLAN;
  } catch {
    /* 기본값 */
  }
  return DEFAULT_NOTIFY_PLAN;
}

/** 서버에서 최신 일과표를 받아 저장한다 (실패하면 조용히 넘어감) */
export async function refreshNotifyPlan(): Promise<NotifyPlan> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(apiUrl("/api/notify/plan"), { signal: ctl.signal, cache: "no-store" });
    clearTimeout(t);
    if (res.ok) {
      const p = parseNotifyPlan((await res.json())?.plan);
      if (p) {
        try {
          localStorage.setItem(KEY, JSON.stringify(p));
        } catch {
          /* 저장 불가 */
        }
        return p;
      }
    }
  } catch {
    /* 오프라인 */
  }
  return loadNotifyPlan();
}
