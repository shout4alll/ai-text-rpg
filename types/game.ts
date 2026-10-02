export type Emotion = "neutral" | "happy" | "sad" | "angry" | "surprised";
export type AvatarAnimation = "idle" | "jump" | "nod" | "shake";

/** /api/chat 응답 스키마 */
export interface ChatResponse {
  text: string;
  emotion: Emotion;
  animation: AvatarAnimation;
  hp_change: number;
}

export interface ChatMessage {
  id: number;
  role: "user" | "ai";
  text: string;
  /** true 면 화면에만 표시하고 API 히스토리에는 보내지 않음 (예: 캐릭터 인사말) */
  local?: boolean;
}

export interface CharacterState {
  hp: number;
  maxHp: number;
}
