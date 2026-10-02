"use client";

import { useEffect, useRef, useState } from "react";
import {
  AVATAR_CLIPS_BASE,
  AVATAR_CLIP_EXT,
  AVATAR_OBJECT_POSITION,
  AVATAR_POSTER_URL,
} from "@/lib/avatarConfig";
import type { AvatarAnimation, Emotion } from "@/types/game";

/**
 * 실사 영상 아바타.
 *
 * - idle 클립이 항상 루프 재생된다 (맨 아래 레이어).
 * - 응답이 올 때마다 animation/emotion 에 맞는 이벤트 클립을 위 레이어에 한 번 재생하고,
 *   끝나면 페이드아웃해서 idle 로 돌아온다. (클립의 첫/마지막 프레임이 idle 자세와 같아야 자연스럽다)
 * - 클립 파일이 없으면 해당 클립만 건너뛰고, idle 도 없으면 정지 이미지(+미세 호흡)로 대체한다.
 */

const CLIP_NAMES = ["idle", "nod", "shake", "surprised", "happy", "sad", "angry"] as const;
type ClipName = (typeof CLIP_NAMES)[number];

interface VideoAvatarProps {
  animation: AvatarAnimation;
  /** 같은 응답이 연속으로 와도 다시 재생되도록 하는 트리거 카운터 */
  animationKey: number;
  emotion: Emotion;
}

/** emotion 키는 happy/sad/angry/surprised 가 곧 클립 이름이다. */
function emotionClip(emotion: Emotion): ClipName | null {
  return emotion === "neutral" ? null : emotion;
}

/** API 응답의 (animation, emotion) → 재생할 이벤트 클립 */
function pickClip(animation: AvatarAnimation, emotion: Emotion): ClipName | null {
  switch (animation) {
    case "nod":
      return "nod";
    case "shake":
      return "shake";
    case "jump":
      // 실사 인물은 점프 대신 '놀람/기쁨' 리액션으로 표현
      return emotion === "happy" ? "happy" : "surprised";
    default:
      return emotionClip(emotion);
  }
}

type Flags = Partial<Record<ClipName, boolean>>;

export default function VideoAvatar({ animation, animationKey, emotion }: VideoAvatarProps) {
  const videoRefs = useRef<Partial<Record<ClipName, HTMLVideoElement | null>>>({});
  const [ready, setReady] = useState<Flags>({});
  const [failed, setFailed] = useState<Flags>({});
  const [active, setActive] = useState<ClipName | null>(null);

  // 이펙트 안에서 최신 값을 읽기 위한 ref (deps 를 animationKey 하나로 유지)
  const latest = useRef({ animation, emotion, ready });
  latest.current = { animation, emotion, ready };

  useEffect(() => {
    if (animationKey === 0) return; // 초기 마운트는 무시
    const { animation, emotion, ready } = latest.current;

    const candidates = [pickClip(animation, emotion), emotionClip(emotion)];
    const clip = candidates.find((c): c is ClipName => !!c && c !== "idle" && ready[c] === true);
    if (!clip) return;

    const video = videoRefs.current[clip];
    if (!video) return;

    // 다른 이벤트 클립이 재생 중이면 정리
    for (const name of CLIP_NAMES) {
      if (name !== "idle" && name !== clip) videoRefs.current[name]?.pause();
    }
    video.currentTime = 0;
    video.play().catch(() => {
      /* 자동재생 차단 등: 이벤트 클립만 생략 */
    });
    setActive(clip);
  }, [animationKey]);

  const objectStyle = { objectPosition: AVATAR_OBJECT_POSITION };

  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-950">
      {/* 폴백: 클립 로딩 전/없을 때 정지 이미지 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={AVATAR_POSTER_URL}
        alt=""
        className={`absolute inset-0 h-full w-full object-cover ${ready.idle ? "" : "avatar-breathe"}`}
        style={objectStyle}
      />

      {CLIP_NAMES.filter((name) => !failed[name]).map((name) => {
        const isIdle = name === "idle";
        const visible = isIdle ? !!ready.idle : active === name;
        const markReady = () => setReady((r) => (r[name] ? r : { ...r, [name]: true }));
        return (
          <video
            key={name}
            ref={(el) => {
              videoRefs.current[name] = el;
            }}
            src={`${AVATAR_CLIPS_BASE}/${name}.${AVATAR_CLIP_EXT}`}
            data-clip={name}
            muted
            playsInline
            preload="auto"
            loop={isIdle}
            autoPlay={isIdle}
            onLoadedData={markReady}
            onCanPlay={markReady}
            onError={() => setFailed((f) => ({ ...f, [name]: true }))}
            onEnded={isIdle ? undefined : () => setActive((a) => (a === name ? null : a))}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-200"
            style={{ ...objectStyle, opacity: visible ? 1 : 0 }}
          />
        );
      })}

      {/* 상단 HP 표시 가독성용 그라데이션 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />
    </div>
  );
}
