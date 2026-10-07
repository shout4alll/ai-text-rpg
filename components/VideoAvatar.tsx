"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PersonaPortrait from "@/components/PersonaPortrait";
import type { Motion, ReactionCue } from "@/config/reactions";
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
  /** 재생할 반응 (AI 리액션 또는 터치 리액션) */
  cue: ReactionCue | null;
  /** 같은 반응이 연속으로 와도 다시 재생되도록 하는 트리거 카운터 */
  reactionKey: number;
  /**
   * 보이스톡에서 상대가 말하는 중.
   * clips 에 "talk" 영상이 있으면 idle 대신 talk 루프를 보여 주고, 없으면 미세한 말하기 모션을 준다.
   */
  speaking?: boolean;
  /** 유료 리액션 영상(clips/premium) 사용 가능 */
  premium?: boolean;
  /** 💋 매혹 모드 영상(clips/allure) 사용 */
  allure?: boolean;
  /** 리액션 영상의 소리(목소리·웃음소리) 켜기. idle 루프는 항상 무음 */
  sound?: boolean;
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

/** 계속 반복 재생하는 클립 (이벤트가 끝나면 이 중 하나로 돌아온다) */
const LOOPS = new Set(["idle", "talk"]);
/** 영상 전환 페이드 (ms) — 클립마다 첫 장면이 조금씩 달라도 자연스럽게 이어지도록 */
const FADE_MS = 280;

export default function VideoAvatar({ persona, cue, reactionKey, speaking = false, premium = false, allure = false, sound = true }: VideoAvatarProps) {
  // { 이름: URL } — 실제로 있는 영상만 (유료 영상은 이용권이 있을 때만 섞는다)
  const clips = useMemo(
    () => ({
      ...persona.assets.clips,
      ...(premium ? persona.assets.premiumClips : {}),
      ...(allure ? persona.assets.allureClips ?? {} : {}),
    }),
    [persona, premium, allure]
  );
  const names = Object.keys(clips);
  const position = persona.assets.stagePoster ? persona.assets.stagePosition : persona.assets.objectPosition;

  const mediaRef = useRef<HTMLDivElement>(null);
  const tintRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<string | null>(null);
  /** 끝나도 마지막 장면에 멈춰 있을 클립 (등 돌림 등) */
  const holdRef = useRef<string | null>(null);

  useEffect(() => setMounted(true), []);

  const latest = useRef({ cue, ready, names, sound });
  latest.current = { cue, ready, names, sound };

  /*
   * 소리 잠금 해제: 브라우저(특히 iOS)는 사용자 동작 없이 소리 나는 재생을 막는다.
   * 첫 터치/키 입력 때 이벤트 클립들을 소리 켠 채 한 번 재생→즉시 정지해 두면, 이후 AI 답장에도 소리가 난다.
   */
  const unlocked = useRef(false);
  useEffect(() => {
    if (!sound) return;
    const unlock = () => {
      if (unlocked.current) return;
      unlocked.current = true;
      for (const [n, v] of Object.entries(videoRefs.current)) {
        if (!v || LOOPS.has(n) || !v.paused) continue;
        v.muted = false;
        v.play()
          .then(() => {
            if (!v.dataset.playing) {
              v.pause();
              v.currentTime = 0;
            }
          })
          .catch(() => {
            v.muted = true;
          });
      }
    };
    window.addEventListener("pointerdown", unlock, { once: true, capture: true });
    window.addEventListener("keydown", unlock, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", unlock, { capture: true });
      window.removeEventListener("keydown", unlock, { capture: true });
    };
  }, [sound]);

  useEffect(() => {
    if (reactionKey === 0) return;
    const { cue: def, ready, names, sound } = latest.current;
    if (!def) return;

    // 색감 효과
    if (def.tint && tintRef.current) {
      tintRef.current.style.background = def.tint;
      tintRef.current.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 1800, easing: "ease-in-out" });
    }

    // 영상: clips 순서대로 "준비된" 것 하나 → 즉시 재생 (모든 클립은 미리 받아 첫 장면에서 대기 중)
    const clip = def.clips.find((c) => !LOOPS.has(c) && ready[c]);
    const video = clip ? videoRefs.current[clip] : null;
    if (clip && video) {
      for (const n of names) {
        const other = videoRefs.current[n];
        if (other && !LOOPS.has(n) && n !== clip) {
          other.pause();
          delete other.dataset.playing;
        }
      }
      holdRef.current = def.hold ? clip : null;
      video.currentTime = 0;
      video.dataset.playing = "1";
      video.muted = !sound;
      video.volume = 0.9;
      // 소리 재생이 막히면(사용자 동작 전) 무음으로라도 즉시 재생
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => {});
      });
      setActive(clip);
      return;
    }

    // 영상이 없거나 연출상 움직임만: 멈춰 있던 장면(등 돌림)은 풀고 화면 움직임
    if (holdRef.current) {
      holdRef.current = null;
      setActive(null);
    }
    if (def.motion !== "none" && mediaRef.current) {
      // 연속 터치 시 이전 움직임이 겹치지 않도록 정리
      for (const a of mediaRef.current.getAnimations()) a.cancel();
      const m = MOTIONS[def.motion as Exclude<Motion, "none">];
      mediaRef.current.animate(m.frames, { duration: m.duration, easing: "ease-in-out" });
    }
  }, [reactionKey]);

  // 소리 끄기를 누르면 재생 중인 클립도 바로 음소거
  useEffect(() => {
    if (sound) return;
    for (const v of Object.values(videoRefs.current)) if (v) v.muted = true;
  }, [sound]);

  // 상위에서 cue 를 비우면(null) 멈춰 있던 장면을 풀고 기본 화면으로 돌아간다
  useEffect(() => {
    if (cue === null && holdRef.current) {
      holdRef.current = null;
      setActive(null);
    }
  }, [cue, reactionKey]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-950" data-reaction-stage data-active-clip={active ?? ""}>
      <div ref={mediaRef} className="absolute inset-0" style={{ transform: BASE }}>
        {/* 말하기 모션: talk 영상이 없을 때만 (안쪽 래퍼에 줘서 리액션 움직임과 겹치지 않게) */}
        <div className={`absolute inset-0 ${speaking && !ready.talk ? "avatar-talk" : ""}`}>
          {persona.assets.stagePoster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={persona.assets.stagePoster}
              alt={persona.name}
              className={`absolute inset-0 h-full w-full object-cover ${ready.idle ? "" : "avatar-breathe"}`}
              style={{ objectPosition: position }}
            />
          ) : (
            <PersonaPortrait
              persona={persona}
              className="absolute inset-0 h-full w-full"
              imgClassName={ready.idle ? "" : "avatar-breathe"}
            />
          )}

          {mounted &&
            names.map((name) => {
              const isIdle = name === "idle";
              const isTalk = name === "talk";
              const loop = isIdle || isTalk;
              // talk 루프는 말하는 중에만, idle 은 그 외에 (이벤트 클립이 재생 중이면 그게 위에 덮인다)
              const talkOn = speaking && !!ready.talk;
              const visible = isTalk ? talkOn && !active : isIdle ? !!ready.idle : active === name;
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
                  disablePictureInPicture
                  loop={loop}
                  autoPlay={loop}
                  onLoadedData={markReady}
                  onCanPlay={markReady}
                  onEnded={
                    loop
                      ? undefined
                      : () => {
                          const v = videoRefs.current[name];
                          if (v) delete v.dataset.playing;
                          if (holdRef.current === name) return; // 마지막 장면에서 멈춤 유지
                          setActive((a) => (a === name ? null : a));
                        }
                  }
                  className="absolute inset-0 h-full w-full object-cover transition-opacity ease-out"
                  style={{
                    objectPosition: position,
                    opacity: visible ? 1 : 0,
                    transitionDuration: `${FADE_MS}ms`,
                    // 겹침 순서: idle < talk < 이벤트 클립
                    zIndex: isIdle ? 0 : isTalk ? 1 : 2,
                  }}
                />
              );
            })}
        </div>
      </div>
      <div ref={tintRef} className="pointer-events-none absolute inset-0 opacity-0 mix-blend-soft-light" />
    </div>
  );
}
