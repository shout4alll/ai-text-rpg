"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color } from "three";
import type { Mesh, MeshStandardMaterial } from "three";
import { sampleMotion, useActionClock } from "@/lib/avatarMotion";
import { FLOOR_Y } from "@/lib/avatarConfig";
import type { AvatarAnimation, Emotion } from "@/types/game";

interface CubeAvatarProps {
  animation: AvatarAnimation;
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

/** 모델 로드 실패 시 쓰이는 폴백 (기존 큐브 아바타). */
export default function CubeAvatar({ animation, animationKey, emotion }: CubeAvatarProps) {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<MeshStandardMaterial>(null);
  const targetColor = useMemo(() => new Color(), []);
  const elapsedOf = useActionClock(animationKey);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    const m = animation === "idle" ? sampleMotion("idle", 0) : sampleMotion(animation, elapsedOf(t));

    mesh.position.y = FLOOR_Y + 0.7 + Math.sin(t * 2) * 0.03 + m.bodyY;
    mesh.position.x = m.headYaw * 0.5;
    mesh.rotation.x = m.headPitch;
    mesh.rotation.y += 0.003;
    materialRef.current?.color.lerp(targetColor.set(EMOTION_COLORS[emotion]), 0.1);
  });

  return (
    <mesh ref={meshRef} castShadow position={[0, FLOOR_Y + 0.7, 0]}>
      <boxGeometry args={[1, 1.4, 1]} />
      <meshStandardMaterial ref={materialRef} color={EMOTION_COLORS[emotion]} />
    </mesh>
  );
}
