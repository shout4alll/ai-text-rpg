"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color } from "three";
import type { Mesh, MeshStandardMaterial } from "three";
import type { AvatarAnimation, Emotion } from "@/types/game";

interface AvatarProps {
  animation: AvatarAnimation;
  /** 같은 animation이 연속으로 와도 다시 재생되도록 하는 트리거 카운터 */
  animationKey: number;
  emotion: Emotion;
}

const EMOTION_COLORS: Record<Emotion, string> = {
  neutral: "#94a3b8",
  happy: "#facc15",
  sad: "#60a5fa",
  angry: "#f87171",
  surprised: "#c084fc",
};

const BASE_Y = 0;
const JUMP_DURATION = 0.9; // seconds
const JUMP_HEIGHT = 1.2;
const NOD_DURATION = 1.0; // seconds
const NOD_ANGLE = 0.45; // radians
const SHAKE_DURATION = 0.8; // seconds
const SHAKE_DISTANCE = 0.25;

export default function Avatar({ animation, animationKey, emotion }: AvatarProps) {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<MeshStandardMaterial>(null);
  const targetColor = useMemo(() => new Color(), []);

  // 렌더 중 ref 비교로 새 애니메이션 트리거를 감지 (리렌더 없이 useFrame에서 처리)
  const startRef = useRef<{ key: number; time: number | null }>({
    key: -1,
    time: null,
  });
  if (startRef.current.key !== animationKey) {
    startRef.current = { key: animationKey, time: null };
  }

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // idle: 살짝 숨쉬는 느낌
    const t = state.clock.elapsedTime;
    let y = BASE_Y + Math.sin(t * 2) * 0.03;
    let rotX = 0;
    let x = 0;

    if (animation !== "idle") {
      if (startRef.current.time === null) startRef.current.time = t;
      const elapsed = t - startRef.current.time;

      if (animation === "jump" && elapsed < JUMP_DURATION) {
        const p = elapsed / JUMP_DURATION; // 0 → 1
        y = BASE_Y + Math.sin(p * Math.PI) * JUMP_HEIGHT; // 위로 갔다가 착지
      } else if (animation === "nod" && elapsed < NOD_DURATION) {
        const p = elapsed / NOD_DURATION;
        // 2회 까딱, 점점 감쇠
        rotX = Math.sin(p * Math.PI * 4) * NOD_ANGLE * (1 - p);
      } else if (animation === "shake" && elapsed < SHAKE_DURATION) {
        const p = elapsed / SHAKE_DURATION;
        // 좌우로 빠르게 흔들림 (부정/실패), 점점 감쇠
        x = Math.sin(p * Math.PI * 8) * SHAKE_DISTANCE * (1 - p);
      }
    }

    mesh.position.x = x;
    mesh.position.y = y;
    mesh.rotation.x = rotX;
    mesh.rotation.y += 0.003; // 완만한 회전으로 3D 느낌 부여

    // 감정에 따른 색상 부드럽게 전환
    materialRef.current?.color.lerp(targetColor.set(EMOTION_COLORS[emotion]), 0.1);
  });

  return (
    <mesh ref={meshRef} castShadow position={[0, BASE_Y, 0]}>
      <boxGeometry args={[1, 1.4, 1]} />
      <meshStandardMaterial ref={materialRef} color={EMOTION_COLORS[emotion]} />
    </mesh>
  );
}
