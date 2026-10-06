"use client";

import dynamic from "next/dynamic";
import VideoAvatar from "@/components/VideoAvatar";
import { AVATAR_MODE } from "@/lib/avatarConfig";
import { AVATAR_REACTIONS, type AvatarReactionId, type ReactionCue } from "@/config/reactions";
import type { Persona } from "@/lib/personas/types";

// 3D 모드일 때만 three.js 번들을 불러온다.
const AvatarScene = dynamic(() => import("@/components/AvatarScene"), { ssr: false });

interface AvatarStageProps {
  persona: Persona;
  /** 3D 모드용 리액션 id (터치 반응도 가장 가까운 리액션으로 매핑해서 들어온다) */
  reaction: AvatarReactionId;
  /** 실사(video) 모드가 재생할 반응 */
  cue: ReactionCue | null;
  reactionKey: number;
  /** 보이스톡에서 상대가 말하는 중 */
  speaking?: boolean;
}

/** NEXT_PUBLIC_AVATAR_MODE 에 따라 실사 리액션 화면 / 3D 모델을 선택한다. */
export default function AvatarStage({ persona, reaction, cue, reactionKey, speaking }: AvatarStageProps) {
  if (AVATAR_MODE === "3d") {
    const def = AVATAR_REACTIONS[reaction] ?? AVATAR_REACTIONS.idle;
    return <AvatarScene animation={def.animation} emotion={def.emotion} animationKey={reactionKey} />;
  }
  // key: 인물이 바뀌면 영상 상태를 통째로 초기화
  return <VideoAvatar key={persona.id} persona={persona} cue={cue} reactionKey={reactionKey} speaking={speaking} />;
}
