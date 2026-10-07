"use client";

import { CASH_PRICE, PLANS, PLAN_ORDER, type PlanId } from "@/config/plans";
import { DEMO_TOPUP } from "@/config/media";

export type PlansReason = "menu" | "voice" | "trial-end" | "photo" | "allure";

const TITLES: Record<PlansReason, { title: string; sub: string }> = {
  menu: { title: "멤버십", sub: "더 자주, 더 가까이 이야기해요" },
  voice: { title: "보이스톡을 계속하려면", sub: "구독하거나 캐시로 통화할 수 있어요" },
  "trial-end": { title: "무료 보이스톡 체험이 끝났어요", sub: "목소리로 계속 이야기하고 싶다면" },
  photo: { title: "실시간 사진", sub: "구독하면 매달 사진을 받을 수 있어요" },
  allure: { title: "💋 매혹 모드", sub: "PRIME 이상 멤버십에서 켤 수 있어요" },
};

/**
 * 구독 단계(BEST · PRIME · VIP) + 캐시 안내 모달.
 * 결제 연동 전이라 "구독하기"·"충전"은 테스트용으로 바로 적용된다. (docs/MEMBERSHIP.md)
 */
export default function PlansModal({
  reason,
  currentPlan,
  cash,
  personaName,
  onSubscribe,
  onTopUp,
  onCashCall,
  onClose,
}: {
  reason: PlansReason;
  currentPlan: PlanId;
  cash: number;
  personaName: string;
  onSubscribe: (plan: PlanId) => void;
  onTopUp: () => void;
  /** 보이스톡: 캐시로 바로 통화 (reason=voice/trial-end 일 때만) */
  onCashCall?: () => void;
  onClose: () => void;
}) {
  const t = TITLES[reason];
  const canCashCall = !!onCashCall && cash >= CASH_PRICE.voicePerMinute;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plans-title"
      data-plans-modal={reason}
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-surface text-ink shadow-lift ring-1 ring-ink-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-gradient-to-br from-brand-100 via-violet-50 to-amber-100 px-5 pb-4 pt-5">
          <button type="button" onClick={onClose} aria-label="닫기" className="absolute right-4 top-4 text-lg text-ink-mute">
            ✕
          </button>
          <p id="plans-title" className="pr-8 text-lg font-bold">
            {t.title}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {t.sub} · {personaName}
          </p>
        </div>

        <div className="space-y-2.5 px-4 py-4">
          {PLAN_ORDER.map((id) => {
            const p = PLANS[id];
            const current = id === currentPlan;
            return (
              <div
                key={id}
                className={`rounded-2xl p-3.5 ring-1 ${current ? "bg-brand-50 ring-brand-300" : "bg-paper ring-ink-line"}`}
                data-plan={id}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold tracking-wide" style={{ color: p.color }}>
                      {p.name}
                      {id === "prime" && <span className="ml-1.5 rounded-full bg-pink-500 px-1.5 py-0.5 text-[9px] text-white">인기</span>}
                    </p>
                    <p className="text-[11px] text-ink-mute">{p.tagline}</p>
                  </div>
                  <p className="shrink-0 text-right text-sm font-bold">
                    ₩{p.priceKrw.toLocaleString("ko-KR")}
                    <span className="text-[10px] font-normal text-ink-mute"> /월</span>
                  </p>
                </div>
                <ul className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-ink-soft">
                  <li>📞 보이스톡 {p.voiceMinutes}분</li>
                  <li>📸 실시간 사진 {p.photos}장</li>
                  <li className={p.premiumReactions ? "" : "text-ink-mute/60 line-through"}>💋 특별 리액션 · 매혹 모드</li>
                  <li className={p.bonusCash ? "" : "text-ink-mute/60"}>💎 보너스 {p.bonusCash}</li>
                </ul>
                <button
                  type="button"
                  disabled={current}
                  onClick={() => onSubscribe(id)}
                  data-subscribe={id}
                  className="mt-2.5 w-full rounded-xl py-2 text-xs font-bold text-slate-900 disabled:bg-ink/10 disabled:text-ink-mute"
                  style={current ? undefined : { backgroundColor: p.color }}
                >
                  {current ? "이용 중" : `${p.name} 구독하기 (테스트)`}
                </button>
              </div>
            );
          })}

          <div className="rounded-2xl bg-paper p-3.5 ring-1 ring-ink-line">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">💎 캐시로 이용</p>
              <p className="text-xs text-ink-mute" data-cash={cash}>
                보유 💎 {cash}
              </p>
            </div>
            <p className="mt-1 text-[11px] text-ink-mute">
              보이스톡 💎{CASH_PRICE.voicePerMinute}/분 · 실시간 사진 💎{CASH_PRICE.photo}/장
            </p>
            <div className="mt-2.5 flex gap-2">
              {onCashCall && (
                <button
                  type="button"
                  disabled={!canCashCall}
                  onClick={onCashCall}
                  data-cash-call
                  className="flex-[1.3] rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 py-2 text-xs font-bold text-white disabled:opacity-40"
                >
                  💎{CASH_PRICE.voicePerMinute}/분으로 통화하기
                </button>
              )}
              <button type="button" onClick={onTopUp} className="flex-1 rounded-xl bg-amber-400 py-2 text-xs font-bold text-slate-900">
                충전 +{DEMO_TOPUP} (테스트)
              </button>
            </div>
          </div>
          <p className="px-1 text-center text-[10px] leading-relaxed text-ink-mute/80">
            결제 연동 전 테스트 화면이에요. 구독·충전은 이 기기에만 적용돼요.
          </p>
        </div>
      </div>
    </div>
  );
}
