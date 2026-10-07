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
import { BALANCE } from "@/config/balance";

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

/** 화면이 실제로 재생할 반응 (AI 리액션·터치 리액션 공통) */
export interface ReactionCue {
  /** 찾아볼 영상 이름 순서 — 첫 번째로 "존재하는" 영상을 재생 */
  clips: string[];
  /** 영상이 없을 때의 화면 움직임 */
  motion: Motion;
  /** 화면 색감 (rgba) */
  tint?: string;
  /** true 면 영상이 끝나도 마지막 장면에서 멈춰 있는다 (예: 등 돌린 채로 삐져 있기). 다음 반응이 오면 풀린다 */
  hold?: boolean;
}

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
  /** 영상이 끝나도 마지막 장면 유지 */
  hold?: boolean;
  /** "premium" = 유료 리액션 (이용권이 없으면 대체 반응 + 잠금 안내) */
  tier?: "premium";
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
  turn_away: {
    label: "등 돌림",
    when: "유저가 무례하거나 상처 주는 말을 해서 실망해 등을 돌리고 싶을 때. 아주 드물게만",
    clips: ["turn_away", "pout", "shake"],
    motion: "sway",
    particles: ["💢"],
    tint: "rgba(30,41,59,0.25)",
    hold: true,
    emotion: "angry",
    animation: "shake",
  },
  kiss: {
    label: "뽀뽀",
    when: "아주 특별한 사이에서 애정이 최고조일 때 손 키스를 날리는 순간. 정말 드물게만",
    clips: ["kiss", "love", "shy"],
    motion: "pop",
    particles: ["💋", "❤️", "💕"],
    tint: "rgba(244,63,94,0.18)",
    tier: "premium",
    emotion: "happy",
    animation: "jump",
  },
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

/* ── 호감도 단계 (0~100) — 값은 config/balance.json 의 affection ─────────── */
export const AFFECTION_START = BALANCE.affection.start;

export interface AffectionStage {
  min: number;
  label: string;
  /** AI에게 주는 태도 지침 */
  guide: string;
  /** 이 단계에 올라섰을 때의 보상 (특별 리액션, 보너스 캐시) */
  reward: { reaction: string; bonusCash: number };
}

export const AFFECTION_STAGES: AffectionStage[] = BALANCE.affection.stages.romance;

/** relationshipType = "friendship" 인 인물용 (연애로 발전하지 않음) */
export const FRIEND_STAGES: AffectionStage[] = BALANCE.affection.stages.friendship;

export function stagesOf(type: "romance" | "friendship" = "romance"): AffectionStage[] {
  return type === "friendship" ? FRIEND_STAGES : AFFECTION_STAGES;
}

/** 몇 번째 단계인지 (0부터) */
export function affectionStageIndex(value: number, type: "romance" | "friendship" = "romance"): number {
  const stages = stagesOf(type);
  let idx = 0;
  stages.forEach((s, i) => {
    if (value >= s.min) idx = i;
  });
  return idx;
}

export function affectionStage(
  value: number,
  type: "romance" | "friendship" = "romance"
): AffectionStage {
  return stagesOf(type)[affectionStageIndex(value, type)];
}

/** 다음 단계까지의 진행 (화면 표시용) */
export function affectionProgress(value: number, type: "romance" | "friendship" = "romance") {
  const stages = stagesOf(type);
  const idx = affectionStageIndex(value, type);
  const cur = stages[idx];
  const next = stages[idx + 1];
  const ceil = next ? next.min : BALANCE.affection.max;
  const span = Math.max(1, ceil - cur.min);
  return {
    index: idx,
    stage: cur,
    next: next ?? null,
    /** 이 단계 안에서의 진행률 0~1 */
    ratio: Math.max(0, Math.min(1, (value - cur.min) / span)),
    /** 다음 단계까지 남은 점수 (마지막 단계면 0) */
    toNext: next ? Math.max(0, Math.ceil(next.min - value)) : 0,
  };
}

/* ── 3) TOUCH_REACTIONS : 유저가 화면(인물)을 터치했을 때의 반응 ──────────────
 *   - LLM 호출 없이 즉시 반응한다. (빠르고 비용 0)
 *   - 영상: clips 순서대로 찾는다. 첫 번째는 터치 전용 클립 "touch_<id>" 이다.
 *           예) public/avatar/personas/<id>/clips/touch_shy.mp4 를 넣으면 다음 배포부터 그 영상이 재생된다.
 *           없으면 일반 리액션 영상(shy, love …) → 그것도 없으면 motion + 이모지 효과로 대신한다.
 *   - lines: 아바타 위에 잠깐 뜨는 한마디. 말투가 갈리지 않는 감탄사 위주.
 *            인물별로 바꾸려면 personas/<id>.json 의 "touchLines" 로 덮어쓴다.
 *   - 어떤 반응이 나올지는 pickTouchReaction() 이 터치 위치·연타·호감도로 정한다.
 */
export interface TouchReactionDef {
  label: string;
  /** 찾아볼 영상 이름 순서 */
  clips: string[];
  /** 영상이 없을 때의 화면 움직임 */
  motion: Motion;
  /** 터치한 자리에서 터져 나오는 이모지 */
  particles: string[];
  tint?: string;
  /** 기본 한마디 (무작위 1개) */
  lines: string[];
  /** 3D 모드 호환 */
  avatar: AvatarReactionId;
}

const TOUCH_REACTION_DEFS = {
  shy: {
    label: "부끄러움",
    clips: ["touch_shy", "shy", "smile", "happy"],
    motion: "tilt",
    particles: ["💗", "☺️", "💕"],
    tint: "rgba(244,114,182,0.18)",
    lines: ["앗…", "에이… 부끄럽게…", "왜, 왜요…?", "히…"],
    avatar: "shy",
  },
  joy: {
    label: "즐거움",
    clips: ["touch_joy", "laugh", "excited", "happy"],
    motion: "bounce",
    particles: ["✨", "😆", "🎶"],
    lines: ["헤헤", "간지러워요 ㅋㅋ", "아하하!", "히히"],
    avatar: "laugh",
  },
  pout: {
    label: "앙탈",
    clips: ["touch_pout", "pout", "angry", "shake"],
    motion: "sway",
    particles: ["💢", "😤", "💨"],
    lines: ["흥!", "그만 찔러요~!", "아 진짜아~", "삐질 거예요!"],
    avatar: "pout",
  },
  lovely: {
    label: "사랑스러움",
    clips: ["touch_lovely", "love", "shy", "happy"],
    motion: "pop",
    particles: ["❤️", "💕", "🥰", "💖"],
    tint: "rgba(244,63,94,0.16)",
    lines: ["좋아…♡", "헤헤, 기분 좋다", "더 해 줘요…", "♡"],
    avatar: "love",
  },
  surprised: {
    label: "깜짝",
    clips: ["touch_surprised", "surprised"],
    motion: "pop",
    particles: ["❗", "😳"],
    lines: ["깜짝이야!", "엇!", "어머!"],
    avatar: "surprised",
  },
} satisfies Record<string, TouchReactionDef>;

export type TouchReactionId = keyof typeof TOUCH_REACTION_DEFS;
export const TOUCH_REACTIONS: Record<TouchReactionId, TouchReactionDef> = TOUCH_REACTION_DEFS;
export const TOUCH_REACTION_IDS = Object.keys(TOUCH_REACTIONS) as [TouchReactionId, ...TouchReactionId[]];

/** 터치한 부위 (화면 세로 위치 기준 대략값) */
export type TouchZone = "head" | "face" | "body";

export function touchZoneOf(yRatio: number): TouchZone {
  if (yRatio < 0.3) return "head";
  if (yRatio < 0.55) return "face";
  return "body";
}

/**
 * 터치 → 반응 고르기
 * @param zone   터치 부위
 * @param combo  짧은 시간 안에 연속으로 터치한 횟수 (1 = 첫 터치)
 * @param affection 호감도 0~100
 * @param relationship 연애형/친구형
 * @param rand   0~1 난수 (테스트용 주입)
 */
export function pickTouchReaction(
  zone: TouchZone,
  combo: number,
  affection: number,
  relationship: "romance" | "friendship" = "romance",
  rand: number = Math.random()
): TouchReactionId {
  const T = BALANCE.touch;
  // 연타하면 앙탈
  if (combo >= T.poutCombo) return "pout";
  if (combo >= T.poutComboMaybe && rand < T.poutComboMaybeChance) return "pout";

  // 아직 어색한 사이: 놀라거나 부끄러워한다
  if (affection < T.shyUntil) {
    if (zone === "body") return rand < 0.6 ? "surprised" : "pout";
    return rand < 0.55 ? "shy" : "surprised";
  }

  // 친구형은 설렘(lovely) 대신 즐거움 위주
  const close = affection >= T.closeFrom;
  const lovelyOk = relationship === "romance" && close;

  if (zone === "head") {
    // 머리 쓰다듬기
    if (lovelyOk) return rand < 0.55 ? "lovely" : "shy";
    return rand < 0.5 ? "joy" : "shy";
  }
  if (zone === "face") {
    // 볼 콕
    if (lovelyOk) return rand < 0.45 ? "shy" : rand < 0.8 ? "lovely" : "pout";
    return rand < 0.5 ? "shy" : rand < 0.8 ? "joy" : "pout";
  }
  // 몸 (간지럼 / 쿡 찌르기)
  if (close) return rand < 0.55 ? "joy" : "pout";
  return rand < 0.4 ? "joy" : rand < 0.75 ? "pout" : "surprised";
}
