import { z } from "zod";

/**
 * 🗓 선톡 알림 "하루 일과표" 형식 — CMS 가 편집하는 데이터.
 * 기본값은 config/notifications.ts 의 DEFAULT_NOTIFY_PLAN, CMS 저장값은 서버(lib/push/planStore.ts)가 들고 있다가
 * GET /api/notify/plan 으로 앱에 내려준다. (앱은 받아서 기기에 저장해 두고, 오프라인이면 마지막 값/기본값을 쓴다)
 * 그래서 시간·횟수·문구를 바꿔도 APK 를 다시 만들 필요가 없다.
 * (client-safe: 서버·브라우저 모두에서 import 가능)
 */
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM 형식 (예: 08:30)");

export const notifySlotSchema = z.object({
  /** 고유 id — 서버 프롬프트의 hint 를 찾는 열쇠. 바꾸지 않는 게 좋다 */
  id: z.string().regex(/^[a-z0-9_]{1,24}$/),
  /** CMS 에 보이는 이름 */
  label: z.string().min(1).max(30),
  /** 기준 시각 */
  at: hhmm,
  /** 기준 시각 앞뒤로 흔들리는 폭(분). 매일 조금씩 다른 시각에 온다 */
  jitterMin: z.number().int().min(0).max(120),
  /** true 면 매일 꼭 보냄. false 면 하루 목표 횟수를 채울 때만 후보로 뽑힘 */
  required: z.boolean(),
  /** 사진·영상 선톡을 이 시간대에 보내도 되는가 */
  allowMedia: z.boolean(),
  /** 인물에게 주는 이 시간대의 상황 지침 (서버가 프롬프트에 넣는다) */
  hint: z.string().min(1).max(300),
  enabled: z.boolean().default(true),
});

export const notifyPlanSchema = z.object({
  version: z.literal(1).default(1),
  /** 이 시간 밖에는 절대 보내지 않는다 */
  window: z.object({ start: hhmm, end: hhmm }),
  /** 하루 목표 횟수 (required 슬롯은 항상 포함, 모자라면 optional 슬롯에서 채움) */
  perDay: z.object({ min: z.number().int().min(0).max(12), max: z.number().int().min(0).max(12) }),
  /** 알림 사이 최소 간격(분) */
  minGapMin: z.number().int().min(0).max(240),
  /** 오늘 포함 며칠 치를 예약할지 */
  daysAhead: z.number().int().min(1).max(7),
  /** 앱을 닫은 직후 몇 분 안에는 안 보냄 */
  minLeadMin: z.number().int().min(0).max(600),
  /** 전체 켜기/끄기 (CMS 에서 일괄 중단용) */
  enabled: z.boolean().default(true),
  slots: z.array(notifySlotSchema).min(1).max(12),
});

export type NotifySlot = z.infer<typeof notifySlotSchema>;
export type NotifyPlan = z.infer<typeof notifyPlanSchema>;

export const toMin = (s: string): number => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

/** 검사 통과한 일과표 (아니면 null) */
export function parseNotifyPlan(v: unknown): NotifyPlan | null {
  const r = notifyPlanSchema.safeParse(v);
  if (!r.success) return null;
  const p = r.data;
  if (toMin(p.window.end) <= toMin(p.window.start) || p.perDay.max < p.perDay.min) return null;
  return p;
}
