"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import Avatar from "@/components/Avatar";
import AvatarBoundary from "@/components/AvatarBoundary";
import CubeAvatar from "@/components/CubeAvatar";
import { FLOOR_Y } from "@/lib/avatarConfig";
import type { AvatarAnimation, Emotion } from "@/types/game";

interface AvatarSceneProps {
  animation: AvatarAnimation;
  animationKey: number;
  emotion: Emotion;
}

export default function AvatarScene(props: AvatarSceneProps) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0.3, 4.6], fov: 40 }}>
      <color attach="background" args={["#0f172a"]} />
      <hemisphereLight args={["#cbd5e1", "#1e293b", 0.7]} />
      <directionalLight position={[3, 5, 2]} intensity={1.4} castShadow />
      <directionalLight position={[-3, 2, -2]} intensity={0.4} />

      <AvatarBoundary fallback={<CubeAvatar {...props} />}>
        <Suspense fallback={null}>
          <Avatar {...props} />
        </Suspense>
      </AvatarBoundary>

      {/* 바닥 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
    </Canvas>
  );
}
