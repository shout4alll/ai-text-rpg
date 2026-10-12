/**
 * 💎 인게임 경제 (이 기기 기준) — 값은 config/balance.json economy.
 *  · 메시지: 하루 dailyFreeMessages 개 무료, 그 뒤 1개당 messageCost 💎
 *  · 매혹 모드: 인물마다 하루 처음 켤 때 allureDayCost 💎
 *  · 선물: 선물마다 가격 (GiftSheet)
 *  결제 모듈 연동 전에는 상점(GemShop)에서 바로 충전된다 (config/gems.ts GEM_TEST_TOPUP).
 */
import { BALANCE } from "@/config/balance";

const today = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD (기기 시간대)
const MSG_KEY = "ai-rpg.econ.msgs";
const ALLURE_KEY = "ai-rpg.econ.allure";

function read<T>(k: string, d: T): T {
  try {
    return (JSON.parse(localStorage.getItem(k) ?? "null") as T) ?? d;
  } catch {
    return d;
  }
}
function write(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* 무시 */
  }
}

/** 오늘 보낸 메시지 수 */
export function messagesToday(): number {
  const v = read<{ d: string; n: number }>(MSG_KEY, { d: "", n: 0 });
  return v.d === today() ? v.n : 0;
}
/** 이번 메시지의 비용 (무료 남았으면 0) */
export function nextMessageCost(): number {
  return messagesToday() >= BALANCE.economy.dailyFreeMessages ? BALANCE.economy.messageCost : 0;
}
export function countMessage() {
  write(MSG_KEY, { d: today(), n: messagesToday() + 1 });
}
/** 남은 무료 메시지 */
export function freeMessagesLeft(): number {
  return Math.max(0, BALANCE.economy.dailyFreeMessages - messagesToday());
}

/** 오늘 이 인물의 매혹 모드 이용료를 냈는가 */
export function allurePaidToday(personaId: string): boolean {
  return read<Record<string, string>>(ALLURE_KEY, {})[personaId] === today();
}
export function markAllurePaid(personaId: string) {
  write(ALLURE_KEY, { ...read<Record<string, string>>(ALLURE_KEY, {}), [personaId]: today() });
}
