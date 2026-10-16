import type { AvatarReactionId, HeartReactionId } from "@/config/reactions";
import type { MediaDirective, MediaType } from "@/config/media";

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
  /** 이번 답장을 쓴 모델 등급 L·M·P·T (다음 턴에 모델을 갑자기 낮추지 않기 위한 기록) */
  grade?: "L" | "M" | "P" | "T";
  /** 이번 턴의 호감도 변화 */
  affectionDelta: number;
  /** 3D 모드 호환 */
  emotion: Emotion;
  animation: AvatarAnimation;
  /** 사진·영상 보내기 (앨범 즉시 전송 / 유료 실시간 사진 요청) */
  media: MediaDirective | null;
  /** 토라져 있을 때: 이번 말이 진심으로 달래 줬는지 (AI 판단) */
  soothed: boolean;
  /** 인물이 자리를 비운다고 했다 — 앱이 이 시간 동안 다음 답장을 미룬다 */
  away?: { minutes: number; reason: string };
  /** 유저가 보낸 사진·영상에서 AI가 본 것 (기억용 한 줄) */
  seen: string;
  /** 주인 모드 인증 토큰 (인증된 턴에만) / 모드 해제 */
  ownerToken?: string;
  ownerExit?: boolean;
  /** 이번 답장이 매혹 모드(성인 대화)로 만들어졌다 — 앱이 메시지에 표시를 붙여 다른 모델에게는 요약만 보낸다 */
  mature?: boolean;
  /** 🛠 주인님 모드에서만: 이번 턴에 쓰인 모델·경로 */
  debug?: { model: string; label: string; tier: string; reason: string; allure: boolean; allureLevel: string; ms: number; fellBack: boolean; attempts: { provider: string; model: string; ok: boolean; ms: number; error?: string }[]; promptMode: "owner" | "service"; sticky: boolean; sanitized: number; sent: { role: string; text: string }[]; overrides: string[]; tokens: { in: number; out: number; cache: number }; ctx?: { score: number; level: string; reason: string | null; features: Record<string, number> } | null; path?: string; userText?: string; cost?: { usd: number; base: number; analyzer: number } };
}

export interface ChatMessage {
  id: number;
  role: "user" | "ai";
  /**
   * text: 말풍선 / reaction: 다른 메시지에 단 마음 리액션 (말풍선으로 표시하지 않음)
   * call: 보이스톡 통화 기록 (가운데 알림으로 표시, text = 통화 초)
   * media: 사진·영상 (text = 설명, media = 파일)
   * notice: 앱 안내 (화면에만, AI 에게 보내지 않음)
   * gift: 유저가 삐진 상대에게 준 선물 (text = 선물 이름)
   * (media + role=user: 유저가 올린 사진·영상 — 파일은 이 기기의 IndexedDB 에 보관, lib/userMedia.ts)
   */
  kind?: "text" | "reaction" | "call" | "media" | "notice" | "gift";
  /** 매혹 모드 중에 오간 말 (화면에는 그대로, 다른 모델에게는 요약으로 전달 — config/spicy.ts) */
  /** kind=gift: good=좋아하는 선물이었는지, sulk=삐진 걸 달래려고 준 선물인지 (대화 맥락용) */
  gift?: { good: boolean; sulk?: boolean };
  mature?: boolean;
  /** kind=media */
  media?: {
    type: MediaType;
    /** URL 또는 data URL (실시간 생성 사진) */
    src: string;
    /** 앨범 id (반복 방지용) */
    albumId?: string;
    /** 실시간 생성 사진 */
    generated?: boolean;
    /** 유저가 올린 파일: IndexedDB 키 (src 는 화면용 임시 주소라 저장하지 않는다) */
    localKey?: string;
    /** 유저가 올린 파일: AI가 본 내용 한 줄 (다음 대화에서 기억용) */
    seen?: string;
    /** 유저가 올린 영상 길이(초) */
    duration?: number;
  };
  /** kind=text(AI): 이 말풍선을 쓴 모델 등급 (lib/gradeSticky.ts) */
  grade?: "L" | "M" | "P" | "T";
  /** kind=text(AI): 이 말풍선과 함께 화면에서 실제로 재생된 리액션 영상 이름 (대화에서 영상을 언급하면 받아치도록 서버에 알린다) */
  clip?: string;
  /** "voice" 면 보이스톡 중에 한 말 (받아쓰기) */
  via?: "voice";
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
