"use client";

import { useState } from "react";
import type { Persona } from "@/lib/personas/types";

interface PersonaPortraitProps {
  persona: Persona;
  className?: string;
  /** img 에 추가할 클래스 (예: 호흡 애니메이션) */
  imgClassName?: string;
  /** 이미지가 모두 없을 때 보여줄 텍스트 크기 */
  size?: "sm" | "lg";
}

/**
 * 페르소나 정지 이미지.
 * poster → fallbackPoster(같은 인물) → 텍스트 카드(이니셜 + 이름) 순으로 폴백한다.
 */
export default function PersonaPortrait({
  persona,
  className = "",
  imgClassName = "",
  size = "lg",
}: PersonaPortraitProps) {
  const sources = [persona.assets.poster, persona.assets.fallbackPoster].filter(
    (s): s is string => !!s
  );
  const [index, setIndex] = useState(0);

  if (index >= sources.length) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-slate-900 text-center ${className}`}
        style={{ backgroundImage: `radial-gradient(circle at 50% 35%, ${persona.accent}33, transparent 70%)` }}
        aria-label={persona.name}
      >
        <span
          className={`flex items-center justify-center rounded-full font-bold text-slate-950 ${
            size === "lg" ? "h-24 w-24 text-4xl" : "h-full w-full text-sm"
          }`}
          style={{ backgroundColor: persona.accent }}
        >
          {persona.name.slice(0, 1)}
        </span>
        {size === "lg" && (
          <>
            <span className="text-lg font-semibold">{persona.name}</span>
            <span className="text-xs text-slate-400">이미지 준비 중</span>
          </>
        )}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={sources[index]}
      src={sources[index]}
      alt={persona.name}
      onError={() => setIndex((i) => i + 1)}
      className={`object-cover ${className} ${imgClassName}`}
      style={{ objectPosition: persona.assets.objectPosition }}
    />
  );
}
