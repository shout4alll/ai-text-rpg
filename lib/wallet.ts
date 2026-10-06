/**
 * 유저 캐시 지갑 (테스트용, 브라우저에만 저장)
 *
 * ⚠️ 결제 연동 전 임시 구현이다. 브라우저 저장소라 유저가 값을 바꿀 수 있다.
 *    실제 판매 시에는 서버(DB)에 잔액을 두고, /api/media/photo 가 서버에서 차감·환불하도록 바꿔야 한다. (docs/MEDIA.md)
 */
import { DEMO_START_CASH } from "@/config/media";

const KEY = "ai-rpg.cash";

export function getCash(): number {
  try {
    const v = localStorage.getItem(KEY);
    if (v === null) return DEMO_START_CASH;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : DEMO_START_CASH;
  } catch {
    return DEMO_START_CASH;
  }
}

export function setCash(n: number) {
  try {
    localStorage.setItem(KEY, String(Math.max(0, Math.round(n))));
  } catch {
    /* 저장 불가 */
  }
}

/** 차감. 잔액이 부족하면 false */
export function spendCash(amount: number): boolean {
  const cur = getCash();
  if (cur < amount) return false;
  setCash(cur - amount);
  return true;
}

export function refundCash(amount: number) {
  setCash(getCash() + amount);
}
