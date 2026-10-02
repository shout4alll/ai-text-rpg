"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AvatarStage from "@/components/AvatarStage";
import ChatPanel from "@/components/ChatPanel";
import PersonaPortrait from "@/components/PersonaPortrait";
import PersonaSelector from "@/components/PersonaSelector";
import type { Persona, PersonaId } from "@/lib/personas/types";
import type { AvatarAnimation, ChatMessage, ChatResponse, Emotion } from "@/types/game";

const STORAGE_KEY = "ai-rpg.personaId";

function loadSaved(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function save(id: PersonaId) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* 저장 불가 환경(시크릿 모드 등)은 무시 */
  }
}

export default function ChatApp({ personas }: { personas: Persona[] }) {
  const byId = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas]);

  // 대화 상대
  const [hydrated, setHydrated] = useState(false);
  const [personaId, setPersonaId] = useState<PersonaId | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);

  // 입력 & 대화 로그
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  // 아바타 표정·몸짓
  const [emotion, setEmotion] = useState<Emotion>("neutral");
  const [animation, setAnimation] = useState<AvatarAnimation>("idle");
  const [animationKey, setAnimationKey] = useState(0);

  const nextId = useRef(0);
  // 상대 교체/새 대화 시 증가 → 이전 대화의 늦은 응답을 버린다
  const sessionRef = useRef(0);

  const persona = personaId ? byId.get(personaId) ?? null : null;

  /** 선택한 사람과 새 대화 시작 (첫 메시지는 화면에만 표시, API 히스토리에서는 제외) */
  const startChat = useCallback(
    (id: PersonaId) => {
      const p = byId.get(id);
      if (!p) return;
      sessionRef.current += 1;
      setPersonaId(id);
      save(id);
      setMessages([{ id: nextId.current++, role: "ai", text: p.greeting, local: true }]);
      setEmotion("neutral");
      setAnimation("idle");
      setAnimationKey((k) => k + 1);
      setInput("");
      setLoading(false);
    },
    [byId]
  );

  // 마지막으로 대화한 사람 복원 (목록에서 빠졌으면 무시)
  useEffect(() => {
    const saved = loadSaved();
    if (saved && byId.has(saved)) startChat(saved);
    setHydrated(true);
  }, [byId, startChat]);

  const handleSelect = (id: PersonaId) => {
    setSelectorOpen(false);
    if (id !== personaId) startChat(id);
  };

  const pushMessage = useCallback((role: ChatMessage["role"], text: string) => {
    setMessages((prev) => [...prev, { id: nextId.current++, role, text }]);
  }, []);

  const handleSubmit = useCallback(async () => {
    const message = input.trim();
    if (!message || loading || !personaId) return;

    const session = sessionRef.current;
    const history = [
      ...messages
        .filter((m) => !m.local)
        .map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("assistant" as const),
          content: m.text,
        })),
      { role: "user" as const, content: message },
    ];

    pushMessage("user", message);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId, messages: history }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ChatResponse;
      if (session !== sessionRef.current) return; // 그사이 상대가 바뀜

      pushMessage("ai", data.text);
      setEmotion(data.emotion);
      setAnimation(data.animation);
      setAnimationKey((k) => k + 1);
    } catch (err) {
      if (session !== sessionRef.current) return;
      console.error(err);
      pushMessage(
        "ai",
        `⚠️ ${err instanceof Error ? err.message : "답장을 받지 못했어요. 다시 보내 주세요."}`
      );
    } finally {
      if (session === sessionRef.current) setLoading(false);
    }
  }, [input, loading, personaId, messages, pushMessage]);

  // 저장값 확인 전에는 빈 화면 (선택창이 깜빡이지 않도록)
  if (!hydrated) return <main className="h-screen w-full bg-slate-950" />;

  // 첫 방문: 대화 상대 선택부터
  if (!persona) {
    return (
      <main className="h-screen w-full bg-slate-950">
        <PersonaSelector personas={personas} currentId={null} onSelect={handleSelect} />
      </main>
    );
  }

  const hasProgress = messages.some((m) => !m.local);

  return (
    <main className="flex h-screen w-full">
      {/* 좌측: 인물 */}
      <section className="relative w-1/2 border-r border-slate-800">
        <AvatarStage
          persona={persona}
          animation={animation}
          animationKey={animationKey}
          emotion={emotion}
        />

        {/* 영화 자막 같은 하단 캡션 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5 pt-16">
          <p className="text-lg font-semibold text-white">
            {persona.name}
            <span className="ml-2 text-sm font-normal text-slate-300">
              {persona.profile.age}세 · {persona.profile.occupation}
            </span>
          </p>
          <p className="text-sm" style={{ color: persona.accent }}>
            {persona.title}
          </p>
          {process.env.NODE_ENV !== "production" && (
            <p className="mt-1 text-xs text-slate-400">
              emotion: {emotion} · animation: {animation}
            </p>
          )}
        </div>
      </section>

      {/* 우측: 헤더 + 대화 */}
      <section className="flex w-1/2 flex-col bg-slate-950">
        <header className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
          <PersonaPortrait
            persona={persona}
            size="sm"
            className="h-10 w-10 shrink-0 overflow-hidden rounded-full"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: persona.accent }}>
              {persona.name}
            </p>
            <p className="truncate text-xs text-slate-400">{persona.title}</p>
          </div>
          {hasProgress && (
            <button
              onClick={() => startChat(persona.id)}
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
            >
              처음부터
            </button>
          )}
          <button
            onClick={() => setSelectorOpen(true)}
            className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            다른 사람
          </button>
        </header>
        <div className="min-h-0 flex-1">
          <ChatPanel
            messages={messages}
            input={input}
            loading={loading}
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
          hasProgress={hasProgress}
        />
      )}
    </main>
  );
}
