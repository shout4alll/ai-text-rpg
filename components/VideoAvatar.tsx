"use client";

import { useEffect, useRef, useState } from "react";
import PersonaPortrait from "@/components/PersonaPortrait";
import { AVATAR_REACTIONS, type AvatarReactionId, type Motion } from "@/config/reactions";
import type { Persona } from "@/lib/personas/types";

/**
 * 실사 리액션 화면 (인물별).
 *
 * 레이어 (아래 → 위)
 *   1. 정지 이미지: poster → fallbackPoster → 텍스트 카드
 *   2. idle 영상 루프 (있으면)
 *   3. 리액션 영상 (응답마다 한 번 재생 후 페이드아웃)
 *   4. 색감 효과 (tint)
 *
 * 리액션이 오면 config/reactions.ts 의 clips 순서대로 "존재하는 영상"을 찾아 재생하고,
 * 하나도 없으면 motion(화면 움직임)으로 대체한다. → 영상 파일만 추가하면 자동으로 영상으로 바뀐다.
 *
 * 인물이 바뀌면 상위에서 key 로 통째로 다시 마운트한다.
 */

interface VideoAvatarProps {
  persona: Persona;
  reaction: AvatarReactionId;
  /** 같은 리액션이 연속으로 와도 다시 재생되도록 하는 트리거 카운터 */
  reactionKey: number;
}

const BASE = "scale(1.04)"; // 이동 시 가장자리가 비지 않도록 살짝 확대한 상태가 기본
const ty = (ys: number[]) => ys.map((y) => ({ transform: `translateY(${y}px) ${BASE}` }));
const tx = (xs: number[]) => xs.map((x) => ({ transform: `translateX(${x}px) ${BASE}` }));

const MOTIONS: Record<Exclude<Motion, "none">, { frames: Keyframe[]; duration: number }> = {
  nod: { duration: 900, frames: ty([0, 14, 0, 9, 0]) },
  nodSoft: { duration: 1100, frames: ty([0, 7, 0]) },
  shake: { duration: 800, frames: tx([0, -14, 14, -9, 9, 0]) },
  bounce: { duration: 700, frames: ty([0, -14, 0, -8, 0]) },
  pop: { duration: 600, frames: [{ transform: BASE }, { transform: "scale(1.09)" }, { transform: BASE }] },
  popSoft: { duration: 900, frames: [{ transform: BASE }, { transform: "scale(1.065)" }, { transform: BASE }] },
  tilt: {
    duration: 1200,
    frames: [{ transform: `rotate(0deg) ${BASE}` }, { transform: `rotate(-1.6deg) scale(1.06)` }, { transform: `rotate(0deg) ${BASE}` }],
  },
  sway: {
    duration: 1000,
    frames: [0, -8, 8, -5, 0].map((x, i) => ({ transform: `translateX(${x}px) rotate(${i % 2 ? 1 : -1}deg) ${BASE}` })),
  },
  sink: {
    duration: 1500,
    frames: [
      { transform: BASE, filter: "saturate(1) brightness(1)" },
      { transform: `translateY(8px) ${BASE}`, filter: "saturate(0.6) brightness(0.85)" },
      { transform: BASE, filter: "saturate(1) brightness(1)" },
    ],
  },
  sinkSoft: { duration: 1400, frames: ty([0, 6, 0]) },
};

export default function VideoAvatar({ persona, reaction, reactionKey }: VideoAvatarProps) {
  const clips = persona.assets.clips; // { 이름: URL } — 실제로 있는 영상만
  const names = Object.keys(clips);

  const mediaRef = useRef<HTMLDivElement>(null);
  const tintRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const latest = useRef({ reaction, ready });
  latest.current = { reaction, ready };

  useEffect(() => {
    if (reactionKey === 0) return;
    const { reaction, ready } = latest.current;
    const def = AVATAR_REACTIONS[reaction] ?? AVATAR_REACTIONS.idle;
    if (reaction === "idle") return;

    // 색감 효과
    if (def.tint && tintRef.current) {
      tintRef.current.style.background = def.tint;
      tintRef.current.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 1800, easing: "ease-in-out" });
    }

    // 영상: clips 순서대로 준비된 것 하나
    const clip = def.clips.find((c) => c !== "idle" && ready[c]);
    const video = clip ? videoRefs.current[clip] : null;
    if (clip && video) {
      for (const n of names) if (n !== "idle" && n !== clip) videoRefs.current[n]?.pause();
      video.currentTime = 0;
      video.play().catch(() => {});
      setActive(clip);
      return;
    }

    // 영상이 없으면 화면 움직임
    if (def.motion !== "none") {
      const m = MOTIONS[def.motion];
      mediaRef.current?.animate(m.frames, { duration: m.duration, easing: "ease-in-out" });
    }
    // names 는 persona 별로 고정(상위에서 key 로 재마운트)이라 의존성에서 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactionKey]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-950" data-reaction-stage>
      <div ref={mediaRef} className="absolute inset-0" style={{ transform: BASE }}>
        <PersonaPortrait
          persona={persona}
          className="absolute inset-0 h-full w-full"
          imgClassName={ready.idle ? "" : "avatar-breathe"}
        />

        {mounted &&
          names.map((name) => {
            const isIdle = name === "idle";
            const visible = isIdle ? !!ready.idle : active === name;
            const markReady = () => setReady((r) => (r[name] ? r : { ...r, [name]: true }));
            return (
              <video
                key={name}
                ref={(el) => {
                  videoRefs.current[name] = el;
                }}
                src={clips[name]}
                data-clip={name}
                muted
                playsInline
                preload="auto"
                loop={isIdle}
                autoPlay={isIdle}
                onLoadedData={markReady}
                onCanPlay={markReady}
                onEnded={isIdle ? undefined : () => setActive((a) => (a === name ? null : a))}
                className="absolute inset-0 h-full w-full object-cover transition-opacity duration-200"
                style={{ objectPosition: persona.assets.objectPosition, opacity: visible ? 1 : 0 }}
              />
            );
          })}
      </div>
      <div ref={tintRef} className="pointer-events-none absolute inset-0 opacity-0 mix-blend-soft-light" />
    </div>
  );
}
