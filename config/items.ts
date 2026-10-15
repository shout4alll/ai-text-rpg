/**
 * 🎒 인벤토리 품목 (보석 외에 유저가 "보유"하는 것)
 *
 *  · 티켓/쿠폰: 특별 리액션 영상·실시간 사진을 보석 없이 쓸 수 있는 이용권
 *  · 선물: 터치 보상 등으로 받은 선물. 선물하기에서 보석 없이 바로 줄 수 있다.
 *
 * 지금은 이 기기(localStorage)에 저장한다 (lib/inventory.ts).
 * 나중에 서버 DB 로 옮길 때는 lib/inventory.ts 의 읽기·쓰기 함수만 서버 호출로 바꾸면 된다.
 */
import { BALANCE } from "@/config/balance";

/** ⭐ 특별 리액션 영상 1편 이용권 */
export const TICKET_SPECIAL = "ticket_special";
/** 📸 실시간 사진 1장 이용권 */
export const TICKET_PHOTO = "ticket_photo";

/** 선물 보유 품목 id (예: gift_coffee) */
export const giftItemId = (giftId: string) => `gift_${giftId}`;
/** 선물 품목 id 에서 선물 id 를 되돌린다 (선물이 아니면 null) */
export const giftIdOf = (itemId: string) => (itemId.startsWith("gift_") ? itemId.slice(5) : null);

export type ItemGroup = "ticket" | "gift";

export interface ItemDef {
  emoji: string;
  name: string;
  desc: string;
  group: ItemGroup;
}

const TICKETS: Record<string, ItemDef> = {
  [TICKET_SPECIAL]: { emoji: "🎟️", name: "특별 리액션 티켓", desc: "특별 리액션 영상 1편을 보석 없이 볼 수 있어요", group: "ticket" },
  [TICKET_PHOTO]: { emoji: "🎫", name: "실시간 사진 티켓", desc: "실시간 사진 1장을 보석 없이 받을 수 있어요", group: "ticket" },
};

/** 품목 정보 (모르는 id 면 null) */
export function itemDef(id: string): ItemDef | null {
  if (TICKETS[id]) return TICKETS[id];
  const gid = giftIdOf(id);
  if (gid) {
    const g = BALANCE.economy.gifts.find((x) => x.id === gid);
    if (g) return { emoji: g.emoji, name: g.name, desc: "선물하기에서 보석 없이 바로 줄 수 있어요", group: "gift" };
    return { emoji: "🎁", name: "선물", desc: "선물하기에서 보석 없이 바로 줄 수 있어요", group: "gift" };
  }
  return null;
}
