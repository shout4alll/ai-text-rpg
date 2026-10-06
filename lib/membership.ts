/**
 * 멤버십 상태 (무료 체험 · 구독 · 월 사용량) — 테스트용, 브라우저에만 저장
 *
 * ⚠️ 결제 연동 전 임시 구현이다. 실제 판매 시에는
 *    로그인 + 서버 DB(구독 상태·월 사용량·캐시 잔액)로 옮기고, 서버가 차감·검증해야 한다. (docs/MEMBERSHIP.md)
 *    이 파일의 함수 이름(getMembership, useVoiceExchange …)을 그대로 서버 API 호출로 바꾸면 화면 코드는 고칠 필요가 없다.
 */
import { FREE_VOICE_EXCHANGES, PLANS, type PlanId } from "@/config/plans";

const KEY = "ai-rpg.membership";

export interface MembershipState {
  plan: PlanId;
  /** 사용량 기준 달 (YYYY-MM) — 달이 바뀌면 사용량 초기화 */
  month: string;
  /** 이번 달 사용한 보이스톡 (초) */
  voiceSecondsUsed: number;
  /** 이번 달 사용한 실시간 사진 (장) */
  photosUsed: number;
  /** 지금까지 쓴 무료 보이스톡 주고받기 */
  freeExchangesUsed: number;
}

const thisMonth = () => new Date().toISOString().slice(0, 7);

function load(): MembershipState {
  const base: MembershipState = { plan: "free", month: thisMonth(), voiceSecondsUsed: 0, photosUsed: 0, freeExchangesUsed: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const s = { ...base, ...(JSON.parse(raw) as Partial<MembershipState>) };
    if (!(s.plan in PLANS)) s.plan = "free";
    if (s.month !== base.month) {
      // 새 달: 월 사용량 초기화 (무료 체험은 유지)
      s.month = base.month;
      s.voiceSecondsUsed = 0;
      s.photosUsed = 0;
    }
    return s;
  } catch {
    return base;
  }
}

function save(s: MembershipState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 저장 불가 */
  }
}

export function getMembership(): MembershipState {
  return load();
}

export function planOf(s: MembershipState = load()) {
  return PLANS[s.plan];
}

/** 남은 무료 보이스톡 주고받기 */
export function freeExchangesLeft(s: MembershipState = load()): number {
  return Math.max(0, FREE_VOICE_EXCHANGES - s.freeExchangesUsed);
}

/** 이번 달 남은 구독 통화 시간 (초) */
export function planVoiceSecondsLeft(s: MembershipState = load()): number {
  return Math.max(0, PLANS[s.plan].voiceMinutes * 60 - s.voiceSecondsUsed);
}

/** 이번 달 남은 구독 사진 (장) */
export function planPhotosLeft(s: MembershipState = load()): number {
  return Math.max(0, PLANS[s.plan].photos - s.photosUsed);
}

export function consumeFreeExchange(): number {
  const s = load();
  s.freeExchangesUsed = Math.min(FREE_VOICE_EXCHANGES, s.freeExchangesUsed + 1);
  save(s);
  return freeExchangesLeft(s);
}

export function addVoiceSeconds(sec: number) {
  const s = load();
  s.voiceSecondsUsed += Math.max(0, Math.round(sec));
  save(s);
}

export function consumePlanPhoto(): boolean {
  const s = load();
  if (planPhotosLeft(s) <= 0) return false;
  s.photosUsed += 1;
  save(s);
  return true;
}

export function refundPlanPhoto() {
  const s = load();
  s.photosUsed = Math.max(0, s.photosUsed - 1);
  save(s);
}

/** (테스트용) 구독 변경 — 실제로는 결제 완료 후 서버가 설정 */
export function setPlanForTest(plan: PlanId) {
  const s = load();
  s.plan = plan;
  save(s);
}
