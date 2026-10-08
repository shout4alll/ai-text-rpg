import "server-only";
import { DEFAULT_NOTIFY_PLAN } from "@/config/notifications";
import { parseNotifyPlan, type NotifyPlan } from "@/lib/push/planSchema";

/**
 * 🗄 선톡 일과표 저장소 — CMS 연결 자리 (지금은 비어 있어 기본값을 쓴다)
 *  CMS 를 만들면: DB 값을 setPersistedNotifyPlan(plan) 으로 넣는다 (서버 시작 시 + 저장할 때마다).
 *  형식이 틀리면 무시하고 기본값으로 돌아간다 (CMS 입력 실수가 알림 전체를 멈추지 않게).
 */
let persisted: NotifyPlan | null = null;
export function setPersistedNotifyPlan(v: unknown): boolean {
  const p = v == null ? null : parseNotifyPlan(v);
  if (v != null && !p) return false;
  persisted = p;
  return true;
}
export const currentNotifyPlan = (): NotifyPlan => persisted ?? DEFAULT_NOTIFY_PLAN;
