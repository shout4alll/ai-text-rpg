"use client";

import { itemDef } from "@/config/items";
import type { Inventory } from "@/lib/inventory";

/**
 * 🎒 인벤토리 — 보유한 재화(보석)와 티켓·선물을 보여 준다.
 * 지금 값은 이 기기에만 저장된다 (lib/inventory.ts · 나중에 서버 DB 로 이전).
 */
export default function InventoryModal({
  gems,
  items,
  onCharge,
  onClose,
}: {
  gems: number;
  items: Inventory;
  onCharge: () => void;
  onClose: () => void;
}) {
  const rows = Object.entries(items)
    .map(([id, n]) => ({ id, n, def: itemDef(id) }))
    .filter((r) => r.def && r.n > 0);
  const tickets = rows.filter((r) => r.def!.group === "ticket");
  const gifts = rows.filter((r) => r.def!.group === "gift");

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 sm:items-center" data-inventory onClick={onClose}>
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">🎒 내 보관함</h2>
          <button type="button" onClick={onClose} aria-label="닫기" data-inventory-close className="px-2 text-xl text-ink-mute">
            ×
          </button>
        </div>

        {/* 재화 */}
        <button
          type="button"
          onClick={onCharge}
          data-inventory-gems
          className="mt-3 flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-brand-100 to-violet-100 px-4 py-3 text-left transition active:scale-[0.99]"
        >
          <span className="text-sm font-semibold">💎 보석</span>
          <span className="text-sm font-bold text-brand-600">
            {gems}개 <span className="ml-1 text-[11px] font-medium text-ink-mute">충전 →</span>
          </span>
        </button>

        {/* 티켓·쿠폰 */}
        <p className="mt-4 text-xs font-semibold text-ink-soft">🎟️ 이용권</p>
        {tickets.length === 0 ? (
          <p className="mt-1 rounded-2xl bg-paper px-3.5 py-3 text-xs text-ink-mute">
            아직 없어요. 리액션 화면을 쓰다듬다 보면 가끔 받을 수 있어요.
          </p>
        ) : (
          <ul className="mt-1 space-y-1.5">
            {tickets.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-paper px-3.5 py-2.5" data-inventory-item={r.id}>
                <span className="text-xl" aria-hidden>
                  {r.def!.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{r.def!.name}</span>
                  <span className="block text-[11px] text-ink-mute">{r.def!.desc}</span>
                </span>
                <span className="shrink-0 text-sm font-bold text-brand-600">{r.n}장</span>
              </li>
            ))}
          </ul>
        )}

        {/* 선물 */}
        <p className="mt-4 text-xs font-semibold text-ink-soft">🎁 가진 선물</p>
        {gifts.length === 0 ? (
          <p className="mt-1 rounded-2xl bg-paper px-3.5 py-3 text-xs text-ink-mute">아직 없어요. 받은 선물은 보석 없이 바로 줄 수 있어요.</p>
        ) : (
          <div className="mt-1 grid grid-cols-4 gap-2">
            {gifts.map((r) => (
              <div key={r.id} className="flex flex-col items-center gap-1 rounded-2xl bg-paper px-1 py-3 ring-1 ring-ink-line" data-inventory-item={r.id}>
                <span className="text-2xl" aria-hidden>
                  {r.def!.emoji}
                </span>
                <span className="line-clamp-1 text-[11px]">{r.def!.name}</span>
                <span className="text-[11px] font-semibold text-brand-600">{r.n}개</span>
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 text-[10px] leading-relaxed text-ink-mute/80">
          지금은 이 기기에만 저장돼요. 기기를 바꾸기 전에 백업해 두세요.
        </p>
      </div>
    </div>
  );
}
