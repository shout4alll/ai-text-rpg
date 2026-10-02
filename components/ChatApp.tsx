"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AvatarStage from "@/components/AvatarStage";
import ChatPanel from "@/components/ChatPanel";
import PersonaPortrait from "@/components/PersonaPortrait";
import PersonaSelector from "@/components/PersonaSelector";
import type { Persona, PersonaId } from "@/lib/personas/types";
import type { AvatarAnimation, ChatMessage, ChatResponse, Emotion } from "@/types/game";

/* -------------------------------------------------------------------------- */
/*  브라우저 저장 (인물마다 대화방이 따로 저장된다)                               */
/* -------------------------------------------------------------------------- */
const LAST_KEY = "ai-rpg.personaId";
const chatKey = (id: PersonaId) => `ai-rpg.chat.${id}`;
const MAX_STORED = 300; // 대화방당 저장할 최대 메시지 수
const MAX_SEND = 40; // API로 보낼 최근 메시지 수

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

function loadChat(id: PersonaId): ChatMessage[] | null {
  const raw = readStorage(chatKey(id));
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(arr) && arr.every((m) => typeof m.text === "string" && typeof m.at === "number")
      ? arr
      : null;
  } catch {
    return null;
  }
}

function userTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** 말풍선 사이 '입력 중' 시간: 글자 수에 비례, 최대 1.8초 */
const typingDelay = (text: string) => Math.min(1800, 400 + text.length * 35);

/* -------------------------------------------------------------------------- */

export default function ChatApp({ personas }: { personas: Persona[] }) {
  const byId = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas]);

  const [hydrated, setHydrated] = useState(false);
  const [personaId, setPersonaId] = useState<PersonaId | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);

  // 리액션 (사진·영상)
  const [emotion, setEmotion] = useState<Emotion>("neutral");
  const [animation, setAnimation] = useState<AvatarAnimation>("idle");
  const [animationKey, setAnimationKey] = useState(0);

  const nextId = useRef(0);
  // 대화방을 바꾸면 증가 → 이전 대화방의 늦은 답장을 버린다
  const sessionRef = useRef(0);

  const persona = personaId ? byId.get(personaId) ?? null : null;

  const greetingOf = useCallback(
    (p: Persona): ChatMessage => ({ id: nextId.current++, role: "ai", text: p.greeting, at: Date.now(), local: true }),
    []
  );

  /** 대화방 열기: 저장된 대화가 있으면 이어서, 없으면 첫 메시지부터 */
  const openChat = useCallback(
    (id: PersonaId) => {
      const p = byId.get(id);
      if (!p) return;
      sessionRef.current += 1;
      const saved = loadChat(id);
      if (saved && saved.length > 0) {
        nextId.current = Math.max(...saved.map((m) => m.id)) + 1;
        setMessages(saved);
      } else {
        nextId.current = 0;
        setMessages([greetingOf(p)]);
      }
      setPersonaId(id);
      writeStorage(LAST_KEY, id);
      setEmotion("neutral");
      setAnimation("idle");
      setAnimationKey((k) => k + 1);
      setInput("");
      setTyping(false);
      setConfirmReset(false);
    },
    [byId, greetingOf]
  );

  /** 대화방 비우고 처음부터 */
  const resetChat = useCallback(
    (id: PersonaId) => {
      writeStorage(chatKey(id), null);
      openChat(id);
    },
    [openChat]
  );

  // 마지막으로 대화한 사람 복원
  useEffect(() => {
    const last = readStorage(LAST_KEY);
    if (last && byId.has(last)) openChat(last);
    setHydrated(true);
  }, [byId, openChat]);

  // 대화가 바뀔 때마다 저장
  useEffect(() => {
    if (!personaId || messages.length === 0) return;
    writeStorage(chatKey(personaId), JSON.stringify(messages.slice(-MAX_STORED)));
  }, [personaId, messages]);

  const handleSelect = (id: PersonaId) => {
    setSelectorOpen(false);
    if (id !== personaId) openChat(id);
  };

  const pushMessage = useCallback((role: ChatMessage["role"], text: string) => {
    setMessages((prev) => [...prev, { id: nextId.current++, role, text, at: Date.now() }]);
  }, []);

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || typing || !personaId) return;

    const session = sessionRef.current;
    const history = [
      ...messages
        .filter((m) => !m.local)
        .slice(-(MAX_SEND - 1))
        .map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("assistant" as const),
          content: m.text,
        })),
      { role: "user" as const, content: text },
    ];

    pushMessage("user", text);
    setInput("");
    setConfirmReset(false);
    setTyping(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId, messages: history, timeZone: userTimeZone() }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ChatResponse;

      // 말풍선을 하나씩, 사이사이 '입력 중'을 보여 주며 표시
      for (let i = 0; i < data.messages.length; i++) {
        if (session !== sessionRef.current) return; // 그사이 대화방이 바뀜
        if (i > 0) {
          await sleep(typingDelay(data.messages[i]));
          if (session !== sessionRef.current) return;
        }
        pushMessage("ai", data.messages[i]);
        if (i === 0) {
          setEmotion(data.emotion);
          setAnimation(data.animation);
          setAnimationKey((k) => k + 1);
        }
      }
    } catch (err) {
      if (session !== sessionRef.current) return;
      console.error(err);
      pushMessage("ai", `⚠️ ${err instanceof Error ? err.message : "답장을 받지 못했어요. 다시 보내 주세요."}`);
    } finally {
      if (session === sessionRef.current) setTyping(false);
    }
  }, [input, typing, personaId, messages, pushMessage]);

  /** 선택 화면용: 대화방별 마지막 메시지 미리보기 */
  const previews = useCallback((): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const p of personas) {
      const msgs = p.id === personaId ? messages : loadChat(p.id);
      if (msgs && msgs.some((m) => !m.local)) out[p.id] = msgs[msgs.length - 1].text;
    }
    return out;
  }, [personas, personaId, messages]);

  // 저장값 확인 전에는 빈 화면 (선택창이 깜빡이지 않도록)
  if (!hydrated) return <main className="h-screen w-full bg-slate-950" />;

  if (!persona) {
    return (
      <main className="h-screen w-full bg-slate-950">
        <PersonaSelector personas={personas} currentId={null} onSelect={handleSelect} previews={previews()} />
      </main>
    );
  }

  const hasConversation = messages.some((m) => !m.local);

  return (
    <main className="flex h-screen w-full">
      {/* 좌측: 인물 사진·영상 (답장에 맞춰 리액션) */}
      <section className="relative w-1/2 border-r border-slate-800">
        <AvatarStage
          persona={persona}
          animation={animation}
          animationKey={animationKey}
          emotion={emotion}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5 pt-16">
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
            <p className="mt-1 text-xs text-slate-400">
              emotion: {emotion} · animation: {animation}
            </p>
          )}
        </div>
      </section>

      {/* 우측: 메신저 */}
      <section className="flex w-1/2 flex-col bg-slate-950">
        <header className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
          <PersonaPortrait
            persona={persona}
            size="sm"
            className="h-10 w-10 shrink-0 overflow-hidden rounded-2xl"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: persona.accent }}>
              {persona.name}
            </p>
            <p className="truncate text-xs text-slate-400">{typing ? "입력 중…" : persona.status}</p>
          </div>
          {hasConversation &&
            (confirmReset ? (
              <button
                onClick={() => resetChat(persona.id)}
                className="shrink-0 rounded-lg bg-rose-600/80 px-3 py-1.5 text-xs text-white hover:bg-rose-600"
              >
                대화 지우기 확인
              </button>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
              >
                처음부터
              </button>
            ))}
          <button
            onClick={() => {
              setConfirmReset(false);
              setSelectorOpen(true);
            }}
            className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
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
            onInputChange={setInput}
            onSubmit={handleSubmit}
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
