import { useRef } from "react";
import type { AvatarAnimation } from "@/types/game";

/** 이벤트성 동작(jump/nod/shake)의 시간 기반 샘플링. 아바타 구현(큐브/GLB)과 무관하게 공유한다. */

export interface MotionSample {
  /** 몸 전체의 수직 이동 (m) */
  bodyY: number;
  /** 고개 끄덕임 (rad, +면 앞으로 숙임) */
  headPitch: number;
  /** 고개 도리도리 (rad) */
  headYaw: number;
}

const JUMP_DURATION = 0.9;
const JUMP_HEIGHT = 0.3;
const NOD_DURATION = 1.0;
const NOD_ANGLE = 0.35;
const SHAKE_DURATION = 0.9;
const SHAKE_ANGLE = 0.5;

const ZERO: MotionSample = { bodyY: 0, headPitch: 0, headYaw: 0 };

export function sampleMotion(
  animation: AvatarAnimation,
  elapsed: number
): MotionSample {
  if (animation === "jump" && elapsed < JUMP_DURATION) {
    const p = elapsed / JUMP_DURATION;
    return { ...ZERO, bodyY: Math.sin(p * Math.PI) * JUMP_HEIGHT };
  }
  if (animation === "nod" && elapsed < NOD_DURATION) {
    const p = elapsed / NOD_DURATION;
    return { ...ZERO, headPitch: Math.sin(p * Math.PI * 4) * NOD_ANGLE * (1 - p) };
  }
  if (animation === "shake" && elapsed < SHAKE_DURATION) {
    const p = elapsed / SHAKE_DURATION;
    return { ...ZERO, headYaw: Math.sin(p * Math.PI * 6) * SHAKE_ANGLE * (1 - p) };
  }
  return ZERO;
}

/**
 * animationKey 가 바뀔 때마다 시작 시각을 리셋해, 같은 동작이 연속으로 와도 다시 재생되게 한다.
 * 반환 함수에 현재 시계(초)를 넣으면 이번 동작의 경과 시간을 돌려준다.
 */
export function useActionClock(animationKey: number) {
  const ref = useRef<{ key: number; start: number | null }>({ key: -1, start: null });
  if (ref.current.key !== animationKey) {
    ref.current = { key: animationKey, start: null };
  }
  return (clock: number) => {
    if (ref.current.start === null) ref.current.start = clock;
    return clock - ref.current.start;
  };
}
