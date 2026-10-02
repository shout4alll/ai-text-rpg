import type { AvatarReactionId, HeartReactionId } from "@/config/reactions";

export type Emotion = "neutral" | "happy" | "sad" | "angry" | "surprised";
export type AvatarAnimation = "idle" | "jump" | "nod" | "shake";

/** /api/chat 응답 */
export interface ChatResponse {
  /** 말풍선 0~3개 (마음 리액션에는 말 없이 표정만 지을 수도 있음) */
  messages: string[];
  /** 화면 리액션 (사진·영상) */
  reaction: AvatarReactionId;
  /** AI가 유저의 마지막 메시지에 다는 마음 리액션 (없으면 null) */
  tapback: HeartReactionId | null;
  /** 이번 턴의 호감도 변화 */
  affectionDelta: number;
  /** 3D 모드 호환 */
  emotion: Emotion;
  animation: AvatarAnimation;
}

export interface ChatMessage {
  id: number;
  role: "user" | "ai";
  /** text: 말풍선 / reaction: 다른 메시지에 단 마음 리액션 (말풍선으로 표시하지 않음) */
  kind?: "text" | "reaction";
  /** kind=text: 내용 / kind=reaction: HeartReactionId */
  text: string;
  /** kind=reaction: 리액션을 단 대상 메시지 id */
  targetId?: number;
  /** 보낸 시각 (ms) */
  at: number;
  /** 유저 메시지를 상대가 읽었는지 (읽기 전엔 "1" 표시) */
  read?: boolean;
  /** true 면 화면에만 표시하고 API 히스토리에는 보내지 않음 (예: 첫 인사) */
  local?: boolean;
}
