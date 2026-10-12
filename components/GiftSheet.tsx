"use client";

/**
 * 🎁 선물하기 — 💎 로 선물을 고른다. 그 인물이 좋아하는 선물이면 호감도가 오르고 기뻐하고,
 *  아니면 반응이 없다(힌트: 인물 프로필의 "좋아하는 것"). 목록·가격: config/balance.json economy.gifts
 */
export interface GiftOption {
  id: string;
  name: string;
  emoji: string;
  cost: number;
}

export default function GiftSheet({ name, gifts, gems, cooldownLeftMin, onGive, onClose }: { name: string; gifts: GiftOption[]; gems: number; cooldownLeftMin: number; onGive: (g: GiftOption) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/35" onClick={onClose} data-gift-sheet>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-ink">🎁 {name}에게 선물하기</p>
          <span className="text-sm font-semibold text-ink-soft">💎 {gems}</span>
        </div>
        <p className="mt-1 text-xs text-ink-mute">좋아하는 선물이면 호감도가 올라요. 마음에 안 들면 반응이 없어요.</p>
        {cooldownLeftMin > 0 && <p className="mt-2 rounded-xl bg-paper px-3 py-2 text-xs text-ink-soft">방금 선물했어요. {cooldownLeftMin}분 뒤에 다시 줄 수 있어요.</p>}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {gifts.map((g) => (
            <button
              key={g.id}
              type="button"
              disabled={cooldownLeftMin > 0}
              onClick={() => onGive(g)}
              data-gift={g.id}
              className="flex flex-col items-center gap-1 rounded-2xl bg-paper px-1 py-3 ring-1 ring-ink-line transition active:scale-95 disabled:opacity-40"
            >
              <span className="text-2xl">{g.emoji}</span>
              <span className="line-clamp-1 text-[11px] text-ink">{g.name}</span>
              <span className={`text-[11px] font-semibold ${gems >= g.cost ? "text-brand-600" : "text-rose-500"}`}>💎{g.cost}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
