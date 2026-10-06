/**
 * 유료 정책 (무료 체험 · 캐시 · 구독 단계) — 숫자는 여기서만 바꾸면 된다.
 *
 *  ▸ 보이스톡 무료 체험: 처음 한 번, 통화 횟수와 상관없이 "주고받기(티키타카) 5번"까지 무료
 *  ▸ 그 뒤: 구독 회원은 매달 받은 통화 시간에서 차감, 아니면 캐시로 분당 차감
 *  ▸ 실시간 사진: 구독 회원은 매달 받은 장수에서 차감, 아니면 캐시 차감
 *  ▸ 유료 리액션 영상(뽀뽀 등): PRIME 이상
 *
 * 원가 참고 (2026-10 Google 가격 기준, 환율 1,400원 가정)
 *   보이스톡 1분 ≈ $0.023 ≈ 32원 / 실시간 사진 1장 ≈ $0.045~0.07 ≈ 60~100원
 *   앱스토어 결제 수수료(최대 30%)를 빼고도 남도록 잡은 기본값이다. docs/MEMBERSHIP.md
 */

/** 보이스톡 무료 체험: 주고받기 횟수 (상대가 말을 마친 횟수 기준, 평생 1회 제공) */
export const FREE_VOICE_EXCHANGES = 5;

/** 캐시 가격 */
export const CASH_PRICE = {
  /** 보이스톡 1분 (시작할 때 첫 1분, 이후 1분마다) */
  voicePerMinute: 5,
  /** 실시간 사진 1장 */
  photo: 10,
} as const;

export type PlanId = "free" | "best" | "prime" | "vip";

export interface PlanDef {
  id: PlanId;
  /** 화면 표시 이름 */
  name: string;
  /** 월 구독료 (원, 표시용 — 실제 결제 연동 시 스토어 상품 가격과 맞출 것) */
  priceKrw: number;
  /** 매달 받는 보이스톡 시간 (분) */
  voiceMinutes: number;
  /** 매달 받는 실시간 사진 (장) */
  photos: number;
  /** 유료 리액션 영상 (뽀뽀 등) */
  premiumReactions: boolean;
  /** 매달 보너스 캐시 */
  bonusCash: number;
  /** 카드 강조 색 */
  color: string;
  /** 한 줄 소개 */
  tagline: string;
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: { id: "free", name: "무료", priceKrw: 0, voiceMinutes: 0, photos: 0, premiumReactions: false, bonusCash: 0, color: "#64748b", tagline: "" },
  best: {
    id: "best",
    name: "BEST",
    priceKrw: 9900,
    voiceMinutes: 30,
    photos: 10,
    premiumReactions: false,
    bonusCash: 0,
    color: "#38bdf8",
    tagline: "가볍게 목소리 듣기",
  },
  prime: {
    id: "prime",
    name: "PRIME",
    priceKrw: 19900,
    voiceMinutes: 120,
    photos: 40,
    premiumReactions: true,
    bonusCash: 50,
    color: "#f472b6",
    tagline: "매일 통화하는 사이",
  },
  vip: {
    id: "vip",
    name: "VIP",
    priceKrw: 39900,
    voiceMinutes: 300,
    photos: 100,
    premiumReactions: true,
    bonusCash: 150,
    color: "#fbbf24",
    tagline: "가장 특별한 사이",
  },
};

/** 구독 단계 순서 (낮음 → 높음) */
export const PLAN_ORDER: PlanId[] = ["best", "prime", "vip"];
