"use client";

import { useState } from "react";
import type { UserGender, UserProfile } from "@/lib/userProfile";

/**
 * 👋 첫 입장 — 성별과 호칭을 받는다 (호칭이 정해져 있어야 인물들이 "유저님" 같은 말 없이 이름으로 부른다).
 *  나중에 메뉴 › 내 정보에서 바꿀 수 있다.
 */
export default function OnboardingModal({ initial, onDone, onClose }: { initial?: UserProfile | null; onDone: (p: { name: string; gender: UserGender }) => void; onClose?: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [gender, setGender] = useState<UserGender | null>(initial?.gender ?? null);
  const ok = name.trim().length >= 1 && !!gender;

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/45 p-4 sm:items-center" data-onboarding>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ok && gender) onDone({ name: name.trim(), gender });
        }}
        className="w-full max-w-sm rounded-3xl bg-surface p-6 shadow-2xl ring-1 ring-ink-line"
      >
        <p className="text-lg font-bold text-ink">{initial ? "내 정보" : "반가워요 👋"}</p>
        <p className="mt-1 text-sm text-ink-mute">대화 상대들이 당신을 어떻게 부르면 될까요?</p>

        <label className="mt-5 block text-xs font-semibold text-ink-soft">불러 줄 이름 (호칭)</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 12))}
          placeholder="예) 민수, 지은"
          autoFocus
          data-onboarding-name
          className="mt-1.5 w-full rounded-xl bg-paper px-4 py-3 text-base text-ink ring-1 ring-ink-line focus:outline-none focus:ring-2 focus:ring-brand-400"
        />

        <p className="mt-4 text-xs font-semibold text-ink-soft">성별</p>
        <div className="mt-1.5 flex gap-2">
          {([
            ["male", "남성"],
            ["female", "여성"],
          ] as const).map(([g, label]) => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(g)}
              data-onboarding-gender={g}
              className={`flex-1 rounded-xl py-3 text-sm font-semibold ring-1 transition ${gender === g ? "bg-brand-500 text-onbrand ring-brand-500" : "bg-paper text-ink ring-ink-line"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex gap-2">
          {onClose && (
            <button type="button" onClick={onClose} className="flex-1 rounded-full bg-black/[0.06] py-3 text-sm font-semibold text-ink">
              닫기
            </button>
          )}
          <button type="submit" disabled={!ok} data-onboarding-ok className="flex-1 rounded-full bg-ink py-3 text-sm font-semibold text-white disabled:opacity-40">
            {initial ? "저장" : "시작하기"}
          </button>
        </div>
      </form>
    </div>
  );
}
