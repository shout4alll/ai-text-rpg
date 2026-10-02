/**
 * 리액션 카탈로그 (클라이언트·서버 공용, 비밀 정보 없음)
 *
 * ── 1) AVATAR_REACTIONS : 상대(AI)가 화면에서 보여 주는 반응 ──────────────
 *   - AI는 답장마다 이 중 하나(reaction)를 고른다.
 *   - 영상: public/avatar/personas/<id>/clips/<리액션id>.mp4 가 있으면 그 영상을 재생한다.
 *           없으면 clips 배열의 다음 이름을 차례로 찾고, 하나도 없으면 motion(화면 움직임)으로 대체한다.
 *     → 나중에 영상을 만들면 "파일 이름만 리액션 id로 맞춰서 넣으면" 자동으로 영상으로 바뀐다. (재배포 필요)
 *   - particles: 화면에 떠오르는 효과 이모지 / tint: 화면 색감 효과
 *   - emotion·animation: 3D 모드 호환용
 *
 * ── 2) HEART_REACTIONS : 유저가 말풍선에 다는 "마음 리액션" ────────────────
 *   - AI도 가끔 유저 메시지에 같은 목록 중 하나를 달아 준다(tapback).
 *
 * 리액션을 추가하려면 항목을 추가하면 된다. (AI 프롬프트·스키마에 자동 반영)
 */
import type { AvatarAnimation, Emotion } from "@/types/game";

export type Motion =
  | "none"
  | "nod"
  | "nodSoft"
  | "shake"
  | "bounce"
  | "pop"
  | "popSoft"
  | "tilt"
  | "sway"
  | "sink"
  | "sinkSoft";

export interface AvatarReactionDef {
  /** 화면 표시용 이름 */
  label: string;
  /** AI에게 주는 사용 기준 */
  when: string;
  /** 찾아볼 영상 이름 순서 (첫 번째는 보통 리액션 id 자신) */
  clips: string[];
  /** 영상이 없을 때의 화면 움직임 */
  motion: Motion;
  /** 화면에 떠오르는 효과 */
  particles?: string[];
  /** 화면 색감 (rgba) */
  tint?: string;
  emotion: Emotion;
  animation: AvatarAnimation;
}

const AVATAR_REACTION_DEFS = {
  idle: { label: "평소", when: "특별한 반응이 필요 없을 때", clips: ["idle"], motion: "none", emotion: "neutral", animation: "idle" },
  smile: { label: "미소", when: "기분 좋게 은은히 웃을 때", clips: ["smile", "happy", "nod"], motion: "popSoft", emotion: "happy", animation: "nod" },
  laugh: { label: "웃음", when: "웃긴 말에 크게 웃을 때", clips: ["laugh", "happy"], motion: "bounce", particles: ["✨"], emotion: "happy", animation: "jump" },
  nod: { label: "끄덕", when: "공감·동의·맞장구", clips: ["nod"], motion: "nod", emotion: "neutral", animation: "nod" },
  shake: { label: "도리도리", when: "아니라고 할 때, 장난스러운 부정", clips: ["shake"], motion: "shake", emotion: "neutral", animation: "shake" },
  shy: { label: "쑥스러움", when: "칭찬이나 설레는 말에 수줍을 때", clips: ["shy", "smile", "happy"], motion: "tilt", particles: ["💗"], tint: "rgba(244,114,182,0.16)", emotion: "happy", animation: "nod" },
  love: { label: "설렘", when: "마음이 두근거릴 때, 애정을 느낄 때", clips: ["love", "shy", "happy"], motion: "pop", particles: ["❤️", "💕"], tint: "rgba(244,63,94,0.14)", emotion: "happy", animation: "jump" },
  pout: { label: "삐짐", when: "살짝 서운하거나 귀엽게 토라질 때", clips: ["pout", "angry", "shake"], motion: "sway", particles: ["💢"], emotion: "angry", animation: "shake" },
  surprised: { label: "놀람", when: "깜짝 놀랐을 때", clips: ["surprised"], motion: "pop", particles: ["❗"], emotion: "surprised", animation: "jump" },
  sad: { label: "속상함", when: "속상하거나 안타까울 때", clips: ["sad", "shake"], motion: "sink", particles: ["💧"], tint: "rgba(30,41,59,0.30)", emotion: "sad", animation: "shake" },
  touched: { label: "감동", when: "고마움에 뭉클할 때", clips: ["touched", "sad", "smile"], motion: "sinkSoft", particles: ["✨"], tint: "rgba(253,224,71,0.10)", emotion: "happy", animation: "nod" },
  thinking: { label: "생각 중", when: "고민하거나 궁금해할 때", clips: ["thinking", "idle"], motion: "tilt", particles: ["💭"], emotion: "neutral", animation: "idle" },
  excited: { label: "신남", when: "들뜨고 신날 때", clips: ["excited", "laugh", "happy"], motion: "bounce", particles: ["🎉"], emotion: "happy", animation: "jump" },
  comfort: { label: "토닥임", when: "상대를 위로하고 싶을 때", clips: ["comfort", "nod"], motion: "nodSoft", particles: ["🤍"], emotion: "neutral", animation: "nod" },
  sleepy: { label: "졸림", when: "피곤하거나 밤늦어 졸릴 때", clips: ["sleepy", "idle"], motion: "sinkSoft", particles: ["💤"], emotion: "neutral", animation: "idle" },
} satisfies Record<string, AvatarReactionDef>;

export type AvatarReactionId = keyof typeof AVATAR_REACTION_DEFS;
export const AVATAR_REACTIONS: Record<AvatarReactionId, AvatarReactionDef> = AVATAR_REACTION_DEFS;
export const AVATAR_REACTION_IDS = Object.keys(AVATAR_REACTIONS) as [AvatarReactionId, ...AvatarReactionId[]];

export interface HeartReactionDef {
  emoji: string;
  label: string;
  /** AI에게 전달하는 의미 */
  meaning: string;
}

const HEART_REACTION_DEFS = {
  love: { emoji: "❤️", label: "사랑해", meaning: "애정, 좋아하는 마음" },
  like: { emoji: "👍", label: "좋아요", meaning: "공감, 좋다는 표시" },
  joy: { emoji: "😆", label: "기뻐", meaning: "기쁨, 신남" },
  shy: { emoji: "☺️", label: "쑥스러워", meaning: "쑥스러움, 수줍음" },
  pout: { emoji: "😤", label: "앙탈", meaning: "귀여운 투정, 앙탈, 서운함" },
  touched: { emoji: "🥹", label: "감동", meaning: "감동, 뭉클함" },
  haha: { emoji: "🤣", label: "웃겨", meaning: "너무 웃김" },
  hug: { emoji: "🫂", label: "토닥토닥", meaning: "위로, 안아 주고 싶은 마음" },
  wow: { emoji: "😮", label: "놀라워", meaning: "놀람" },
  sad: { emoji: "😢", label: "슬퍼", meaning: "슬픔, 공감하는 아픔" },
} satisfies Record<string, HeartReactionDef>;

export type HeartReactionId = keyof typeof HEART_REACTION_DEFS;
export const HEART_REACTIONS: Record<HeartReactionId, HeartReactionDef> = HEART_REACTION_DEFS;
export const HEART_REACTION_IDS = Object.keys(HEART_REACTIONS) as [HeartReactionId, ...HeartReactionId[]];

export function isAvatarReactionId(v: unknown): v is AvatarReactionId {
  return typeof v === "string" && v in AVATAR_REACTIONS;
}
export function isHeartReactionId(v: unknown): v is HeartReactionId {
  return typeof v === "string" && v in HEART_REACTIONS;
}

/* ── 호감도 단계 (0~100) ─────────────────────────────────────────────── */
export const AFFECTION_START = 10;

export interface AffectionStage {
  min: number;
  label: string;
  /** AI에게 주는 태도 지침 */
  guide: string;
}

export const AFFECTION_STAGES: AffectionStage[] = [
  { min: 0, label: "알아가는 중", guide: "막 알게 된 사이. 예의와 적당한 거리를 지키며 서로를 알아 간다." },
  { min: 20, label: "편한 사이", guide: "편한 친구 사이. 장난과 근황 공유가 자연스럽고, 허락을 받으면 말을 편하게 해도 된다." },
  { min: 45, label: "설레는 사이", guide: "서로 설레는 사이. 관심과 보고 싶은 마음을 은근히, 돌려서 표현한다. 아직 고백은 서두르지 않는다." },
  { min: 75, label: "특별한 사이", guide: "아주 가까운 사이. 다정한 애정 표현이 자연스럽다. 연인 관계는 대화에서 서로 마음을 확인했을 때만 연인처럼 대한다." },
];

/** relationshipType = "friendship" 인 인물용 (연애로 발전하지 않음) */
export const FRIEND_STAGES: AffectionStage[] = [
  { min: 0, label: "알아가는 중", guide: "막 알게 된 사이. 예의와 적당한 거리를 지키며 서로를 알아 간다." },
  { min: 20, label: "편한 사이", guide: "편한 친구 사이. 장난과 근황 공유가 자연스럽다." },
  { min: 45, label: "친한 친구", guide: "속 얘기를 나누는 친구. 고민을 털어놓고 진심으로 응원한다. 연애 감정은 아니다." },
  { min: 75, label: "절친", guide: "무엇이든 말할 수 있는 절친. 깊이 신뢰하고 챙긴다. 연애 감정으로는 발전하지 않는다." },
];

export function affectionStage(
  value: number,
  type: "romance" | "friendship" = "romance"
): AffectionStage {
  const stages = type === "friendship" ? FRIEND_STAGES : AFFECTION_STAGES;
  let stage = stages[0];
  for (const s of stages) if (value >= s.min) stage = s;
  return stage;
}
