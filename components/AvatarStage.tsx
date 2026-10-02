"use client";

import dynamic from "next/dynamic";
import VideoAvatar from "@/components/VideoAvatar";
import { AVATAR_MODE } from "@/lib/avatarConfig";
import { AVATAR_REACTIONS, type AvatarReactionId } from "@/config/reactions";
import type { Persona } from "@/lib/personas/types";

// 3D 모드일 때만 three.js 번들을 불러온다.
const AvatarScene = dynamic(() => import("@/components/AvatarScene"), { ssr: false });

interface AvatarStageProps {
  persona: Persona;
  reaction: AvatarReactionId;
  reactionKey: number;
}

/** NEXT_PUBLIC_AVATAR_MODE 에 따라 실사 리액션 화면 / 3D 모델을 선택한다. */
export default function AvatarStage({ persona, reaction, reactionKey }: AvatarStageProps) {
  if (AVATAR_MODE === "3d") {
    const def = AVATAR_REACTIONS[reaction] ?? AVATAR_REACTIONS.idle;
    return <AvatarScene animation={def.animation} emotion={def.emotion} animationKey={reactionKey} />;
  }
  // key: 인물이 바뀌면 영상 상태를 통째로 초기화
  return <VideoAvatar key={persona.id} persona={persona} reaction={reaction} reactionKey={reactionKey} />;
}
