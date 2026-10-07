"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AvatarStage from "@/components/AvatarStage";
import ChatPanel from "@/components/ChatPanel";
import EffectsLayer, { type Burst, type Particle, type TouchMark, type TouchSpark } from "@/components/EffectsLayer";
import PersonaPortrait from "@/components/PersonaPortrait";
import PersonaSelector from "@/components/PersonaSelector";
import VoiceCall, { type VoiceBilling, type VoiceCallHandle, type VoiceCallResult } from "@/components/VoiceCall";
import PlansModal, { type PlansReason } from "@/components/PlansModal";
import { CASH_PRICE, PLANS, type PlanId } from "@/config/plans";
import {
  addVoiceSeconds,
  consumeFreeExchange,
  consumePlanPhoto,
  freeExchangesLeft,
  getMembership,
  planPhotosLeft,
  planVoiceSecondsLeft,
  refundPlanPhoto,
  setPlanForTest,
  type MembershipState,
} from "@/lib/membership";
import MediaPurchaseModal from "@/components/MediaPurchaseModal";
import AllureGateModal from "@/components/AllureGateModal";
import { ALLURE_STORAGE } from "@/config/allure";
import { BALANCE, sulkLevelDef } from "@/config/balance";
import { checkRelease, giftCost, sulkExpired, sulkStartLevel, sulkSummary, touchSulk, type SulkState } from "@/lib/sulk";
import { deleteMediaFor, getMedia, importFile, mediaUrl, UserMediaError } from "@/lib/userMedia";
import { DEMO_TOPUP, MEDIA_COST } from "@/config/media";
import { getCash, refundCash, setCash, spendCash } from "@/lib/wallet";
import {
  AFFECTION_START,
  AVATAR_REACTIONS,
  HEART_REACTIONS,
  TOUCH_REACTIONS,
  affectionProgress,
  affectionStage,
  affectionStageIndex,
  pickTouchReaction,
  touchZoneOf,
  type AvatarReactionId,
  type HeartReactionId,
  type ReactionCue,
  type TouchReactionId,
} from "@/config/reactions";
import type { Persona, PersonaId } from "@/lib/personas/types";
import { createReactionDirector, type DirectorDecision, type DirectorEvent } from "@/lib/reactionDirector";
import type { ChatMessage, ChatResponse } from "@/types/game";

/* -------------------------------------------------------------------------- */
/*  브라우저 저장: 인물마다 대화방(메시지 + 호감도)이 따로 저장된다               */
/* -------------------------------------------------------------------------- */
const LAST_KEY = "ai-rpg.personaId";
const chatKey = (id: PersonaId) => `ai-rpg.chat.${id}`;
const MAX_STORED = 300; // 대화방당 저장할 최대 기록 수
const MAX_SEND = 40; // API로 보낼 최근 턴 수
const RETURN_GAP = 3 * 60 * 60 * 1000; // 이 시간 이상 비웠다가 들어오면 상대가 먼저 말을 건다

interface StoredChat {
  v: 2;
  messages: ChatMessage[];
  affection: number;
  /** 삐져 있는 상태 (lib/sulk.ts) — 다시 열어도 이어진다 */
  sulk?: SulkState | null;
  /** 마지막으로 삐짐이 풀린 시각 (반복 삐짐 가중용) */
  sulkReleasedAt?: number;
  /** 지금까지 도달한 가장 높은 호감도 단계 (보상은 처음 도달할 때만) */
  bestStage?: number;
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string | null): boolean {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return true;
  } catch {
    /* 저장 불가 환경(시크릿 모드, 용량 초과 등)은 무시 */
    return false;
  }
}

/** 저장된 대화방 읽기 (예전 형식 = 메시지 배열이면 자동 변환) */
function loadChat(id: PersonaId): StoredChat | null {
  const raw = readStorage(chatKey(id));
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    const valid = (arr: unknown): arr is ChatMessage[] =>
      Array.isArray(arr) && arr.every((m) => m && typeof m.text === "string" && typeof m.at === "number" && typeof m.id === "number");
    if (valid(data)) {
      return { v: 2, messages: data.map((m) => ({ ...m, kind: "text" as const, read: true })), affection: AFFECTION_START };
    }
    const d = data as Partial<StoredChat>;
    if (d && d.v === 2 && valid(d.messages)) {
      return {
        v: 2,
        messages: d.messages,
        affection: typeof d.affection === "number" ? d.affection : AFFECTION_START,
        sulk: d.sulk && typeof d.sulk.level === "number" ? d.sulk : null,
        sulkReleasedAt: typeof d.sulkReleasedAt === "number" ? d.sulkReleasedAt : undefined,
        bestStage: typeof d.bestStage === "number" ? d.bestStage : undefined,
      };
    }
  } catch {
    /* 손상된 데이터는 무시 */
  }
  return null;
}

function saveChat(id: PersonaId, chat: Omit<StoredChat, "v">) {
  // 유저가 올린 파일은 IndexedDB 에 있으므로 화면용 임시 주소(blob:)는 저장하지 않는다
  const messages = chat.messages
    .slice(-MAX_STORED)
    .map((m) => (m.media?.localKey ? { ...m, media: { ...m.media, src: "" } } : m));
  const extra = { sulk: chat.sulk ?? null, sulkReleasedAt: chat.sulkReleasedAt, bestStage: chat.bestStage };
  if (writeStorage(chatKey(id), JSON.stringify({ v: 2, messages, affection: chat.affection, ...extra }))) return;
  // 용량 초과: 실시간 생성 사진(data URL)은 빼고 저장 (대화 기록은 지킨다)
  const slim = messages.map((m) =>
    m.media?.generated && m.media.src.startsWith("data:") ? { ...m, media: { ...m.media, src: "" } } : m
  );
  writeStorage(chatKey(id), JSON.stringify({ v: 2, messages: slim, affection: chat.affection, ...extra }));
}

/** 생성 사진을 메신저용 크기(가로 720, JPEG)로 줄여 data URL 로 */
async function compressImage(base64: string, mimeType: string): Promise<string> {
  const src = `data:${mimeType};base64,${base64}`;
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const scale = Math.min(1, 720 / img.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return src;
  }
}

function readPass(): string | null {
  try {
    return localStorage.getItem("ai-rpg.voicePass");
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  API 요청용 변환                                                             */
/* -------------------------------------------------------------------------- */
interface Turn {
  role: "user" | "assistant";
  kind: "text" | "reaction" | "return" | "call" | "media" | "user_media" | "gift";
  content: string;
  target?: string;
  at?: number;
  mediaType?: "photo" | "video";
  seen?: string;
  images?: string[];
  /** 클라이언트 전용: 이미지를 붙일 파일 키 (전송 전 제거) */
  localKey?: string;
}

function toTurns(msgs: ChatMessage[]): Turn[] {
  const byId = new Map(msgs.map((m) => [m.id, m]));
  const turns: Turn[] = [];
  for (const m of msgs) {
    if (m.local) continue;
    if ((m.kind ?? "text") === "text") {
      if (m.text.startsWith("⚠️")) continue; // 오류 안내는 대화가 아님
      turns.push({ role: m.role === "user" ? "user" : "assistant", kind: "text", content: m.text, at: m.at });
    } else if (m.kind === "reaction" && m.role === "user") {
      turns.push({ role: "user", kind: "reaction", content: m.text, target: byId.get(m.targetId ?? -1)?.text, at: m.at });
    } else if (m.kind === "call") {
      turns.push({ role: "user", kind: "call", content: m.text, at: m.at });
    } else if (m.kind === "media" && m.role === "ai") {
      turns.push({ role: "assistant", kind: "media", content: m.text, at: m.at });
    } else if (m.kind === "media" && m.role === "user" && m.media) {
      turns.push({
        role: "user",
        kind: "user_media",
        content: m.text,
        mediaType: m.media.type,
        seen: m.media.seen,
        localKey: m.media.localKey,
        at: m.at,
      });
    } else if (m.kind === "gift" && m.role === "user") {
      turns.push({ role: "user", kind: "gift", content: m.text, at: m.at });
    }
  }
  return turns.slice(-MAX_SEND);
}

function userTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** 메시지를 '읽기'까지 걸리는 시간 */
const readDelay = () => 600 + Math.random() * 900;
/** 말풍선 하나를 '입력'하는 시간: 글자 수에 비례, 최대 1.8초 */
const typingDelay = (text: string) => Math.min(1800, 400 + text.length * 35);
const clampAffection = (v: number) => Math.max(0, Math.min(100, v));
const visibleText = (m: ChatMessage) => (m.kind ?? "text") === "text";

/* -------------------------------------------------------------------------- */

export default function ChatApp({
  personas,
  premiumReactions = false,
}: {
  personas: Persona[];
  /** 유료 리액션 영상(뽀뽀 등) 사용 가능 — 서버가 정한다 (lib/entitlements.ts) */
  premiumReactions?: boolean;
}) {
  const byId = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas]);

  const [hydrated, setHydrated] = useState(false);
  const [personaId, setPersonaId] = useState<PersonaId | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [affection, setAffection] = useState(AFFECTION_START);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);

  // 화면 리액션 & 효과
  const [reaction, setReaction] = useState<AvatarReactionId>("idle");
  const [cue, setCue] = useState<ReactionCue | null>(null);
  const [reactionKey, setReactionKey] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [sparks, setSparks] = useState<TouchSpark[]>([]);
  const [marks, setMarks] = useState<TouchMark[]>([]);
  const effectId = useRef(0);
  // 화면 터치 연타 추적
  const touchRef = useRef({ lastAt: 0, combo: 0, lastFire: 0 });

  // 유료 실시간 사진 (모달 → 캐시 차감 → 생성)
  const [photoOffer, setPhotoOffer] = useState<null | { personaId: PersonaId; request: string }>(null);
  const [cash, setCashState] = useState(0);
  const [photoBusy, setPhotoBusy] = useState(false);

  // 리액션 영상 소리 (기본 켬, 기기에 기억)
  const [soundOn, setSoundOn] = useState(true);
  useEffect(() => {
    setSoundOn(readStorage("ai-rpg.sound") !== "0");
  }, []);

  // 보이스톡
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const voiceHandle = useRef<VoiceCallHandle | null>(null);
  const [voiceBilling, setVoiceBilling] = useState<VoiceBilling | null>(null);
  /** 캐시 통화: 지금까지 결제한 분 */
  const cashMinutesPaid = useRef(0);

  // 멤버십 (무료 체험 · 구독 · 월 사용량) — lib/membership.ts
  const [membership, setMembership] = useState<MembershipState | null>(null);
  const refreshMembership = useCallback(() => {
    setMembership(getMembership());
    setCashState(getCash());
  }, []);
  useEffect(() => refreshMembership(), [refreshMembership]);
  const [plansModal, setPlansModal] = useState<PlansReason | null>(null);

  // 💋 매혹 모드 (인물별로 켜고 끔, 기기에 기억) — config/allure.ts
  const [allureIds, setAllureIds] = useState<string[]>([]);
  const [allureGate, setAllureGate] = useState(false);
  useEffect(() => {
    try {
      const v = JSON.parse(readStorage(ALLURE_STORAGE.on) ?? "[]") as unknown;
      if (Array.isArray(v)) setAllureIds(v.filter((x): x is string => typeof x === "string"));
    } catch {
      /* 손상된 값 무시 */
    }
  }, []);

  // 열 때 자동으로 할 일 (못 받은 답장 이어받기 / 오랜만에 돌아옴)
  const [autoAction, setAutoAction] = useState<null | "unanswered" | "return">(null);

  const nextId = useRef(0);
  // 대화방을 바꾸면 증가 → 진행 중이던 답장은 화면 대신 그 대화방 저장소에 기록한다
  const sessionRef = useRef(0);

  const persona = personaId ? byId.get(personaId) ?? null : null;

  /* ── 효과 ─────────────────────────────────────────────────────────────── */
  const spawnParticles = useCallback((emojis: string[] | undefined, count = 6) => {
    if (!emojis || emojis.length === 0) return;
    const items: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: effectId.current++,
      emoji: emojis[i % emojis.length],
      x: 30 + Math.random() * 40,
      dx: (Math.random() - 0.5) * 120,
      delay: i * 120 + Math.random() * 100,
      dur: 1800 + Math.random() * 900,
      size: 1.4 + Math.random() * 0.9,
    }));
    setParticles((p) => [...p, ...items]);
    const ids = new Set(items.map((p) => p.id));
    setTimeout(() => setParticles((p) => p.filter((x) => !ids.has(x.id))), 3600);
  }, []);

  const spawnBurst = useCallback((emoji: string) => {
    const b = { id: effectId.current++, emoji };
    setBursts((x) => [...x, b]);
    setTimeout(() => setBursts((x) => x.filter((y) => y.id !== b.id)), 1300);
  }, []);

  /* ── 리액션 연출 (lib/reactionDirector.ts 가 영상을 틀지, 움직임만 줄지 정한다) ── */
  const director = useMemo(() => createReactionDirector(), []);
  const [teaser, setTeaser] = useState<AvatarReactionId | null>(null);
  const affectionRef = useRef(affection);
  affectionRef.current = affection;
  const sulkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 삐짐 (lib/sulk.ts) — 단계·달래기·선물
  const [sulk, setSulkState] = useState<SulkState | null>(null);
  const sulkRef = useRef<SulkState | null>(null);
  const sulkReleasedAt = useRef<number | undefined>(undefined);
  /** 지금까지 도달한 최고 단계 (단계 보상은 처음 도달할 때만) */
  const bestStage = useRef(0);
  const sulking = !!sulk;
  const setSulk = useCallback((s: SulkState | null) => {
    sulkRef.current = s;
    setSulkState(s);
  }, []);

  // 호감도 연출: 변화량 표시 · 단계 상승 배너
  const [affDelta, setAffDelta] = useState<{ v: number; key: number } | null>(null);
  const [stageBanner, setStageBanner] = useState<{ label: string; key: number } | null>(null);

  /** 유료 리액션 영상: 서버 설정(PREMIUM_ACCESS=open) 또는 PRIME 이상 구독 */
  const premiumUnlocked = premiumReactions || (membership ? PLANS[membership.plan].premiumReactions : false);
  /** 💋 매혹 모드: 인물이 지원 + 멤버십(PRIME 이상) + 켜 둠 */
  const allureActive = !!persona?.allure && premiumUnlocked && allureIds.includes(persona.id);

  /** 연출 판단에 필요한 정보 */
  const directorCtx = useCallback(
    (nextAffection: number) => {
      const free = persona?.assets.clips ?? {};
      const paid = persona?.assets.premiumClips ?? {};
      return {
        affection: affectionRef.current,
        nextAffection,
        relationship: persona?.relationshipType ?? "romance",
        premium: premiumUnlocked,
        hasClip: (n: string) => n in free || (premiumUnlocked && n in paid),
        hasPremiumClip: (n: string) => n in paid,
        allureClips: allureActive ? Object.keys(persona?.assets.allureClips ?? {}) : [],
        sulking: !!sulkRef.current,
        reactionBias: persona?.traits.reactionBias ?? {},
      } as const;
    },
    [persona, premiumUnlocked, allureActive]
  );

  /** 연출 결과를 화면에 반영 */
  const applyDecision = useCallback(
    (d: DirectorDecision, particlesAt?: { x: number; y: number }) => {
      setReaction(d.reaction);
      if (d.cue) {
        setCue(d.cue);
        setReactionKey((k) => k + 1);
      }
      if (!particlesAt) spawnParticles(d.particles);
      if (d.touchSulk && !sulkRef.current) {
        // 터치 연타로 삐짐: 일정 시간 뒤 저절로 풀림 (balance.json sulk.touch)
        const s = touchSulk();
        setSulk(s);
        if (sulkTimer.current) clearTimeout(sulkTimer.current);
        const ms = BALANCE.sulk.touch.autoReleaseSec * 1000;
        if (ms > 0) {
          sulkTimer.current = setTimeout(() => {
            if (sulkRef.current?.cause === "touch") {
              setSulk(null);
              sulkReleasedAt.current = Date.now();
              setReaction("idle");
              setCue(null); // 멈춰 있던 등 돌린 장면을 풀고 기본 화면으로
              setReactionKey((k) => k + 1);
            }
          }, ms);
        }
      }
      if (d.teaser) {
        setTeaser(d.teaser);
        setTimeout(() => setTeaser(null), 4500);
      }
    },
    [spawnParticles, setSulk]
  );

  type AiEvent = Extract<DirectorEvent, { type: "ai" }>;
  /** AI 답장·보이스톡 표정 → 연출 */
  const playReaction = useCallback(
    (
      r: AvatarReactionId,
      opts?: {
        delta?: number;
        kind?: AiEvent["kind"];
        heart?: HeartReactionId;
        sulkStart?: boolean;
        sulkRelease?: AiEvent["sulkRelease"];
        stageUp?: number;
      }
    ) => {
      const delta = opts?.delta ?? 0;
      const ev: DirectorEvent = {
        type: "ai",
        reaction: r,
        affectionDelta: delta,
        kind: opts?.kind ?? "text",
        heart: opts?.heart,
        sulkStart: opts?.sulkStart,
        sulkRelease: opts?.sulkRelease,
        stageUp: opts?.stageUp,
      };
      applyDecision(director.decide(ev, directorCtx(clampAffection(affectionRef.current + delta))));
    },
    [applyDecision, director, directorCtx]
  );

  /**
   * 호감도 반영 + 연출 (변화량 표시, 단계 상승 배너·보너스, 단계 하락 안내)
   * 단계 보상(배너·보너스 캐시·한마디·특별 리액션)은 그 단계에 "처음" 올라설 때만 준다.
   * @returns 처음 올라선 단계 번호 (아니면 null)
   */
  const applyAffection = useCallback(
    (delta: number): number | null => {
      if (!persona || delta === 0) return null;
      const before = affectionRef.current;
      const after = clampAffection(before + delta);
      setAffection(after);
      setAffDelta({ v: delta, key: Date.now() });
      setTimeout(() => setAffDelta((x) => (x && Date.now() - x.key > 1400 ? null : x)), 1600);
      const rel = persona.relationshipType;
      const bi = affectionStageIndex(before, rel);
      const ai = affectionStageIndex(after, rel);
      if (ai > bi && ai <= bestStage.current) {
        const st = affectionProgress(after, rel).stage;
        setMessages((prev) => [
          ...prev,
          { id: nextId.current++, role: "ai", kind: "notice", text: `💗 다시 "${st.label}"로 가까워졌어요`, at: Date.now(), local: true },
        ]);
        return null;
      }
      if (ai > bi) {
        bestStage.current = ai;
        const st = affectionProgress(after, rel).stage;
        setStageBanner({ label: st.label, key: Date.now() });
        setTimeout(() => setStageBanner(null), BALANCE.affection.stageUpBannerMs);
        if (st.reward.bonusCash > 0) {
          setCash(getCash() + st.reward.bonusCash);
          setCashState(getCash());
        }
        setMessages((prev) => [
          ...prev,
          {
            id: nextId.current++,
            role: "ai",
            kind: "notice",
            text: `💗 ${persona.name} 님과 "${st.label}"가 됐어요${st.reward.bonusCash ? ` · 💎 ${st.reward.bonusCash} 보너스` : ""}`,
            at: Date.now(),
            local: true,
          },
        ]);
        return ai;
      }
      if (ai < bi && BALANCE.affection.stageDownNotice) {
        const st = affectionProgress(after, rel).stage;
        setMessages((prev) => [
          ...prev,
          { id: nextId.current++, role: "ai", kind: "notice", text: `💔 관계가 조금 멀어졌어요 · "${st.label}"`, at: Date.now(), local: true },
        ]);
      }
      return null;
    },
    [persona]
  );
  const playVoiceReaction = useCallback((r: AvatarReactionId) => playReaction(r, { kind: "voice" }), [playReaction]);

  /* ── 화면 터치 리액션 (LLM 호출 없이 즉시) ─────────────────────────────── */
  /** 손가락 자리에서 이모지가 튀어나가는 효과 */
  const spawnSparks = useCallback((emojis: string[], x: number, y: number, count: number) => {
    const items: TouchSpark[] = Array.from({ length: count }, (_, i) => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3; // 위쪽 부채꼴
      const dist = 50 + Math.random() * 70;
      return {
        id: effectId.current++,
        emoji: emojis[i % emojis.length],
        x,
        y,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        rot: (Math.random() - 0.5) * 50,
        dur: 900 + Math.random() * 500,
        delay: i * 40,
        size: 1.2 + Math.random() * 0.9,
      };
    });
    setSparks((p) => [...p, ...items]);
    const ids = new Set(items.map((p) => p.id));
    setTimeout(() => setSparks((p) => p.filter((x) => !ids.has(x.id))), 1800);
  }, []);

  /**
   * 터치 반응 재생. 보이스톡 중이면 상대에게도 알려 준다(onTouchNotify).
   * 반환값: 고른 반응 id (보이스톡에 알리는 용도)
   */
  const handleTouch = useCallback(
    (x: number, y: number): TouchReactionId | null => {
      if (!persona) return null;
      const now = Date.now();
      const t = touchRef.current;
      t.combo = now - t.lastAt < BALANCE.touch.comboMs ? t.combo + 1 : 1;
      t.lastAt = now;

      // 물결은 매번, 반응은 너무 잦지 않게 (0.35초)
      const id = effectId.current++;
      const firing = now - t.lastFire > BALANCE.touch.fireGapMs;
      const zone = touchZoneOf(y / 100);
      const touchId = firing ? pickTouchReaction(zone, t.combo, affection, persona.relationshipType) : null;
      const def = touchId ? TOUCH_REACTIONS[touchId] : null;
      const lines = touchId ? persona.touchLines?.[touchId] ?? def?.lines : undefined;
      const line = lines && lines.length ? lines[Math.floor(Math.random() * lines.length)] : undefined;

      setMarks((m) => [
        // 한마디는 최신 것 하나만 남긴다
        ...m.map((x) => (line ? { ...x, line: undefined } : x)),
        { id, x, y, line, color: persona.accent },
      ]);
      setTimeout(() => setMarks((m) => m.filter((x) => x.id !== id)), 1900);

      if (!touchId || !def) {
        spawnSparks(["✨"], x, y, 2);
        return null;
      }
      t.lastFire = now;
      const d = director.decide({ type: "touch", touch: touchId, combo: t.combo }, directorCtx(affectionRef.current));
      applyDecision(d, { x, y });
      spawnSparks(d.particles ?? def.particles, x, y, d.video ? 8 : 6);
      if (d.reaction === "turn_away") {
        // 등 돌린 동안: 한마디도 토라진 말로
        const sulkLine = d.touchSulk ? "이제 안 놀아요!" : ["…흥.", "……", "달래 줘야 풀려요"][Math.floor(Math.random() * 3)];
        setMarks((m) => m.map((mk) => (mk.id === id ? { ...mk, line: sulkLine } : mk)));
      }
      voiceHandle.current?.notifyTouch(touchId);
      try {
        navigator.vibrate?.(touchId === "pout" ? [12, 40, 12] : 12);
      } catch {
        /* 진동 미지원 */
      }
      return touchId;
    },
    [persona, affection, spawnSparks, director, directorCtx, applyDecision]
  );

  /* ── 대화방 열기 / 지우기 ──────────────────────────────────────────────── */
  const openChat = useCallback(
    (id: PersonaId) => {
      const p = byId.get(id);
      if (!p) return;
      sessionRef.current += 1;
      const saved = loadChat(id);
      let msgs: ChatMessage[];
      if (saved && saved.messages.length > 0) {
        msgs = saved.messages;
        nextId.current = Math.max(...msgs.map((m) => m.id)) + 1;
        setAffection(saved.affection);
        affectionRef.current = saved.affection;
        bestStage.current = Math.max(saved.bestStage ?? 0, affectionStageIndex(saved.affection, p.relationshipType));
      } else {
        nextId.current = 0;
        msgs = [{ id: nextId.current++, role: "ai", kind: "text", text: p.greeting, at: Date.now(), local: true }];
        setAffection(AFFECTION_START);
        affectionRef.current = AFFECTION_START;
        bestStage.current = affectionStageIndex(AFFECTION_START, p.relationshipType);
      }
      // 삐짐 이어가기: 말로 삐진 것만, 시간이 지났으면 풀림
      if (sulkTimer.current) clearTimeout(sulkTimer.current);
      sulkReleasedAt.current = saved?.sulkReleasedAt;
      const restored = saved?.sulk && saved.sulk.cause === "words" && !sulkExpired(saved.sulk) ? saved.sulk : null;
      if (saved?.sulk && !restored && saved.sulk.cause === "words") {
        sulkReleasedAt.current = Date.now();
        msgs = [...msgs, { id: nextId.current++, role: "ai", kind: "notice", text: "시간이 지나 기분이 풀렸어요", at: Date.now(), local: true }];
      }
      setSulk(restored);
      setMessages(msgs);
      setPersonaId(id);
      writeStorage(LAST_KEY, id);
      setReaction(restored ? "turn_away" : "idle");
      setCue(restored ? { clips: AVATAR_REACTIONS.turn_away.clips, motion: "none", hold: true } : null);
      if (restored) setReactionKey((k) => k + 1);
      setPhotoOffer(null);
      director.reset();
      setStageBanner(null);
      setTeaser(null);
      setVoiceOpen(false);
      setInput("");
      setTyping(false);
      setBusy(false);
      setConfirmReset(false);

      // 6) 이어서 대화: 답을 못 받은 채 끝났으면 이어서 답장, 오래 비웠으면 상대가 먼저 말 걸기
      const texts = msgs.filter((m) => visibleText(m) && !m.local && !m.text.startsWith("⚠️"));
      const lastText = texts[texts.length - 1];
      const lastAt = msgs.length ? msgs[msgs.length - 1].at : 0;
      if (lastText?.role === "user") setAutoAction("unanswered");
      else if (texts.some((m) => m.role === "user") && Date.now() - lastAt > RETURN_GAP) setAutoAction("return");
      else setAutoAction(null);
    },
    [byId, director, setSulk]
  );

  const resetChat = useCallback(
    (id: PersonaId) => {
      writeStorage(chatKey(id), null);
      void deleteMediaFor(id); // 올린 사진·영상도 함께 지운다
      openChat(id);
      setAutoAction(null);
    },
    [openChat]
  );

  // 마지막으로 대화한 사람 복원
  useEffect(() => {
    const last = readStorage(LAST_KEY);
    if (last && byId.has(last)) openChat(last);
    setHydrated(true);
  }, [byId, openChat]);

  // 대화·호감도가 바뀔 때마다 저장
  useEffect(() => {
    if (!personaId || messages.length === 0) return;
    saveChat(personaId, { messages, affection, sulk, sulkReleasedAt: sulkReleasedAt.current, bestStage: bestStage.current });
  }, [personaId, messages, affection, sulk]);

  /** 다른 대화방으로 옮긴 뒤 도착한 답장을 원래 대화방 저장소에 기록 (다음에 열면 보임) */
  const persistToRoom = useCallback(
    (pid: PersonaId, bubbles: string[], tapback: HeartReactionId | null, targetId: number | null, affectionDelta: number) => {
      const stored = loadChat(pid);
      if (!stored) return;
      let id = Math.max(0, ...stored.messages.map((m) => m.id)) + 1;
      const now = Date.now();
      const add: ChatMessage[] = bubbles.map((t) => ({ id: id++, role: "ai", kind: "text", text: t, at: now }));
      let base = stored.messages.map((m) => (m.role === "user" && m.read === false ? { ...m, read: true } : m));
      if (tapback && targetId !== null) {
        base = base.filter((m) => !(m.kind === "reaction" && m.role === "ai" && m.targetId === targetId));
        add.push({ id: id++, role: "ai", kind: "reaction", text: tapback, targetId, at: now });
      }
      saveChat(pid, {
        messages: [...base, ...add],
        affection: clampAffection(stored.affection + affectionDelta),
        sulk: stored.sulk,
        sulkReleasedAt: stored.sulkReleasedAt,
        bestStage: stored.bestStage,
      });
    },
    []
  );

  /* ── 답장 받기 (공통) ──────────────────────────────────────────────────── */
  const requestReply = useCallback(
    async (msgs: ChatMessage[], kind: Turn["kind"], tapbackTargetId: number | null, heart?: HeartReactionId) => {
      if (!personaId) return;
      const pid = personaId;
      const session = sessionRef.current;
      const same = () => session === sessionRef.current;

      const turns = toTurns(msgs);
      if (kind === "return") turns.push({ role: "user", kind: "return", content: "", at: Date.now() });

      setBusy(true);
      // 가장 최근에 올린 사진·영상만 실제 장면을 붙인다
      const lastMedia = [...turns].reverse().find((t) => t.kind === "user_media");
      if (kind === "user_media" && lastMedia?.localKey) {
        const rec = await getMedia(lastMedia.localKey);
        if (rec) lastMedia.images = rec.frames;
      }
      const sendTurns = turns.map(({ localKey: _k, ...t }) => t);
      const req = fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: pid,
          messages: sendTurns,
          timeZone: userTimeZone(),
          affection: affectionRef.current,
          sentAlbumIds: msgs.flatMap((m) => (m.media?.albumId ? [m.media.albumId] : [])),
          allure: allureActive,
          sulk: sulkSummary(sulkRef.current),
        }),
      }).then(async (res) => {
        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(err?.error ?? `HTTP ${res.status}`);
        }
        return (await res.json()) as ChatResponse;
      });

      const markRead = () => setMessages((prev) => prev.map((m) => (m.role === "user" && m.read === false ? { ...m, read: true } : m)));

      try {
        // 메시지면: 잠시 뒤 읽음 → 입력 중 (마음 리액션·재접속은 답장 여부를 모르니 응답 후에)
        if (kind === "text") {
          await sleep(readDelay());
          if (same()) {
            markRead();
            setTyping(true);
          }
        }
        const data = await req;

        // 그사이 다른 대화방으로 옮겼으면: 원래 대화방 저장소에 답장을 기록해 둔다
        if (!same()) {
          persistToRoom(pid, data.messages, data.tapback, tapbackTargetId, data.affectionDelta);
          return;
        }

        markRead();

        // 삐짐: 시작 / 달래기 진행 / 풀림 (lib/sulk.ts)
        let sulkStart = false;
        let sulkRelease: "heart" | "words" | undefined;
        const cur = sulkRef.current;
        const dKind: AiEvent["kind"] =
          kind === "call" || kind === "media" ? "text" : kind === "user_media" ? "media" : kind;
        if (cur && kind !== "gift" && kind !== "return") {
          const r = checkRelease(cur, { kind, heart, delta: data.affectionDelta, soothed: data.soothed });
          if (r.release) {
            sulkRelease = r.release;
            if (sulkTimer.current) clearTimeout(sulkTimer.current);
            setSulk(null);
            sulkReleasedAt.current = Date.now();
          } else if (r.next && r.next.soothe !== cur.soothe) {
            setSulk(r.next);
            addNotice(`조금 누그러졌어요 (${r.next.soothe}/${sulkLevelDef(r.next.level).sootheNeeded})`);
          }
        } else if (!cur && kind !== "gift") {
          const lvl = sulkStartLevel({
            delta: data.affectionDelta,
            aiTurnAway: data.reaction === "turn_away",
            stageIndex: affectionStageIndex(affectionRef.current, persona?.relationshipType ?? "romance"),
            lastReleaseAt: sulkReleasedAt.current,
          });
          if (lvl) {
            sulkStart = true;
            setSulk({ level: lvl, cause: "words", at: Date.now(), soothe: 0 });
          }
        }
        // 호감도 (처음 올라선 단계면 보상 연출)
        const stageUp = applyAffection(data.affectionDelta);
        const reactOpts = { delta: data.affectionDelta, kind: dKind, heart, sulkStart, sulkRelease, stageUp: stageUp ?? undefined };

        // 유저가 올린 사진·영상: AI가 본 내용을 기억해 둔다
        if (kind === "user_media" && data.seen && tapbackTargetId !== null) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tapbackTargetId && m.media ? { ...m, media: { ...m.media, seen: data.seen } } : m))
          );
        }

        if (data.tapback && tapbackTargetId !== null) {
          const tb = data.tapback;
          setMessages((prev) => [
            ...prev.filter((m) => !(m.kind === "reaction" && m.role === "ai" && m.targetId === tapbackTargetId)),
            { id: nextId.current++, role: "ai", kind: "reaction", text: tb, targetId: tapbackTargetId, at: Date.now() },
          ]);
        }

        if (data.messages.length === 0) {
          playReaction(data.reaction, reactOpts); // 말 없이 표정만
          return;
        }

        for (let i = 0; i < data.messages.length; i++) {
          if (i > 0 || kind !== "text") {
            setTyping(true);
            await sleep(typingDelay(data.messages[i]));
            if (!same()) {
              // 말풍선이 나오는 도중에 방을 옮김 → 남은 말풍선만 원래 방에 기록 (호감도·마음은 이미 반영됨)
              persistToRoom(pid, data.messages.slice(i), null, null, 0);
              return;
            }
          }
          const text = data.messages[i];
          setMessages((prev) => [...prev, { id: nextId.current++, role: "ai", kind: "text", text, at: Date.now() }]);
          if (i === 0) playReaction(data.reaction, reactOpts);
        }

        // 단계 상승: 인물이 그 단계에 맞는 한마디를 덧붙인다 (personas/<id>.json traits.stageUpLines)
        const upLine = stageUp !== null ? persona?.traits.stageUpLines[stageUp - 1] : undefined;
        if (upLine) {
          setTyping(true);
          await sleep(900 + typingDelay(upLine));
          if (!same()) return;
          setMessages((prev) => [...prev, { id: nextId.current++, role: "ai", kind: "text", text: upLine, at: Date.now() }]);
          setTyping(false);
        }

        // 사진·영상: 앨범이면 "찍어 둔 거 보내 줄게요" 하고 바로 전송, 새 사진이면 유료 안내 모달
        const media = data.media;
        if (media?.action === "album") {
          setTyping(true);
          await sleep(700 + Math.random() * 600);
          if (!same()) return;
          const it = media.item;
          setMessages((prev) => [
            ...prev,
            { id: nextId.current++, role: "ai", kind: "media", text: it.desc, at: Date.now(), media: { type: it.type, src: it.src, albumId: it.id } },
          ]);
        } else if (media?.action === "custom") {
          setCashState(getCash());
          setPhotoOffer({ personaId: pid, request: media.request });
        }
      } catch (err) {
        if (!same()) return;
        console.error(err);
        markRead();
        const text = `⚠️ ${err instanceof Error ? err.message : "답장을 받지 못했어요. 다시 보내 주세요."}`;
        setMessages((prev) => [...prev, { id: nextId.current++, role: "ai", kind: "text", text, at: Date.now(), local: true }]);
      } finally {
        if (same()) {
          setTyping(false);
          setBusy(false);
        }
      }
    },
    [personaId, playReaction, persistToRoom, allureActive, persona, setSulk, applyAffection]
  );

  // 대화방을 연 직후 자동 동작 (한 번만)
  useEffect(() => {
    if (!autoAction || !personaId || busy) return;
    const action = autoAction;
    const t = setTimeout(() => {
      setAutoAction(null);
      const lastUser = [...messages].reverse().find((m) => m.role === "user" && visibleText(m));
      requestReply(messages, action === "return" ? "return" : "text", action === "unanswered" ? lastUser?.id ?? null : null);
    }, action === "return" ? 1500 : 400);
    return () => clearTimeout(t);
    // messages 는 연 시점의 값이면 충분 (autoAction 이 바뀔 때만 실행)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAction, personaId]);

  /* ── 보내기 ─────────────────────────────────────────────────────────── */
  const handleSubmit = useCallback(() => {
    const text = input.trim();
    if (!text || busy || !personaId) return;
    const userMsg: ChatMessage = { id: nextId.current++, role: "user", kind: "text", text, at: Date.now(), read: false };
    const msgs = [...messages, userMsg];
    setMessages(msgs);
    setInput("");
    setConfirmReset(false);
    requestReply(msgs, "text", userMsg.id);
  }, [input, busy, personaId, messages, requestReply]);

  const handleReact = useCallback(
    (targetId: number, heart: HeartReactionId) => {
      if (busy || !personaId) return;
      const ev: ChatMessage = { id: nextId.current++, role: "user", kind: "reaction", text: heart, targetId, at: Date.now() };
      // 같은 말풍선에 다시 달면 교체
      const msgs = [...messages.filter((m) => !(m.kind === "reaction" && m.role === "user" && m.targetId === targetId)), ev];
      setMessages(msgs);
      spawnBurst(HEART_REACTIONS[heart].emoji);
      spawnParticles([HEART_REACTIONS[heart].emoji], 4);
      requestReply(msgs, "reaction", null, heart);
    },
    [busy, personaId, messages, requestReply, spawnBurst, spawnParticles]
  );

  /* ── 유료 실시간 사진 ─────────────────────────────────────────────────── */
  const addNotice = (text: string) =>
    setMessages((prev) => [...prev, { id: nextId.current++, role: "ai", kind: "notice", text, at: Date.now(), local: true }]);

  const cancelPhoto = () => {
    setPhotoOffer(null);
    addNotice("사진 받기를 취소했어요");
  };

  const buyPhoto = async () => {
    const offer = photoOffer;
    if (!offer || photoBusy) return;
    // 구독 사진이 남았으면 그걸로, 아니면 캐시
    const usePlan = consumePlanPhoto();
    const cost = usePlan ? 0 : MEDIA_COST.photo;
    if (!usePlan && !spendCash(cost)) {
      setCashState(getCash());
      return;
    }
    const refund = () => (usePlan ? refundPlanPhoto() : refundCash(cost));
    refreshMembership();
    setPhotoOffer(null);
    setPhotoBusy(true);
    setTyping(true);
    const session = sessionRef.current;
    try {
      const pass = readPass();
      const res = await fetch("/api/media/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(pass ? { "x-voice-pass": pass } : {}) },
        body: JSON.stringify({ personaId: offer.personaId, request: offer.request, timeZone: userTimeZone() }),
      });
      const data = (await res.json().catch(() => ({}))) as { image?: string; mimeType?: string; error?: string };
      if (!res.ok || !data.image) throw new Error(data.error ?? `HTTP ${res.status}`);
      const src = await compressImage(data.image, data.mimeType ?? "image/png");
      if (session !== sessionRef.current) {
        refund(); // 받기 전에 다른 대화방으로 옮김 → 환불
        return;
      }
      setMessages((prev) => [
        ...prev,
        { id: nextId.current++, role: "ai", kind: "media", text: `방금 찍은 사진: ${offer.request}`, at: Date.now(), media: { type: "photo", src, generated: true } },
      ]);
      playReaction("shy");
    } catch (err) {
      refund();
      refreshMembership();
      if (session === sessionRef.current) {
        addNotice(`⚠️ ${err instanceof Error ? err.message : "사진을 받지 못했어요."} ${usePlan ? "사용한 사진 1장은" : `캐시 💎${cost}은`} 돌려드렸어요.`);
      }
    } finally {
      setPhotoBusy(false);
      if (session === sessionRef.current) setTyping(false);
    }
  };

  const toggleSound = () => {
    setSoundOn((on) => {
      writeStorage("ai-rpg.sound", on ? "0" : "1");
      return !on;
    });
  };

  /* ── 삐짐 달래기: 💎 선물 (즉시 풀림 + 특별 리액션) ─────────────────────── */
  const sendGift = () => {
    const s = sulkRef.current;
    if (!persona || !s || busy) return;
    const cost = giftCost(s);
    if (cost > 0 && !spendCash(cost)) {
      setCashState(getCash());
      addNotice(`💎 캐시가 부족해요 (필요 ${cost})`);
      refreshMembership();
      setPlansModal("menu");
      return;
    }
    setCashState(getCash());
    if (sulkTimer.current) clearTimeout(sulkTimer.current);
    setSulk(null);
    sulkReleasedAt.current = Date.now();
    const gift = persona.traits.gift;
    const giftMsg: ChatMessage = { id: nextId.current++, role: "user", kind: "gift", text: `${gift.emoji} ${gift.name}`, at: Date.now() };
    const msgs = [...messages, giftMsg];
    setMessages(msgs);
    spawnBurst(gift.emoji);
    spawnParticles([gift.emoji, "💗", "✨"], 10);
    const bonus = BALANCE.sulk.gift.affectionBonus;
    playReaction("love", { delta: bonus, kind: "gift", sulkRelease: "gift" });
    applyAffection(bonus);
    requestReply(msgs, "gift", null);
  };

  /* ── 사진·영상 올리기 (AI가 보고 반응) ───────────────────────────────── */
  const [uploading, setUploading] = useState(false);
  const handleAttach = async (file: File) => {
    if (!persona || busy || uploading) return;
    setUploading(true);
    try {
      const rec = await importFile(file, persona.id);
      const src = (await mediaUrl(rec.key)) ?? "";
      const caption = input.trim();
      const msg: ChatMessage = {
        id: nextId.current++,
        role: "user",
        kind: "media",
        text: caption,
        at: Date.now(),
        read: false,
        media: { type: rec.type, src, localKey: rec.key, duration: rec.duration },
      };
      const msgs = [...messages, msg];
      setMessages(msgs);
      setInput("");
      setConfirmReset(false);
      requestReply(msgs, "user_media", msg.id);
    } catch (err) {
      addNotice(`⚠️ ${err instanceof UserMediaError ? err.message : "파일을 보낼 수 없어요."}`);
    } finally {
      setUploading(false);
    }
  };

  /** 💋 매혹 모드 켜기/끄기 */
  const setAllureFor = (id: PersonaId, on: boolean) => {
    setAllureIds((prev) => {
      const next = on ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id);
      writeStorage(ALLURE_STORAGE.on, JSON.stringify(next));
      return next;
    });
  };
  const enableAllure = () => {
    if (!persona) return;
    setAllureFor(persona.id, true);
    setAllureGate(false);
    addNotice(`💋 매혹 모드를 켰어요 · ${persona.name} 님이 조금 더 대담해져요`);
    // 켠 순간 매혹 영상 하나로 분위기 전환
    const clips = Object.keys(persona.assets.allureClips ?? {});
    const d = director.allureIntro({ ...directorCtx(affectionRef.current), allureClips: clips });
    if (d) applyDecision(d);
    else spawnParticles(["💋", "✨", "💗"]);
  };
  const toggleAllure = () => {
    if (!persona?.allure) return;
    if (allureIds.includes(persona.id) && premiumUnlocked) {
      setAllureFor(persona.id, false);
      addNotice("매혹 모드를 껐어요");
      return;
    }
    if (!premiumUnlocked) {
      refreshMembership();
      setPlansModal("allure");
      return;
    }
    if (readStorage(ALLURE_STORAGE.adult) !== "1") {
      setAllureGate(true);
      return;
    }
    enableAllure();
  };

  const handleSelect = (id: PersonaId) => {
    setSelectorOpen(false);
    if (id !== personaId) openChat(id);
  };

  /** 대화 목록용: 대화방별 마지막 메시지 미리보기 */
  const previews = useCallback((): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const p of personas) {
      const msgs = p.id === personaId ? messages : loadChat(p.id)?.messages;
      const texts = msgs?.filter((m) => visibleText(m) && !m.text.startsWith("⚠️"));
      if (texts && texts.some((m) => !m.local)) out[p.id] = texts[texts.length - 1].text;
    }
    return out;
  }, [personas, personaId, messages]);

  /** 인물 화면 터치 (손가락 위치를 % 로 변환) */
  const onStagePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    handleTouch(x, y);
  };

  /* ── 보이스톡 ──────────────────────────────────────────────────────────── */
  /**
   * 보이스톡 시작 — 과금 방식 결정 (config/plans.ts)
   *  1) 무료 체험이 남았으면: 주고받기 N회까지
   *  2) 구독 통화 시간이 남았으면: 남은 시간까지
   *  3) 아니면: 멤버십/캐시 안내 모달
   */
  const startVoice = () => {
    if (busy || voiceOpen) return;
    setConfirmReset(false);
    const m = getMembership();
    const trialLeft = freeExchangesLeft(m);
    const planLeft = planVoiceSecondsLeft(m);
    if (trialLeft > 0) {
      setVoiceBilling({ mode: "trial", label: `🎁 무료 체험 · 주고받기 ${trialLeft}번 남음`, maxExchanges: trialLeft });
    } else if (planLeft > 0) {
      setVoiceBilling({ mode: "plan", label: `${PLANS[m.plan].name} · ${Math.ceil(planLeft / 60)}분 남음`, maxSeconds: planLeft });
    } else {
      refreshMembership();
      setPlansModal("voice");
      return;
    }
    setVoiceOpen(true);
  };

  /** 캐시로 통화 시작: 첫 1분을 먼저 차감 */
  const startCashCall = () => {
    if (!spendCash(CASH_PRICE.voicePerMinute)) {
      refreshMembership();
      return;
    }
    cashMinutesPaid.current = 1;
    refreshMembership();
    setPlansModal(null);
    setVoiceBilling({ mode: "cash", label: `💎 ${CASH_PRICE.voicePerMinute}/분 · 보유 💎${getCash()}` });
    setVoiceOpen(true);
  };

  /** 캐시 통화: 1분이 넘어갈 때마다 차감, 부족하면 하던 말 마저 듣고 종료 */
  const onVoiceTick = useCallback(
    (sec: number) => {
      if (voiceBilling?.mode !== "cash") return;
      const needed = Math.floor(sec / 60) + 1;
      if (needed <= cashMinutesPaid.current) return;
      if (spendCash(CASH_PRICE.voicePerMinute)) {
        cashMinutesPaid.current = needed;
        setCashState(getCash());
      } else {
        voiceHandle.current?.end("limit");
      }
    },
    [voiceBilling]
  );

  const onVoiceExchange = useCallback(() => {
    if (voiceBilling?.mode === "trial") consumeFreeExchange();
  }, [voiceBilling]);

  const endVoice = useCallback(
    ({ seconds, transcript, reason }: VoiceCallResult) => {
      setVoiceOpen(false);
      setVoiceSpeaking(false);
      // 사용량 정산 + 다음 단계 안내
      if (voiceBilling?.mode === "plan") addVoiceSeconds(seconds);
      // 캐시 통화가 연결도 못 하고 끝나면 먼저 낸 1분은 돌려준다
      if (voiceBilling?.mode === "cash" && seconds === 0) refundCash(cashMinutesPaid.current * CASH_PRICE.voicePerMinute);
      refreshMembership();
      if (reason === "trial") setPlansModal("trial-end");
      else if (reason === "limit") setPlansModal("voice");
      if (seconds <= 0 && transcript.length === 0) return;
      // 통화 내용을 톡 기록에 남긴다 → 이후 텍스트 대화가 통화 맥락을 이어 간다
      const lines = transcript.slice(-30).map<ChatMessage>((t) => ({
        id: nextId.current++,
        role: t.role,
        kind: "text",
        text: t.text.slice(0, 1000),
        at: t.at,
        via: "voice",
        read: true,
      }));
      const log: ChatMessage = { id: nextId.current++, role: "ai", kind: "call", text: String(seconds), at: Date.now() };
      setMessages((prev) => [...prev, ...lines, log]);
    },
    [voiceBilling, refreshMembership]
  );

  /* ── 화면 ─────────────────────────────────────────────────────────────── */
  if (!hydrated) return <main className="h-[100dvh] w-full bg-slate-950" />;

  if (!persona) {
    return (
      <main className="h-[100dvh] w-full bg-slate-950">
        <PersonaSelector personas={personas} currentId={null} onSelect={handleSelect} previews={previews()} />
      </main>
    );
  }

  const hasConversation = messages.some((m) => !m.local && visibleText(m));
  const stage = affectionStage(affection, persona.relationshipType);
  const prog = affectionProgress(affection, persona.relationshipType);
  const lastAiTextId =
    [...messages].reverse().find((m) => m.role === "ai" && (m.kind ?? "text") === "text" && !m.text.startsWith("⚠️"))?.id ?? null;

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-slate-950 wide:flex">
      {/* 리액션 화면: 폰/세로 = 전체 배경, 가로로 넓은 화면 = 왼쪽 절반 */}
      {/* 터치하면 인물이 반응한다 (폰에서는 메신저 빈 곳을 터치해도 이 화면으로 전달됨) */}
      <section
        className="absolute inset-0 touch-manipulation select-none wide:relative wide:inset-auto wide:w-1/2 wide:border-r wide:border-slate-800"
        onPointerDown={onStagePointerDown}
        data-touch-stage
      >
        <AvatarStage
          persona={persona}
          reaction={reaction}
          cue={cue}
          reactionKey={reactionKey}
          speaking={voiceSpeaking}
          premium={premiumUnlocked}
          allure={allureActive}
          sound={soundOn && !voiceOpen}
        />
        {/* 💋 매혹 모드 분위기 (가장자리 붉은 빛) */}
        {allureActive && (
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(190,24,93,0.22)_100%)]"
            data-allure-vignette
          />
        )}
        {/* 리액션 영상 소리 켜기/끄기 */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={toggleSound}
          aria-label={soundOn ? "리액션 소리 끄기" : "리액션 소리 켜기"}
          data-sound-toggle={soundOn ? "on" : "off"}
          className="absolute right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+4.25rem)] z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-base text-white/90 ring-1 ring-white/20 backdrop-blur wide:top-3"
        >
          {soundOn ? "🔊" : "🔇"}
        </button>
        {/* 💋 매혹 모드 켜기/끄기 (지원 인물만) */}
        {persona.allure && !voiceOpen && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={toggleAllure}
            aria-label={allureActive ? "매혹 모드 끄기" : "매혹 모드 켜기"}
            aria-pressed={allureActive}
            data-allure-toggle={allureActive ? "on" : "off"}
            className={`absolute right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+7rem)] z-10 flex h-9 w-9 items-center justify-center rounded-full text-base ring-1 backdrop-blur transition wide:top-14 ${
              allureActive ? "bg-rose-500/80 text-white ring-rose-200/70 shadow-[0_0_14px_rgba(244,63,94,.7)]" : "bg-black/35 text-white/90 ring-white/20 grayscale-[60%]"
            }`}
          >
            💋
          </button>
        )}
        {/* 등 돌린(삐진) 상태 안내 — 말로 풀어 주면 다시 돌아본다 */}
        {sulk && (
          <div
            className="absolute inset-x-0 top-[34%] z-10 flex justify-center px-4"
            data-sulking={sulk.level}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-xs rounded-2xl bg-black/60 px-3.5 py-2.5 text-center text-white shadow-lg ring-1 ring-white/15 backdrop-blur">
              <p className="text-xs font-semibold">
                💢 {persona.name} 님이 {sulkLevelDef(sulk.level).label}
                <span className="ml-1 text-[10px] font-normal text-white/60">({sulk.level}단계)</span>
              </p>
              <p className="mt-0.5 text-[11px] text-white/75">
                {sulk.cause === "touch" ? "잠시 뒤 풀려요 · 하트로 달래도 돼요" : sulkLevelDef(sulk.level).hint}
                {sulkLevelDef(sulk.level).sootheNeeded > 1 && sulk.cause === "words" && (
                  <span className="ml-1 text-pink-200">
                    ({sulk.soothe}/{sulkLevelDef(sulk.level).sootheNeeded})
                  </span>
                )}
              </p>
              <div className="mt-2 flex justify-center gap-1.5">
                {sulkLevelDef(sulk.level).freeHearts.length > 0 && lastAiTextId !== null && (
                  <>
                    {(["love", "like"] as const)
                      .filter((h) => (sulkLevelDef(sulk.level).freeHearts as string[]).includes(h))
                      .map((h) => (
                        <button
                          key={h}
                          type="button"
                          disabled={busy}
                          onClick={() => handleReact(lastAiTextId, h)}
                          data-sulk-heart={h}
                          className="rounded-full bg-white/15 px-2.5 py-1 text-sm hover:bg-white/25 disabled:opacity-50"
                        >
                          {HEART_REACTIONS[h].emoji}
                        </button>
                      ))}
                  </>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={sendGift}
                  data-sulk-gift={giftCost(sulk)}
                  className="rounded-full bg-gradient-to-r from-pink-500 to-rose-500 px-3 py-1 text-xs font-bold text-white shadow disabled:opacity-50"
                >
                  {persona.traits.gift.emoji} {persona.traits.gift.name} 선물 · 💎{giftCost(sulk)}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* 호감도 단계 상승 배너 */}
        {stageBanner && (
          <div key={stageBanner.key} className="pointer-events-none absolute inset-x-0 top-[22%] z-10 flex justify-center" data-stage-up={stageBanner.label}>
            <div className="stage-up-pop rounded-3xl bg-gradient-to-r from-pink-500/90 to-rose-500/90 px-5 py-3 text-center text-white shadow-2xl ring-1 ring-white/30">
              <p className="text-[11px] opacity-85">관계가 한 단계 가까워졌어요</p>
              <p className="text-lg font-extrabold">💗 {stageBanner.label}</p>
            </div>
          </div>
        )}
        {/* 유료 리액션 잠금 안내 (가끔만) */}
        {teaser && (
          <div className="pointer-events-none absolute inset-x-0 top-[30%] flex justify-center" data-teaser={teaser}>
            <span className="touch-line-static rounded-full bg-gradient-to-r from-pink-500 to-rose-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg">
              💋 {persona.name} 님의 특별한 리액션이 있어요 · PRO
            </span>
          </div>
        )}
        <EffectsLayer particles={particles} bursts={bursts} sparks={sparks} marks={marks} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5 pt-16 wide:block">
          <p className="text-lg font-semibold text-white">
            {persona.name}
            <span className="ml-2 text-sm font-normal text-slate-300">
              {persona.profile.age}세 · {persona.profile.occupation}
            </span>
          </p>
          <p className="text-sm" style={{ color: persona.accent }}>
            {persona.status}
          </p>
          {process.env.NODE_ENV !== "production" && (
            <p className="mt-1 text-xs text-slate-400" data-debug-reaction>
              reaction: {reaction} · 호감도 {Math.round(affection)}
            </p>
          )}
        </div>
      </section>

      {/* 메신저: 폰/세로 = 배경 위에 겹쳐서, 넓은 화면 = 오른쪽 절반 */}
      {/* 폰: 메신저가 인물 화면 위에 겹치므로 빈 곳은 터치가 통과(pointer-events-none)하고 실제 UI만 터치를 받는다 */}
      <section className="pointer-events-none absolute inset-0 flex flex-col bg-gradient-to-b from-black/55 via-transparent to-black/75 wide:pointer-events-auto wide:relative wide:inset-auto wide:w-1/2 wide:bg-none wide:bg-slate-950">
        <header className={`pointer-events-auto flex items-center gap-3 ${voiceOpen ? "invisible" : ""} px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] wide:border-b wide:border-slate-800`}>
          <PersonaPortrait
            persona={persona}
            size="sm"
            className="h-10 w-10 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/20"
          />
          <div className="min-w-[4.5rem] flex-1">
            <p className="truncate whitespace-nowrap text-sm font-semibold [text-shadow:0_1px_2px_rgba(0,0,0,.5)]" style={{ color: persona.accent }}>
              {persona.name}
            </p>
            <p className="truncate text-xs text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,.6)] wide:text-slate-400 wide:[text-shadow:none]">
              {photoBusy ? "사진 찍는 중…" : typing ? "입력 중…" : persona.status}
            </p>
            <div
              className="relative mt-1 flex items-center gap-1.5"
              title={prog.next ? `호감도 ${Math.round(affection)} · 다음 "${prog.next.label}"까지 ${prog.toNext}` : `호감도 ${Math.round(affection)} · 최고 단계`}
              data-affection={Math.round(affection)}
            >
              <span className="whitespace-nowrap text-[10px] font-semibold tabular-nums text-pink-300" data-affection-num>
                ♥ {Math.round(affection)}
              </span>
              <div className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-white/20" data-stage-progress={Math.round(prog.ratio * 100)}>
                <div className="h-full rounded-full bg-pink-400 transition-all duration-700" style={{ width: `${Math.round(prog.ratio * 100)}%` }} />
              </div>
              <span className="whitespace-nowrap text-[10px] text-white/80 wide:text-slate-400" data-stage>
                {stage.label}
                {prog.next && <span className="ml-0.5 text-[9px] text-white/50">({prog.toNext})</span>}
              </span>
              {affDelta && (
                <span
                  key={affDelta.key}
                  className={`aff-float absolute -top-3 left-6 text-[11px] font-bold ${affDelta.v > 0 ? "text-pink-300" : "text-sky-300"}`}
                  data-affection-delta={affDelta.v}
                >
                  {affDelta.v > 0 ? `+${affDelta.v}` : affDelta.v}
                </span>
              )}
              {/* 멤버십 배지 → 구독 안내 */}
              <button
                type="button"
                onClick={() => {
                  refreshMembership();
                  setPlansModal("menu");
                }}
                data-plan-badge={membership?.plan ?? "free"}
                className="ml-0.5 shrink-0 rounded-full px-1.5 py-px text-[9px] font-bold leading-tight ring-1 ring-white/30"
                style={{ color: membership && membership.plan !== "free" ? PLANS[membership.plan].color : "rgba(255,255,255,.75)" }}
              >
                {membership && membership.plan !== "free" ? `👑 ${PLANS[membership.plan].name}` : "멤버십"}
              </button>
            </div>
          </div>
          <button
            onClick={startVoice}
            disabled={busy || voiceOpen}
            aria-label="보이스톡 걸기"
            title="보이스톡 (유료)"
            data-voice-button
            className="relative shrink-0 rounded-full bg-pink-500/90 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-pink-500 disabled:opacity-50"
          >
            📞 보이스톡
            <span className="absolute -right-1 -top-1.5 rounded-full bg-amber-400 px-1 text-[9px] font-bold leading-tight text-slate-900">
              PRO
            </span>
          </button>
          {hasConversation &&
            (confirmReset ? (
              <button
                onClick={() => resetChat(persona.id)}
                className="shrink-0 rounded-lg bg-rose-600/90 px-3 py-1.5 text-xs text-white hover:bg-rose-600"
              >
                대화 지우기 확인
              </button>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                aria-label="처음부터"
                title="처음부터"
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/10 wide:text-slate-400"
              >
                <span className="wide:hidden" aria-hidden>↺</span>
                <span className="hidden wide:inline">처음부터</span>
              </button>
            ))}
          <button
            onClick={() => {
              setConfirmReset(false);
              setSelectorOpen(true);
            }}
            className="shrink-0 rounded-lg border border-white/30 bg-black/20 px-3 py-1.5 text-xs text-white backdrop-blur hover:bg-white/10 wide:border-slate-700 wide:bg-transparent wide:text-slate-300"
          >
            대화 목록
          </button>
        </header>
        <div className={`min-h-0 flex-1 ${voiceOpen ? "invisible" : ""}`}>
          <ChatPanel
            persona={persona}
            messages={messages}
            input={input}
            typing={typing}
            busy={busy}
            onInputChange={setInput}
            onSubmit={handleSubmit}
            onReact={handleReact}
            onAttach={handleAttach}
            uploading={uploading}
          />
        </div>
      </section>

      {voiceOpen && (
        <div className="pointer-events-none absolute inset-0 z-30 wide:right-1/2" data-voice-layer>
          <VoiceCall
            persona={persona}
            affection={affection}
            recent={toTurns(messages)
              .filter((t) => t.kind === "text")
              .map((t) => ({ role: t.role, content: t.content }))}
            allure={allureActive}
            onEnd={endVoice}
            onSpeakingChange={setVoiceSpeaking}
            onReaction={playVoiceReaction}
            registerHandle={(h) => {
              voiceHandle.current = h;
            }}
            billing={voiceBilling ?? { mode: "trial", label: "" }}
            onExchange={onVoiceExchange}
            onTick={onVoiceTick}
          />
        </div>
      )}

      {photoOffer && photoOffer.personaId === persona.id && (
        <MediaPurchaseModal
          persona={persona}
          request={photoOffer.request}
          cost={MEDIA_COST.photo}
          cash={cash}
          planPhotosLeft={membership ? planPhotosLeft(membership) : 0}
          planName={membership ? PLANS[membership.plan].name : ""}
          onShowPlans={() => setPlansModal("photo")}
          onConfirm={buyPhoto}
          onCancel={cancelPhoto}
          onTopUp={() => {
            // 결제 연동 전 테스트용 충전
            setCash(getCash() + DEMO_TOPUP);
            setCashState(getCash());
          }}
        />
      )}

      {allureGate && (
        <AllureGateModal
          persona={persona}
          onConfirm={() => {
            writeStorage(ALLURE_STORAGE.adult, "1");
            enableAllure();
          }}
          onCancel={() => setAllureGate(false)}
        />
      )}

      {plansModal && (
        <PlansModal
          reason={plansModal}
          currentPlan={membership?.plan ?? "free"}
          cash={cash}
          personaName={persona.name}
          onSubscribe={(plan: PlanId) => {
            // 결제 연동 전 테스트: 바로 구독 처리 + 보너스 캐시
            setPlanForTest(plan);
            if (PLANS[plan].bonusCash) setCash(getCash() + PLANS[plan].bonusCash);
            refreshMembership();
            addNotice(`👑 ${PLANS[plan].name} 멤버십이 시작됐어요 (테스트)`);
            setPlansModal(null);
          }}
          onTopUp={() => {
            setCash(getCash() + DEMO_TOPUP);
            refreshMembership();
          }}
          onCashCall={plansModal === "voice" || plansModal === "trial-end" ? startCashCall : undefined}
          onClose={() => setPlansModal(null)}
        />
      )}

      {selectorOpen && (
        <PersonaSelector
          personas={personas}
          currentId={persona.id}
          onSelect={handleSelect}
          onClose={() => setSelectorOpen(false)}
          previews={previews()}
        />
      )}
    </main>
  );
}
