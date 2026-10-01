"use client";

import { useCallback, useRef, useState } from "react";
import AvatarScene from "@/components/AvatarScene";
import ChatPanel from "@/components/ChatPanel";
import type {
  AvatarAnimation,
  CharacterState,
  ChatMessage,
  ChatResponse,
  Emotion,
} from "@/types/game";

const INITIAL_CHARACTER: CharacterState = { hp: 100, maxHp: 100 };

export default function Home() {
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
  const isDead = character.hp <= 0;

  const pushMessage = useCallback((role: ChatMessage["role"], text: string) => {
    setMessages((prev) => [...prev, { id: nextId.current++, role, text }]);
  }, []);

  const handleSubmit = useCallback(async () => {
    const message = input.trim();
    if (!message || loading || isDead) return;

    // 서버에는 지금까지의 전체 대화(+이번 입력)를 보내 문맥을 유지한다.
    const history = [
      ...messages.map((m) => ({
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

      pushMessage("ai", data.text);
      setEmotion(data.emotion);
      setAnimation(data.animation);
      setAnimationKey((k) => k + 1); // 같은 애니메이션도 재생되도록
      setCharacter((prev) => ({
        ...prev,
        hp: Math.min(prev.maxHp, Math.max(0, prev.hp + data.hp_change)),
      }));
    } catch (err) {
      console.error(err);
      pushMessage(
        "ai",
        `⚠️ ${err instanceof Error ? err.message : "응답을 받지 못했어요. 다시 시도해 주세요."}`
      );
    } finally {
      setLoading(false);
    }
  }, [input, loading, isDead, messages, character.hp, character.maxHp, pushMessage]);

  const handleReset = () => {
    setCharacter(INITIAL_CHARACTER);
    setMessages([]);
    setEmotion("neutral");
    setAnimation("idle");
    setAnimationKey((k) => k + 1);
  };

  const hpPercent = (character.hp / character.maxHp) * 100;

  return (
    <main className="flex h-screen w-full">
      {/* 좌측: 3D 아바타 */}
      <section className="relative w-1/2 border-r border-slate-800">
        <AvatarScene
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
          <p className="mt-2 text-xs text-slate-400">
            emotion: {emotion} · animation: {animation}
          </p>
        </div>

        {isDead && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70">
            <p className="text-2xl font-bold">GAME OVER</p>
            <button
              onClick={handleReset}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
            >
              다시 시작
            </button>
          </div>
        )}
      </section>

      {/* 우측: 채팅 */}
      <section className="w-1/2 bg-slate-950">
        <ChatPanel
          messages={messages}
          input={input}
          loading={loading}
          disabled={isDead}
          onInputChange={setInput}
          onSubmit={handleSubmit}
        />
      </section>
    </main>
  );
}
