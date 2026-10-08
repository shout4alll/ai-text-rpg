/**
 * 🔔 알림(선톡) 설정값 — 여기만 고치면 시간대·횟수·종류가 바뀐다.
 *
 * 알림은 앱이 폰에 "예약"해 두는 방식(기기 예약 알림)이라 서버·Firebase 가 필요 없다.
 * 알림 문구에는 내용을 넣지 않고 "누가 무엇을 보냈다"만 보여 준다. 실제 말·사진은 알림을 누르거나 앱을 열 때 대화방에 도착한다.
 */

import type { NotifyPlan } from "@/lib/push/planSchema";

/**
 * 🗓 하루 일과표 (기본값) — 끼니·일과·잠자리 시간대에 맞춰 하루 6~7번.
 * 이 값이 CMS 가 편집하는 데이터의 "기본값"이다. 서버에 CMS 저장값이 있으면 그것이 우선한다 (lib/push/planStore.ts).
 *  - required: true 는 매일 보내고, false 는 목표 횟수(perDay)를 채울 때만 뽑힌다.
 *  - hint 는 서버가 인물 프롬프트에 넣는 "이 시간대의 상황"이다.
 */
export const DEFAULT_NOTIFY_PLAN: NotifyPlan = {
  version: 1,
  enabled: true,
  window: { start: "07:30", end: "23:00" },
  perDay: { min: 6, max: 7 },
  minGapMin: 40,
  daysAhead: 3,
  minLeadMin: 60,
  slots: [
    { id: "morning", label: "아침 인사", at: "08:30", jitterMin: 20, required: true, allowMedia: false, enabled: true,
      hint: "지금은 아침이다. 잘 잤는지·아침은 먹었는지 챙기거나, 네 아침 일과(출근 준비·커피 등)를 짧게 얘기한다." },
    { id: "midmorning", label: "오전 일과", at: "10:40", jitterMin: 30, required: false, allowMedia: true, enabled: true,
      hint: "오전 일과 중이다. 네가 하고 있는 일을 한마디 하거나 유저의 오전 계획을 가볍게 묻는다." },
    { id: "lunch", label: "점심", at: "12:15", jitterMin: 20, required: true, allowMedia: true, enabled: true,
      hint: "점심시간이다. 점심 뭐 먹을지·먹었는지 묻거나 네 점심 얘기를 한다." },
    { id: "afternoon", label: "오후 일과", at: "15:30", jitterMin: 40, required: false, allowMedia: true, enabled: true,
      hint: "나른한 오후다. 간식·커피·졸림 같은 일과 얘기나 안부를 가볍게 건넨다." },
    { id: "dinner", label: "저녁", at: "18:40", jitterMin: 25, required: true, allowMedia: true, enabled: true,
      hint: "저녁 식사 시간이다. 저녁 메뉴를 묻거나 퇴근·하루 마무리 분위기로 말을 건다." },
    { id: "evening", label: "저녁 여가", at: "20:40", jitterMin: 40, required: false, allowMedia: true, enabled: true,
      hint: "하루를 마무리하는 저녁이다. 오늘 어땠는지 묻거나 네 오늘 이야기를 한다." },
    { id: "goodnight", label: "잠자리", at: "22:30", jitterMin: 15, required: true, allowMedia: false, enabled: true,
      hint: "잠자리에 들 시간이다. 오늘 하루를 다독이고 잘 자라고 인사하며, 자기 전 한마디를 건넨다. 길게 끌지 않는다." },
  ],
};

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
