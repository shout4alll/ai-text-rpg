"use client";

import PersonaPortrait from "@/components/PersonaPortrait";
import type { Persona } from "@/lib/personas/types";

/**
 * 💋 매혹 모드 첫 사용 안내 + 성인 확인 (한 번만, 기기에 기억).
 * ▶ 결제·로그인 연동 시 본인인증(성인 인증)으로 바꾸는 것을 권장 (docs/ALLURE_MODE.md)
 */
export default function AllureGateModal({
  persona,
  onConfirm,
  onCancel,
}: {
  persona: Persona;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ui = persona.allureUi ?? { emoji: "💋", label: "매혹 모드" };
  const male = persona.profile.gender === "male";
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="allure-title"
      data-allure-gate
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-3xl bg-slate-900 text-white shadow-2xl ring-1 ring-rose-400/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 bg-gradient-to-r from-rose-600/40 to-fuchsia-600/30 px-5 py-4">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl ring-2 ring-rose-300/60">
            <PersonaPortrait persona={persona} size="sm" className="h-full w-full" />
          </div>
          <div className="min-w-0">
            <p id="allure-title" className="text-base font-bold">
              {ui.emoji} {ui.label}
            </p>
            <p className="text-xs text-white/75">{persona.name} 님이 {male ? "한 걸음 더 다가와요" : "조금 더 대담해져요"}</p>
          </div>
        </div>

        <div className="space-y-2.5 px-5 py-4 text-sm text-white/85">
          <ul className="space-y-1.5 text-[13px]">
            <li>{male ? "✨ 다정하게 리드하는 말투, 설레는 챙김" : "✨ 은근하고 여유로운 말투, 밀당하는 대화"}</li>
            <li>{male ? "🎬 눈 맞춤·낮은 웃음 같은 전용 리액션 영상" : "🎬 그윽한 눈빛·미소 같은 전용 리액션 영상"}</li>
            <li>🔁 언제든 같은 버튼으로 끌 수 있어요</li>
          </ul>
          <p className="rounded-2xl bg-white/5 px-3.5 py-2.5 text-[11px] leading-relaxed text-white/55">
            분위기를 즐기는 모드예요. 노출이나 노골적인 성적 표현은 나오지 않아요. 만 19세 이상만 이용할 수 있어요.
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
          <button
            type="button"
            onClick={onConfirm}
            data-allure-confirm
            className="flex-[1.6] rounded-2xl bg-gradient-to-r from-rose-500 to-fuchsia-500 py-3 text-sm font-bold text-white shadow-lg hover:brightness-110"
          >
            만 19세 이상이에요 · 켜기
          </button>
        </div>
      </div>
    </div>
  );
}
