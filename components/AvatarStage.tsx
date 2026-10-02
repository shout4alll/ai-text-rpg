"use client";

import dynamic from "next/dynamic";
import VideoAvatar from "@/components/VideoAvatar";
import { AVATAR_MODE } from "@/lib/avatarConfig";
import type { AvatarAnimation, Emotion } from "@/types/game";

// 3D 모드일 때만 three.js 번들을 불러온다.
const AvatarScene = dynamic(() => import("@/components/AvatarScene"), { ssr: false });

interface AvatarStageProps {
  animation: AvatarAnimation;
  animationKey: number;
  emotion: Emotion;
}

/** NEXT_PUBLIC_AVATAR_MODE 에 따라 실사 영상 / 3D 모델 아바타를 선택한다. */
export default function AvatarStage(props: AvatarStageProps) {
  return AVATAR_MODE === "3d" ? <AvatarScene {...props} /> : <VideoAvatar {...props} />;
}
