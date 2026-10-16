"use client";

import { clipLabel } from "@/config/clipLabels";

/**
 * 🎬 리액션 보기 — 원할 때 리액션 영상을 골라서 본다 (리액션 화면 왼쪽 버튼).
 *  · 일반: 낮은 보석 (하루 몇 번은 무료)
 *  · 프리미엄: 높은 보석 (멤버십이면 일반 값)
 *  · 💋 매혹: 성인 확인을 마친 유저만
 *  · ⭐ 특별: 🎟️ 티켓이 있으면 티켓으로, 없으면 보석으로
 *  · 🔞 성인 전용: 성인 확인을 마친 유저에게만, 고가 (일반·매혹 영상과 따로 관리)
 * 가격은 config/balance.json 의 reactionShop.
 */
export type ShopTier = "normal" | "premium" | "allure" | "special" | "adult";

export interface ShopItem {
  /** 재생할 영상 이름 (persona.assets 의 키) */
  clip: string;
  tier: ShopTier;
  /** 보석 값 (티켓으로 볼 수 있으면 ticket=true) */
  cost: number;
  /** 🎟️ 티켓으로 볼 수 있는가 */
  ticket?: boolean;
  /** 볼 수 없으면 그 이유 (버튼이 잠긴다) */
  locked?: string;
  /** 화면에 보일 이름 (없으면 영상 이름으로 만든다 — 성인 전용 영상용) */
  label?: string;
}

const TIERS: { id: ShopTier; title: string; desc: string }[] = [
  { id: "normal", title: "일반 리액션", desc: "평소 대화에서 나오는 표정" },
  { id: "premium", title: "💝 프리미엄", desc: "특별한 순간에만 나오는 리액션" },
  { id: "allure", title: "💋 매혹", desc: "성인 확인을 마친 분만 볼 수 있어요" },
  { id: "special", title: "⭐ 특별 영상", desc: "조금 더 길고 공들인 영상" },
  { id: "adult", title: "🔞 성인 전용", desc: "성인 확인 후에만 · 고가 · 더 대담한 영상" },
];

export default function ReactionShop({
  personaName,
  items,
  gems,
  tickets,
  freeCount,
  onPlay,
  onCharge,
  onClose,
}: {
  personaName: string;
  items: ShopItem[];
  gems: number;
  /** ⭐ 특별 리액션 티켓 보유 수 */
  tickets: number;
  /** 이 인물의 대표 일반 리액션 무료 개수 */
  freeCount: number;
  onPlay: (item: ShopItem) => void;
  onCharge: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 sm:items-center" data-reaction-shop onClick={onClose}>
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">🎬 {personaName}의 리액션 보기</h2>
          <button type="button" onClick={onClose} aria-label="닫기" data-reaction-shop-close className="px-2 text-xl text-ink-mute">
            ×
          </button>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-ink-mute">
          <button type="button" onClick={onCharge} className="font-semibold text-brand-600">
            💎 {gems}
          </button>
          {tickets > 0 && <span>· 🎟️ {tickets}장</span>}
          {freeCount > 0 && <span>· 대표 리액션 {freeCount}개 무료</span>}
        </div>

        {items.length === 0 && <p className="mt-4 rounded-2xl bg-paper px-3.5 py-3 text-xs text-ink-mute">볼 수 있는 리액션 영상이 아직 없어요.</p>}

        {TIERS.map((t) => {
          const list = items.filter((i) => i.tier === t.id);
          if (list.length === 0) return null;
          return (
            <section key={t.id} className="mt-4" data-shop-tier={t.id}>
              <p className="text-xs font-semibold text-ink-soft">{t.title}</p>
              <p className="text-[11px] text-ink-mute">{t.desc}</p>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {list.map((i) => {
                  const byTicket = !!i.ticket && tickets > 0;
                  const free = i.cost === 0;
                  const poor = !byTicket && !free && gems < i.cost;
                  return (
                    <button
                      key={i.clip}
                      type="button"
                      disabled={!!i.locked}
                      data-shop-item={i.clip}
                      onClick={() => onPlay(i)}
                      className="flex items-center justify-between gap-2 rounded-2xl bg-paper px-3 py-2.5 text-left ring-1 ring-ink-line transition active:scale-[0.98] disabled:opacity-45"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{i.label ?? clipLabel(i.clip)}</span>
                        {i.locked && <span className="block text-[10px] text-ink-mute">{i.locked}</span>}
                      </span>
                      <span className={`shrink-0 text-[11px] font-bold ${byTicket ? "text-amber-500" : free ? "text-emerald-600" : poor ? "text-rose-500" : "text-brand-600"}`}>
                        {i.locked ? "🔒" : byTicket ? "🎟️ 1" : free ? "무료" : `💎 ${i.cost}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

        <p className="mt-4 text-[10px] leading-relaxed text-ink-mute/80">
          고른 리액션이 리액션 화면에서 바로 재생돼요. 대화 중 자연스럽게 나오는 리액션은 지금처럼 무료예요.
        </p>
      </div>
    </div>
  );
}
