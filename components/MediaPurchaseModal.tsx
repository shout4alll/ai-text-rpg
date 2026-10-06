"use client";

import PersonaPortrait from "@/components/PersonaPortrait";
import { DEMO_TOPUP } from "@/config/media";
import type { Persona } from "@/lib/personas/types";

/**
 * 유료 실시간 사진 확인 모달 (채팅 말풍선이 아닌 앱 안내).
 * 인물이 "잠깐만요, 찍어 볼게요" 라고 답한 뒤 뜬다 → 확인하면 캐시 차감 후 사진 생성.
 */
export default function MediaPurchaseModal({
  persona,
  request,
  cost,
  cash,
  onConfirm,
  onCancel,
  onTopUp,
  planPhotosLeft = 0,
  planName = "",
  onShowPlans,
}: {
  persona: Persona;
  /** 유저가 원한 장면 */
  request: string;
  cost: number;
  cash: number;
  onConfirm: () => void;
  onCancel: () => void;
  /** 테스트용 충전 (결제 연동 전) */
  onTopUp: () => void;
  /** 구독으로 받은 이번 달 남은 사진 */
  planPhotosLeft?: number;
  planName?: string;
  onShowPlans?: () => void;
}) {
  const byPlan = planPhotosLeft > 0;
  const enough = byPlan || cash >= cost;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-modal-title"
      data-media-modal
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-3xl bg-slate-900 text-white shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 bg-gradient-to-r from-pink-500/25 to-violet-500/25 px-5 py-4">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl ring-2 ring-pink-300/60">
            <PersonaPortrait persona={persona} size="sm" className="h-full w-full" />
          </div>
          <div className="min-w-0">
            <p id="media-modal-title" className="text-base font-bold">
              📸 {persona.name}의 실시간 사진
            </p>
            <p className="text-xs text-white/70">앨범에 없는, 지금 이 순간의 모습을 새로 받아요</p>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm">
          <div className="rounded-2xl bg-white/5 px-3.5 py-2.5">
            <p className="text-[11px] text-white/50">요청한 모습</p>
            <p className="mt-0.5 line-clamp-3 text-white/90">{request}</p>
          </div>
          {byPlan ? (
            <div className="flex items-center justify-between" data-plan-photos={planPhotosLeft}>
              <span className="text-white/70">👑 {planName} 혜택</span>
              <span className="font-semibold text-amber-300">이번 달 {planPhotosLeft}장 남음</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-white/70">사용 캐시</span>
                <span className="font-semibold text-pink-300">💎 {cost}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/70">보유 캐시</span>
                <span className={`font-semibold ${enough ? "text-white" : "text-rose-400"}`} data-cash={cash}>
                  💎 {cash}
                </span>
              </div>
              {onShowPlans && (
                <button type="button" onClick={onShowPlans} className="w-full text-left text-[11px] text-pink-300 underline-offset-2 hover:underline">
                  👑 멤버십이면 매달 사진을 받을 수 있어요 →
                </button>
              )}
            </>
          )}
          <p className="text-[11px] leading-relaxed text-white/45">
            AI가 {persona.name}의 사진을 바탕으로 만든 이미지예요. 사진을 만들지 못하면 캐시는 돌려드려요.
          </p>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl bg-white/10 py-3 text-sm font-medium text-white/85 hover:bg-white/15"
          >
            다음에
          </button>
          {enough ? (
            <button
              type="button"
              onClick={onConfirm}
              data-media-confirm
              className="flex-[1.4] rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 py-3 text-sm font-bold text-white shadow-lg hover:brightness-110"
            >
              {byPlan ? "구독 혜택으로 받기" : `💎 ${cost} 쓰고 받기`}
            </button>
          ) : (
            <button
              type="button"
              onClick={onTopUp}
              className="flex-[1.4] rounded-2xl bg-amber-400 py-3 text-sm font-bold text-slate-900 hover:brightness-105"
            >
              캐시 충전 (+{DEMO_TOPUP} 테스트)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
