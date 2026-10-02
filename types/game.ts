export type Emotion = "neutral" | "happy" | "sad" | "angry" | "surprised";
export type AvatarAnimation = "idle" | "jump" | "nod" | "shake";

/** /api/chat 응답 스키마 */
export interface ChatResponse {
  /** 말풍선 1~3개 (메신저처럼 나눠 보냄) */
  messages: string[];
  emotion: Emotion;
  animation: AvatarAnimation;
}

export interface ChatMessage {
  id: number;
  role: "user" | "ai";
  text: string;
  /** 보낸 시각 (ms) */
  at: number;
  /** true 면 화면에만 표시하고 API 히스토리에는 보내지 않음 (예: 캐릭터 인사말) */
  local?: boolean;
}
