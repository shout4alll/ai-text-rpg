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
import { DEMO_TOPUP, MEDIA_COST } from "@/config/media";
import { getCash, refundCash, setCash, spendCash } from "@/lib/wallet";
import {
  AFFECTION_START,
  AVATAR_REACTIONS,
  HEART_REACTIONS,
  TOUCH_REACTIONS,
  affectionStage,
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
      return { v: 2, messages: d.messages, affection: typeof d.affection === "number" ? d.affection : AFFECTION_START };
    }
  } catch {
    /* 손상된 데이터는 무시 */
  }
  return null;
}

function saveChat(id: PersonaId, chat: Omit<StoredChat, "v">) {
  const messages = chat.messages.slice(-MAX_STORED);
  if (writeStorage(chatKey(id), JSON.stringify({ v: 2, messages, affection: chat.affection }))) return;
  // 용량 초과: 실시간 생성 사진(data URL)은 빼고 저장 (대화 기록은 지킨다)
  const slim = messages.map((m) =>
    m.media?.generated && m.media.src.startsWith("data:") ? { ...m, media: { ...m.media, src: "" } } : m
  );
  writeStorage(chatKey(id), JSON.stringify({ v: 2, messages: slim, affection: chat.affection }));
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
  kind: "text" | "reaction" | "return" | "call" | "media";
  content: string;
  target?: string;
  at?: number;
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
  const [sulking, setSulking] = useState(false);
  const [teaser, setTeaser] = useState<AvatarReactionId | null>(null);
  const affectionRef = useRef(affection);
  affectionRef.current = affection;
  const sulkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 유료 리액션 영상: 서버 설정(PREMIUM_ACCESS=open) 또는 PRIME 이상 구독 */
  const premiumUnlocked = premiumReactions || (membership ? PLANS[membership.plan].premiumReactions : false);

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
      } as const;
    },
    [persona, premiumUnlocked]
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
      if (d.sulk?.state === "start") {
        setSulking(true);
        if (sulkTimer.current) clearTimeout(sulkTimer.current);
        if (d.sulk.autoReleaseMs) {
          sulkTimer.current = setTimeout(() => {
            if (director.releaseTouchSulk()) {
              setSulking(false);
              setReaction("idle");
              setCue(null); // 멈춰 있던 등 돌린 장면을 풀고 기본 화면으로
              setReactionKey((k) => k + 1);
            }
          }, d.sulk.autoReleaseMs);
        }
      } else if (d.sulk?.state === "end") {
        setSulking(false);
        if (sulkTimer.current) clearTimeout(sulkTimer.current);
      }
      if (d.teaser) {
        setTeaser(d.teaser);
        setTimeout(() => setTeaser(null), 4500);
      }
    },
    [director, spawnParticles]
  );

  /** AI 답장·보이스톡 표정 → 연출 */
  const playReaction = useCallback(
    (r: AvatarReactionId, opts?: { delta?: number; kind?: Extract<DirectorEvent, { type: "ai" }>["kind"]; heart?: HeartReactionId }) => {
      const delta = opts?.delta ?? 0;
      const ev: DirectorEvent = { type: "ai", reaction: r, affectionDelta: delta, kind: opts?.kind ?? "text", heart: opts?.heart };
      applyDecision(director.decide(ev, directorCtx(clampAffection(affectionRef.current + delta))));
    },
    [applyDecision, director, directorCtx]
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
      t.combo = now - t.lastAt < 1200 ? t.combo + 1 : 1;
      t.lastAt = now;

      // 물결은 매번, 반응은 너무 잦지 않게 (0.35초)
      const id = effectId.current++;
      const firing = now - t.lastFire > 350;
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
        const sulkLine = d.sulk ? "이제 안 놀아요!" : ["…흥.", "……", "말 걸어 줘야 풀려요"][Math.floor(Math.random() * 3)];
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
      } else {
        nextId.current = 0;
        msgs = [{ id: nextId.current++, role: "ai", kind: "text", text: p.greeting, at: Date.now(), local: true }];
        setAffection(AFFECTION_START);
      }
      setMessages(msgs);
      setPersonaId(id);
      writeStorage(LAST_KEY, id);
      setReaction("idle");
      setCue(null);
      setPhotoOffer(null);
      director.reset();
      setSulking(false);
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
    [byId, director]
  );

  const resetChat = useCallback(
    (id: PersonaId) => {
      writeStorage(chatKey(id), null);
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
    saveChat(personaId, { messages, affection });
  }, [personaId, messages, affection]);

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
      saveChat(pid, { messages: [...base, ...add], affection: clampAffection(stored.affection + affectionDelta) });
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
      const req = fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: pid,
          messages: turns,
          timeZone: userTimeZone(),
          affection,
          sentAlbumIds: msgs.flatMap((m) => (m.media?.albumId ? [m.media.albumId] : [])),
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
        setAffection((a) => clampAffection(a + data.affectionDelta));
        if (data.tapback && tapbackTargetId !== null) {
          const tb = data.tapback;
          setMessages((prev) => [
            ...prev.filter((m) => !(m.kind === "reaction" && m.role === "ai" && m.targetId === tapbackTargetId)),
            { id: nextId.current++, role: "ai", kind: "reaction", text: tb, targetId: tapbackTargetId, at: Date.now() },
          ]);
        }

        if (data.messages.length === 0) {
          playReaction(data.reaction, { delta: data.affectionDelta, kind: kind === "call" || kind === "media" ? "text" : kind, heart }); // 말 없이 표정만
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
          if (i === 0) playReaction(data.reaction, { delta: data.affectionDelta, kind: kind === "call" || kind === "media" ? "text" : kind, heart });
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
    [personaId, affection, playReaction, persistToRoom]
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
          sound={soundOn && !voiceOpen}
        />
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
        {/* 등 돌린(삐진) 상태 안내 — 말로 풀어 주면 다시 돌아본다 */}
        {sulking && (
          <div className="pointer-events-none absolute inset-x-0 top-[38%] flex justify-center" data-sulking>
            <span className="rounded-full bg-black/55 px-3 py-1.5 text-xs text-white/90 backdrop-blur">
              💢 {persona.name} 님이 토라졌어요 · 다정하게 말을 걸어 보세요
            </span>
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
            <div className="mt-1 flex items-center gap-1.5" title={`호감도 ${Math.round(affection)}`} data-affection={Math.round(affection)}>
              <span className="text-[11px] text-pink-300">♥</span>
              <div className="h-1 w-12 shrink-0 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-pink-400 transition-all duration-700" style={{ width: `${affection}%` }} />
              </div>
              <span className="whitespace-nowrap text-[10px] text-white/80 wide:text-slate-400" data-stage>
                {stage.label}
              </span>
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
