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
}

export interface CharacterState {
  hp: number;
  maxHp: number;
}
