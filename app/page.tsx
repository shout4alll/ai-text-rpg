"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AvatarStage from "@/components/AvatarStage";
import ChatPanel from "@/components/ChatPanel";
import PersonaPortrait from "@/components/PersonaPortrait";
import PersonaSelector from "@/components/PersonaSelector";
import { PERSONA_LIST, getPersona, isPersonaId, type PersonaId } from "@/config/personas";
import type {
  AvatarAnimation,
  CharacterState,
  ChatMessage,
  ChatResponse,
  Emotion,
} from "@/types/game";

const INITIAL_CHARACTER: CharacterState = { hp: 100, maxHp: 100 };
const STORAGE_KEY = "ai-rpg.personaId";

function loadSavedPersona(): PersonaId | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isPersonaId(v) ? v : null;
  } catch {
    return null;
  }
}

function savePersona(id: PersonaId) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* 저장 불가 환경(시크릿 모드 등)은 무시 */
  }
}

export default function Home() {
  // 캐릭터(페르소나)
  const [hydrated, setHydrated] = useState(false);
  const [personaId, setPersonaId] = useState<PersonaId | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);

  // 유저 입력 & 채팅 로그
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  // 캐릭터 상태
  const [character, setCharacter] = useState<CharacterState>(INITIAL_CHARACTER);
  const [emotion, setEmotion] = useState<Emotion>("neutral");
  const [animation, setAnimation] = useState<AvatarAnimation>("idle");
  const [animationKey, setAnimationKey] = useState(0);

  const nextId = useRef(0);
  // 캐릭터 교체/재시작 시 증가 → 이전 세션의 늦은 응답을 버린다
  const sessionRef = useRef(0);

  const persona = personaId ? getPersona(personaId) : null;
  const isDead = character.hp <= 0;

  /** 선택한 캐릭터로 새 게임 시작 (인사말은 화면에만 표시, API 히스토리에서는 제외) */
  const startGame = useCallback((id: PersonaId) => {
    sessionRef.current += 1;
    setPersonaId(id);
    savePersona(id);
    setMessages([{ id: nextId.current++, role: "ai", text: getPersona(id).greeting, local: true }]);
    setCharacter(INITIAL_CHARACTER);
    setEmotion("neutral");
    setAnimation("idle");
    setAnimationKey((k) => k + 1);
    setInput("");
    setLoading(false);
  }, []);

  // 저장된 캐릭터 복원
  useEffect(() => {
    const saved = loadSavedPersona();
    if (saved) startGame(saved);
    setHydrated(true);
  }, [startGame]);

  const handleSelect = (id: PersonaId) => {
    setSelectorOpen(false);
    if (id !== personaId) startGame(id);
  };

  const pushMessage = useCallback((role: ChatMessage["role"], text: string) => {
    setMessages((prev) => [...prev, { id: nextId.current++, role, text }]);
  }, []);

  const handleSubmit = useCallback(async () => {
    const message = input.trim();
    if (!message || loading || isDead || !personaId) return;

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
        body: JSON.stringify({
          personaId,
          messages: history,
          hp: character.hp,
          maxHp: character.maxHp,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ChatResponse;
      if (session !== sessionRef.current) return; // 그사이 캐릭터가 바뀜

      pushMessage("ai", data.text);
      setEmotion(data.emotion);
      setAnimation(data.animation);
      setAnimationKey((k) => k + 1);
      setCharacter((prev) => ({
        ...prev,
        hp: Math.min(prev.maxHp, Math.max(0, prev.hp + data.hp_change)),
      }));
    } catch (err) {
      if (session !== sessionRef.current) return;
      console.error(err);
      pushMessage(
        "ai",
        `⚠️ ${err instanceof Error ? err.message : "응답을 받지 못했어요. 다시 시도해 주세요."}`
      );
    } finally {
      if (session === sessionRef.current) setLoading(false);
    }
  }, [input, loading, isDead, personaId, messages, character.hp, character.maxHp, pushMessage]);

  // 저장값 확인 전에는 빈 화면 (선택창이 깜빡이지 않도록)
  if (!hydrated) return <main className="h-screen w-full bg-slate-950" />;

  // 첫 방문: 캐릭터 선택부터
  if (!persona) {
    return (
      <main className="h-screen w-full bg-slate-950">
        <PersonaSelector personas={PERSONA_LIST} currentId={null} onSelect={handleSelect} />
      </main>
    );
  }

  const hpPercent = (character.hp / character.maxHp) * 100;
  const hasProgress = messages.some((m) => !m.local);

  return (
    <main className="flex h-screen w-full">
      {/* 좌측: 아바타 */}
      <section className="relative w-1/2 border-r border-slate-800">
        <AvatarStage
          persona={persona}
          animation={animation}
          animationKey={animationKey}
          emotion={emotion}
        />

        <div className="pointer-events-none absolute left-4 right-4 top-4">
          <div className="mb-1 flex justify-between text-xs font-medium">
            <span>HP</span>
            <span>
              {character.hp} / {character.maxHp}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-rose-500 transition-all duration-500"
              style={{ width: `${hpPercent}%` }}
            />
          </div>
          {process.env.NODE_ENV !== "production" && (
            <p className="mt-2 text-xs text-slate-300/80">
              emotion: {emotion} · animation: {animation}
            </p>
          )}
        </div>

        {isDead && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70">
            <p className="text-2xl font-bold">GAME OVER</p>
            <button
              onClick={() => startGame(persona.id)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
            >
              다시 시작
            </button>
          </div>
        )}
      </section>

      {/* 우측: 캐릭터 헤더 + 채팅 */}
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
          <button
            onClick={() => setSelectorOpen(true)}
            className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            캐릭터 변경
          </button>
        </header>
        <div className="min-h-0 flex-1">
          <ChatPanel
            messages={messages}
            input={input}
            loading={loading}
            disabled={isDead}
            onInputChange={setInput}
            onSubmit={handleSubmit}
          />
        </div>
      </section>

      {selectorOpen && (
        <PersonaSelector
          personas={PERSONA_LIST}
          currentId={persona.id}
          onSelect={handleSelect}
          onClose={() => setSelectorOpen(false)}
          hasProgress={hasProgress}
        />
      )}
    </main>
  );
}
