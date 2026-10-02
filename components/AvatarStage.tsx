"use client";

import dynamic from "next/dynamic";
import VideoAvatar from "@/components/VideoAvatar";
import { AVATAR_MODE } from "@/lib/avatarConfig";
import type { Persona } from "@/config/personas";
import type { AvatarAnimation, Emotion } from "@/types/game";

// 3D 모드일 때만 three.js 번들을 불러온다.
const AvatarScene = dynamic(() => import("@/components/AvatarScene"), { ssr: false });

interface AvatarStageProps {
  persona: Persona;
  animation: AvatarAnimation;
  animationKey: number;
  emotion: Emotion;
}

/** NEXT_PUBLIC_AVATAR_MODE 에 따라 실사 영상 / 3D 모델 아바타를 선택한다. */
export default function AvatarStage({ persona, ...motion }: AvatarStageProps) {
  if (AVATAR_MODE === "3d") return <AvatarScene {...motion} />;
  // key: 캐릭터가 바뀌면 영상 상태(로딩/폴백/재생 중 클립)를 통째로 초기화
  return <VideoAvatar key={persona.id} persona={persona} {...motion} />;
}
