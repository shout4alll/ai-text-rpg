"use client";
/**
 * 🎒 인벤토리 (티켓·선물 보유) — 지금은 이 기기(localStorage)에만 저장한다.
 *
 * ⚠️ 결제·계정 연동 전 임시 구현이다. 유저가 값을 바꿀 수 있다.
 *    서버 DB 로 옮길 때는 이 파일의 함수 본문만 서버 호출로 바꾸면 된다 (화면 코드는 그대로).
 *    품목 목록: config/items.ts
 */

const KEY = "ai-rpg.inventory";

/** { 품목 id: 개수 } */
export type Inventory = Record<string, number>;

export function readInventory(): Inventory {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}") as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Inventory = {};
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
      if (typeof n === "number" && Number.isFinite(n) && n > 0) out[k] = Math.floor(n);
    }
    return out;
  } catch {
    return {};
  }
}

function write(inv: Inventory) {
  try {
    localStorage.setItem(KEY, JSON.stringify(inv));
  } catch {
    /* 저장 불가 */
  }
}

export function countItem(id: string): number {
  return readInventory()[id] ?? 0;
}

/** 받기 — 받은 뒤 총 개수를 돌려준다 */
export function addItem(id: string, n = 1): number {
  const inv = readInventory();
  const next = (inv[id] ?? 0) + Math.max(1, Math.floor(n));
  inv[id] = next;
  write(inv);
  return next;
}

/** 쓰기 — 모자라면 아무것도 하지 않고 false (이름에 use 를 쓰면 React 훅으로 오인돼 빌드가 막힌다) */
export function spendItem(id: string, n = 1): boolean {
  const inv = readInventory();
  const need = Math.max(1, Math.floor(n));
  if ((inv[id] ?? 0) < need) return false;
  const left = inv[id] - need;
  if (left > 0) inv[id] = left;
  else delete inv[id];
  write(inv);
  return true;
}

/** 보유 목록 (개수가 0 인 것은 빠진다) */
export function inventoryList(): { id: string; n: number }[] {
  return Object.entries(readInventory()).map(([id, n]) => ({ id, n }));
}
