"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AvatarStage from "@/components/AvatarStage";
import ChatPanel from "@/components/ChatPanel";
import EffectsLayer, { type Burst, type Particle } from "@/components/EffectsLayer";
import PersonaPortrait from "@/components/PersonaPortrait";
import PersonaSelector from "@/components/PersonaSelector";
import {
  AFFECTION_START,
  AVATAR_REACTIONS,
  HEART_REACTIONS,
  affectionStage,
  type AvatarReactionId,
  type HeartReactionId,
} from "@/config/reactions";
import type { Persona, PersonaId } from "@/lib/personas/types";
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
function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* 저장 불가 환경(시크릿 모드, 용량 초과 등)은 무시 */
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
  writeStorage(chatKey(id), JSON.stringify({ v: 2, messages: chat.messages.slice(-MAX_STORED), affection: chat.affection }));
}

/* -------------------------------------------------------------------------- */
/*  API 요청용 변환                                                             */
/* -------------------------------------------------------------------------- */
interface Turn {
  role: "user" | "assistant";
  kind: "text" | "reaction" | "return";
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

export default function ChatApp({ personas }: { personas: Persona[] }) {
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
  const [reactionKey, setReactionKey] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const effectId = useRef(0);

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

  const playReaction = useCallback(
    (r: AvatarReactionId) => {
      setReaction(r);
      setReactionKey((k) => k + 1);
      spawnParticles(AVATAR_REACTIONS[r]?.particles);
    },
    [spawnParticles]
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
    [byId]
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
    async (msgs: ChatMessage[], kind: Turn["kind"], tapbackTargetId: number | null) => {
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
        body: JSON.stringify({ personaId: pid, messages: turns, timeZone: userTimeZone(), affection }),
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
          playReaction(data.reaction); // 말 없이 표정만
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
          if (i === 0) playReaction(data.reaction);
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
      requestReply(msgs, "reaction", null);
    },
    [busy, personaId, messages, requestReply, spawnBurst, spawnParticles]
  );

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
      <section className="absolute inset-0 wide:relative wide:inset-auto wide:w-1/2 wide:border-r wide:border-slate-800">
        <AvatarStage persona={persona} reaction={reaction} reactionKey={reactionKey} />
        <EffectsLayer particles={particles} bursts={bursts} />
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
      <section className="absolute inset-0 flex flex-col bg-gradient-to-b from-black/55 via-transparent to-black/75 wide:relative wide:inset-auto wide:w-1/2 wide:bg-none wide:bg-slate-950">
        <header className="flex items-center gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] wide:border-b wide:border-slate-800">
          <PersonaPortrait
            persona={persona}
            size="sm"
            className="h-10 w-10 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/20"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold [text-shadow:0_1px_2px_rgba(0,0,0,.5)]" style={{ color: persona.accent }}>
              {persona.name}
            </p>
            <p className="truncate text-xs text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,.6)] wide:text-slate-400 wide:[text-shadow:none]">
              {typing ? "입력 중…" : persona.status}
            </p>
            <div className="mt-1 flex items-center gap-1.5" title={`호감도 ${Math.round(affection)}`} data-affection={Math.round(affection)}>
              <span className="text-[11px] text-pink-300">♥</span>
              <div className="h-1 w-12 shrink-0 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-pink-400 transition-all duration-700" style={{ width: `${affection}%` }} />
              </div>
              <span className="whitespace-nowrap text-[10px] text-white/80 wide:text-slate-400" data-stage>
                {stage.label}
              </span>
            </div>
          </div>
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
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/10 wide:text-slate-400"
              >
                처음부터
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
        <div className="min-h-0 flex-1">
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
