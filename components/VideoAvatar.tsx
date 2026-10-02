"use client";

import { useEffect, useRef, useState } from "react";
import PersonaPortrait from "@/components/PersonaPortrait";
import { AVATAR_CLIP_EXT } from "@/lib/avatarConfig";
import type { Persona } from "@/config/personas";
import type { AvatarAnimation, Emotion } from "@/types/game";

/**
 * 실사 영상 아바타 (페르소나별).
 *
 * 레이어 (아래 → 위)
 *   1. 정지 이미지: poster → fallbackPoster → 텍스트 카드  (PersonaPortrait)
 *   2. idle 클립 루프
 *   3. 이벤트 클립 (응답마다 한 번 재생 후 페이드아웃)
 *
 * 클립 경로 폴백: persona.clipsDir → persona.fallbackClipsDir(같은 인물만) → 없음
 * 이벤트 클립이 없으면 화면 전체에 가벼운 CSS 리액션(끄덕/도리도리/놀람)으로 대체한다.
 *
 * 페르소나가 바뀌면 상위에서 key 로 이 컴포넌트를 통째로 다시 마운트한다 (상태 초기화).
 */

const CLIP_NAMES = ["idle", "nod", "shake", "surprised", "happy", "sad", "angry"] as const;
type ClipName = (typeof CLIP_NAMES)[number];
type EventClip = Exclude<ClipName, "idle">;

interface VideoAvatarProps {
  persona: Persona;
  animation: AvatarAnimation;
  /** 같은 응답이 연속으로 와도 다시 재생되도록 하는 트리거 카운터 */
  animationKey: number;
  emotion: Emotion;
}

function emotionClip(emotion: Emotion): EventClip | null {
  return emotion === "neutral" ? null : emotion;
}

/** API 응답의 (animation, emotion) → 재생할 이벤트 클립 */
function pickClip(animation: AvatarAnimation, emotion: Emotion): EventClip | null {
  switch (animation) {
    case "nod":
      return "nod";
    case "shake":
      return "shake";
    case "jump":
      return emotion === "happy" ? "happy" : "surprised";
    default:
      return emotionClip(emotion);
  }
}

/* 클립이 없을 때의 대체 리액션 (Web Animations API) */
const BASE = "scale(1.04)"; // 이동 시 가장자리가 비지 않도록 살짝 확대한 상태가 기본
const REACTIONS: Record<EventClip, { frames: Keyframe[]; duration: number }> = {
  nod: {
    duration: 900,
    frames: [0, 14, 0, 9, 0].map((y) => ({ transform: `translateY(${y}px) ${BASE}` })),
  },
  shake: {
    duration: 800,
    frames: [0, -14, 14, -9, 9, 0].map((x) => ({ transform: `translateX(${x}px) ${BASE}` })),
  },
  surprised: {
    duration: 600,
    frames: [{ transform: BASE }, { transform: "scale(1.09)" }, { transform: BASE }],
  },
  happy: {
    duration: 700,
    frames: [0, -10, 0, -6, 0].map((y) => ({ transform: `translateY(${y}px) ${BASE}` })),
  },
  sad: {
    duration: 1400,
    frames: [
      { transform: BASE, filter: "saturate(1) brightness(1)" },
      { transform: `translateY(8px) ${BASE}`, filter: "saturate(0.6) brightness(0.85)" },
      { transform: BASE, filter: "saturate(1) brightness(1)" },
    ],
  },
  angry: {
    duration: 500,
    frames: [0, -6, 6, -6, 6, 0].map((x) => ({ transform: `translateX(${x}px) ${BASE}` })),
  },
};

type Flags = Partial<Record<ClipName, boolean>>;

export default function VideoAvatar({ persona, animation, animationKey, emotion }: VideoAvatarProps) {
  const clipDirs = [persona.assets.clipsDir, persona.assets.fallbackClipsDir].filter(
    (d): d is string => !!d
  );

  const mediaRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Partial<Record<ClipName, HTMLVideoElement | null>>>({});
  // 클라이언트 마운트 후에만 <video> 를 렌더 → 하이드레이션 전에 error 이벤트를 놓치지 않음
  const [mounted, setMounted] = useState(false);
  const [dirIndex, setDirIndex] = useState<Partial<Record<ClipName, number>>>({});
  const [ready, setReady] = useState<Flags>({});
  const [active, setActive] = useState<EventClip | null>(null);

  useEffect(() => setMounted(true), []);

  const latest = useRef({ animation, emotion, ready });
  latest.current = { animation, emotion, ready };

  useEffect(() => {
    if (animationKey === 0) return;
    const { animation, emotion, ready } = latest.current;

    const wanted = pickClip(animation, emotion);
    if (!wanted) return;

    const candidates = [wanted, emotionClip(emotion)];
    const clip = candidates.find((c): c is EventClip => !!c && ready[c] === true);
    const video = clip ? videoRefs.current[clip] : null;

    if (!clip || !video) {
      // 클립이 없으면 CSS 리액션으로 대체
      const r = REACTIONS[wanted];
      mediaRef.current?.animate(r.frames, { duration: r.duration, easing: "ease-in-out" });
      return;
    }

    for (const name of CLIP_NAMES) {
      if (name !== "idle" && name !== clip) videoRefs.current[name]?.pause();
    }
    video.currentTime = 0;
    video.play().catch(() => {
      /* 자동재생 차단 등: 이벤트 클립만 생략 */
    });
    setActive(clip);
  }, [animationKey]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-950">
      <div ref={mediaRef} className="absolute inset-0" style={{ transform: BASE }}>
        <PersonaPortrait
          persona={persona}
          className="absolute inset-0 h-full w-full"
          imgClassName={ready.idle ? "" : "avatar-breathe"}
        />

        {mounted &&
          CLIP_NAMES.map((name) => {
            const idx = dirIndex[name] ?? 0;
            if (idx >= clipDirs.length) return null; // 모든 폴더에 없음
            const isIdle = name === "idle";
            const visible = isIdle ? !!ready.idle : active === name;
            const markReady = () => setReady((r) => (r[name] ? r : { ...r, [name]: true }));
            return (
              <video
                key={name}
                ref={(el) => {
                  videoRefs.current[name] = el;
                }}
                src={`${clipDirs[idx]}/${name}.${AVATAR_CLIP_EXT}`}
                data-clip={name}
                muted
                playsInline
                preload="auto"
                loop={isIdle}
                autoPlay={isIdle}
                onLoadedData={markReady}
                onCanPlay={markReady}
                onError={() => setDirIndex((d) => ({ ...d, [name]: (d[name] ?? 0) + 1 }))}
                onEnded={isIdle ? undefined : () => setActive((a) => (a === name ? null : a))}
                className="absolute inset-0 h-full w-full object-cover transition-opacity duration-200"
                style={{ objectPosition: persona.assets.objectPosition, opacity: visible ? 1 : 0 }}
              />
            );
          })}
      </div>

      {/* 상단 HP 표시 가독성용 그라데이션 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />
    </div>
  );
}
