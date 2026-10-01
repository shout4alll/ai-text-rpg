"use client";

import { Canvas } from "@react-three/fiber";
import Avatar from "@/components/Avatar";
import type { AvatarAnimation, Emotion } from "@/types/game";

interface AvatarSceneProps {
  animation: AvatarAnimation;
  animationKey: number;
  emotion: Emotion;
}

export default function AvatarScene(props: AvatarSceneProps) {
  return (
    <Canvas shadows camera={{ position: [0, 1.2, 4], fov: 50 }}>
      <color attach="background" args={["#0f172a"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 2]} intensity={1.2} castShadow />

      <Avatar {...props} />

      {/* 바닥 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.7, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
    </Canvas>
  );
}
