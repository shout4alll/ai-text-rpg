"use client";

import { GEM_PACKS, GEM_TEST_TOPUP, type GemPack } from "@/config/gems";

/** 왼쪽 위에 놓는 보석 뱃지 — 누르면 충전창 */
export function GemBadge({ gems, onClick, className = "" }: { gems: number; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-gem-badge
      aria-label={`보석 ${gems}개 · 충전`}
      className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-white/90 px-2.5 text-[13px] font-bold text-ink shadow-sm ring-1 ring-black/10 transition active:scale-95 ${className}`}
    >
      <span aria-hidden>💎</span>
      <span data-gem-count>{gems}</span>
      <span aria-hidden className="text-ink-mute">+</span>
    </button>
  );
}

/** 충전창. 테스트 충전이 켜져 있으면 무료로 더해 준다. */
export function GemShop({ gems, onCharge, onClose }: { gems: number; onCharge: (pack: GemPack) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center" data-gem-shop onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl bg-white p-5 text-ink sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">💎 보석 충전</h2>
          <button onClick={onClose} aria-label="닫기" className="px-2 text-xl text-ink-mute">×</button>
        </div>
        <p className="mt-1 text-sm text-ink-mute">
          보유 <b data-gem-have>{gems}</b>개 · 선물이나 특별한 기능에 쓰여요
        </p>
        <ul className="mt-4 space-y-2">
          {GEM_PACKS.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => onCharge(p)}
                data-gem-pack={p.id}
                className="flex w-full items-center justify-between rounded-2xl bg-black/[0.04] px-4 py-3 text-left active:scale-[0.99]"
              >
                <span className="font-semibold">
                  💎 {p.gems}
                  {"tag" in p && p.tag ? <span className="ml-2 rounded-full bg-pink-100 px-2 py-0.5 text-[11px] text-pink-600">{p.tag}</span> : null}
                </span>
                <span className="text-sm font-semibold">{GEM_TEST_TOPUP ? "무료 (테스트)" : `₩${p.price.toLocaleString()}`}</span>
              </button>
            </li>
          ))}
        </ul>
        {GEM_TEST_TOPUP && <p className="mt-3 text-center text-[11px] text-ink-mute">테스트 충전이에요. 출시 전에 실제 결제로 바뀝니다.</p>}
      </div>
    </div>
  );
}
