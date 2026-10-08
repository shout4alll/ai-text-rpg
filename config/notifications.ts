/**
 * 🔔 알림(선톡) 설정값 — 여기만 고치면 시간대·횟수·종류가 바뀐다.
 *
 * 알림은 앱이 폰에 "예약"해 두는 방식(기기 예약 알림)이라 서버·Firebase 가 필요 없다.
 * 알림 문구에는 내용을 넣지 않고 "누가 무엇을 보냈다"만 보여 준다. 실제 말·사진은 알림을 누르거나 앱을 열 때 대화방에 도착한다.
 */

/** 이 시간대에만 보낸다. endHour(22시) 이후와 startHour(9시) 이전에는 절대 보내지 않는다. */
export const NOTIFY_WINDOW = {
  startHour: 9,
  endHour: 22,
  /** 22시 정각 직전은 피한다(분) — 마지막 알림은 21:50 이전 */
  endMarginMin: 10,
} as const;

/** 하루에 보내는 횟수 (무작위로 min~max) */
export const NOTIFY_PER_DAY = { min: 3, max: 4 } as const;

/** 오늘 포함 며칠 치를 미리 예약할지. 그 뒤에는 앱을 다시 열어야 이어서 예약된다 (오래 안 오면 알림도 멈춘다) */
export const NOTIFY_DAYS_AHEAD = 3;

/** 앱을 닫은 직후 바로 오지 않도록, 이 시간(분)보다 가까운 시각은 예약하지 않는다 */
export const NOTIFY_MIN_LEAD_MIN = 60;

/** 알림 id 범위 (선톡 전용). 다른 종류의 알림을 늘릴 때는 겹치지 않는 범위를 새로 잡는다 */
export const NOTIFY_ID_BASE = 91000;
export const NOTIFY_ID_COUNT = 100;

/** 안드로이드 알림 채널 */
export const NOTIFY_CHANNEL = { id: "nudge", name: "선톡 알림", description: "인물이 먼저 보내는 메시지·사진·영상 알림" } as const;

/** 알림 제목 */
export const NOTIFY_TITLE = "WitH";

/** 알림이 대화방에 도착하기 전까지 보관하는 시간 (이 시간이 지나면 버린다) */
export const NUDGE_KEEP_MS = 48 * 60 * 60 * 1000;

/**
 * 알림 종류 — 설정 화면의 토글 목록이 이 배열로 만들어진다.
 * 종류를 늘릴 때: 여기에 한 줄 추가 → (보내는 쪽에서 kindId 로 확인).
 */
export const NOTIFY_KINDS = [
  { id: "nudge_message", label: "메시지 선톡", desc: "인물이 먼저 안부나 말을 걸어요", default: true },
  { id: "nudge_media", label: "사진·영상 선톡", desc: "인물이 사진이나 영상을 먼저 보내요", default: true },
] as const;

export type NotifyKindId = (typeof NOTIFY_KINDS)[number]["id"];

export const NOTIFY_SETTINGS_KEY = "ai-rpg.notify";

/** 선톡 종류 (대화방에 어떻게 도착하는가) */
export type NudgeKind = "message" | "photo" | "video";

/** 알림에 보이는 문구 — 내용은 알리지 않는다 */
export function nudgeBody(name: string, kind: NudgeKind): string {
  if (kind === "photo") return `${name}님이 사진과 메시지를 보냈습니다`;
  if (kind === "video") return `${name}님이 영상과 메시지를 보냈습니다`;
  return `${name}님이 메시지를 보냈습니다`;
}
