"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PersonaPortrait from "@/components/PersonaPortrait";
import { HEART_REACTIONS, HEART_REACTION_IDS, isHeartReactionId, type HeartReactionId } from "@/config/reactions";
import type { Persona } from "@/lib/personas/types";
import type { ChatMessage } from "@/types/game";

interface ChatPanelProps {
  persona: Persona;
  /** 말풍선 + 마음 리액션 이벤트가 섞인 전체 기록 */
  messages: ChatMessage[];
  input: string;
  /** 상대가 입력 중 (… 표시) */
  typing: boolean;
  /** 답장을 기다리는 중 (전송·리액션 잠금) */
  busy: boolean;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  /** 상대 메시지에 마음 리액션 달기 */
  onReact: (targetId: number, heart: HeartReactionId) => void;
}

const timeFmt = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "full" });
const dayKey = (t: number) => new Date(t).toDateString();
const minuteKey = (t: number) => Math.floor(t / 60000);

function HeartPicker({ onPick, className = "" }: { onPick: (h: HeartReactionId) => void; className?: string }) {
  return (
    <div
      className={`flex flex-wrap gap-1 rounded-2xl bg-slate-900/95 p-1.5 shadow-xl ring-1 ring-white/10 ${className}`}
      role="menu"
      aria-label="마음 리액션"
    >
      {HEART_REACTION_IDS.map((id) => (
        <button
          key={id}
          type="button"
          role="menuitem"
          data-heart={id}
          title={HEART_REACTIONS[id].label}
          onClick={() => onPick(id)}
          className="flex w-12 flex-col items-center rounded-xl py-1 transition hover:bg-white/10 active:scale-90"
        >
          <span className="text-xl leading-none">{HEART_REACTIONS[id].emoji}</span>
          <span className="mt-0.5 text-[9px] text-slate-300">{HEART_REACTIONS[id].label}</span>
        </button>
      ))}
    </div>
  );
}

export default function ChatPanel({
  persona,
  messages,
  input,
  typing,
  busy,
  onInputChange,
  onSubmit,
  onReact,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // 말풍선만 표시하고, 마음 리액션은 대상 말풍선의 배지로 붙인다 (역할별 최신 1개)
  const { bubbles, badges, lastAiId } = useMemo(() => {
    const bubbles = messages.filter((m) => (m.kind ?? "text") === "text" || m.kind === "call");
    const badges = new Map<number, { user?: HeartReactionId; ai?: HeartReactionId }>();
    for (const m of messages) {
      if (m.kind === "reaction" && m.targetId !== undefined && isHeartReactionId(m.text)) {
        const b = badges.get(m.targetId) ?? {};
        b[m.role === "user" ? "user" : "ai"] = m.text;
        badges.set(m.targetId, b);
      }
    }
    const lastAi = [...bubbles].reverse().find((m) => m.role === "ai" && m.kind !== "call" && !m.text.startsWith("⚠️"));
    return { bubbles, badges, lastAiId: lastAi?.id ?? null };
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // 마음 선택창이 열리면 보이도록 스크롤
  useEffect(() => {
    if (pickerFor !== null) pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [pickerFor]);

  const react = (targetId: number, h: HeartReactionId) => {
    setPickerFor(null);
    setPaletteOpen(false);
    onReact(targetId, h);
  };

  const aiBubble =
    "bg-black/45 text-white ring-1 ring-white/10 backdrop-blur-md wide:bg-slate-800 wide:text-slate-100 wide:ring-0 wide:backdrop-blur-none";
  const userBubble = "bg-indigo-600/90 text-white wide:bg-indigo-600";
  const metaText = "text-white/75 [text-shadow:0_1px_2px_rgba(0,0,0,.6)] wide:text-slate-500 wide:[text-shadow:none]";

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col justify-end">
        <div className="fade-top-mask pointer-events-auto max-h-[54dvh] overflow-y-auto px-3 pb-2 pt-16 wide:no-mask wide:max-h-none wide:flex-1 wide:px-4 wide:pt-4">
          {bubbles.map((m, i) => {
            const prev = bubbles[i - 1];
            const next = bubbles[i + 1];
            const newDay = !prev || dayKey(prev.at) !== dayKey(m.at);
            const startsGroup = newDay || !prev || prev.role !== m.role || minuteKey(prev.at) !== minuteKey(m.at);
            const endsGroup =
              !next || next.role !== m.role || minuteKey(next.at) !== minuteKey(m.at) || dayKey(next.at) !== dayKey(m.at);
            if (m.kind === "call") {
              const sec = Number(m.text) || 0;
              return (
                <div key={m.id} className="my-3 flex justify-center" data-call-log>
                  <span className="rounded-full bg-pink-500/25 px-3 py-1 text-[11px] text-pink-100 ring-1 ring-pink-300/30 backdrop-blur wide:text-pink-200">
                    📞 보이스톡 {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")} · {timeFmt.format(m.at)}
                  </span>
                </div>
              );
            }
            const isUser = m.role === "user";
            const badge = badges.get(m.id);
            const shownBadge = isUser ? badge?.ai : badge?.user;
            const canPick = !isUser && !busy && !m.text.startsWith("⚠️");

            return (
              <div key={m.id} data-msg-role={m.role}>
                {newDay && (
                  <div className="my-4 flex justify-center">
                    <span className="rounded-full bg-black/40 px-3 py-1 text-[11px] text-white/80 backdrop-blur wide:bg-slate-800/80 wide:text-slate-400">
                      {dateFmt.format(m.at)}
                    </span>
                  </div>
                )}
                <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"} ${startsGroup ? "mt-3" : "mt-1"}`}>
                  {!isUser && (
                    <div className="w-9 shrink-0">
                      {startsGroup && (
                        <PersonaPortrait persona={persona} size="sm" className="h-9 w-9 overflow-hidden rounded-2xl ring-1 ring-white/20" />
                      )}
                    </div>
                  )}
                  <div className={`flex max-w-[78%] flex-col ${isUser ? "items-end" : "items-start"}`}>
                    {!isUser && startsGroup && <span className={`mb-1 text-xs ${metaText}`}>{persona.name}</span>}
                    <div className={`flex items-end gap-1.5 ${isUser ? "flex-row-reverse" : ""}`}>
                      <button
                        type="button"
                        disabled={!canPick}
                        onClick={() => setPickerFor((p) => (p === m.id ? null : m.id))}
                        aria-label={canPick ? "마음 리액션 달기" : undefined}
                        data-bubble
                        className={`relative whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-left text-[15px] leading-relaxed wide:text-sm ${
                          isUser ? `rounded-tr-md ${userBubble}` : `rounded-tl-md ${aiBubble}`
                        } ${shownBadge ? "mb-3" : ""} ${canPick ? "cursor-pointer active:scale-[0.98]" : "cursor-default"}`}
                      >
                        {m.via === "voice" && (
                          <span className="mr-1 text-[11px] opacity-70" title="보이스톡 중에 한 말">
                            🎙
                          </span>
                        )}
                        {m.text}
                        {shownBadge && (
                          <span
                            className={`absolute -bottom-3 ${isUser ? "left-1" : "right-1"} rounded-full bg-slate-900/95 px-1.5 py-0.5 text-sm leading-none ring-1 ring-white/20`}
                            data-badge={shownBadge}
                            title={HEART_REACTIONS[shownBadge].label}
                          >
                            {HEART_REACTIONS[shownBadge].emoji}
                          </span>
                        )}
                      </button>
                      <div className={`flex shrink-0 flex-col pb-0.5 ${isUser ? "items-end" : "items-start"}`}>
                        {isUser && m.read === false && (
                          <span className="text-[10px] font-bold text-amber-300" data-unread>
                            1
                          </span>
                        )}
                        {endsGroup && <span className={`text-[10px] ${metaText}`}>{timeFmt.format(m.at)}</span>}
                      </div>
                    </div>
                    {pickerFor === m.id && canPick && (
                      <div ref={pickerRef} className="mt-2">
                        <HeartPicker className="max-w-[19rem]" onPick={(h) => react(m.id, h)} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {typing && (
            <div className="mt-3 flex items-center gap-2" aria-live="polite" aria-label={`${persona.name} 입력 중`}>
              <div className="w-9 shrink-0">
                <PersonaPortrait persona={persona} size="sm" className="h-9 w-9 overflow-hidden rounded-2xl ring-1 ring-white/20" />
              </div>
              <div className={`flex items-center gap-1 rounded-2xl rounded-tl-md px-4 py-3 ${aiBubble}`} data-typing>
                {[0, 150, 300].map((d) => (
                  <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/70" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="pointer-events-auto relative">
        {paletteOpen && lastAiId !== null && (
          <div className="absolute bottom-full left-3 z-10 mb-2">
            <HeartPicker className="max-w-[19rem]" onPick={(h) => react(lastAiId, h)} />
          </div>
        )}
        <form
          className="flex items-center gap-2 bg-black/35 px-3 pt-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] wide:border-t wide:border-slate-800 wide:bg-transparent wide:backdrop-blur-none"
          onSubmit={(e) => {
            e.preventDefault();
            setPaletteOpen(false);
            onSubmit();
          }}
        >
          <button
            type="button"
            onClick={() => setPaletteOpen((o) => !o)}
            disabled={busy || lastAiId === null}
            aria-label="마음 리액션 보내기"
            data-heart-button
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-pink-400 transition hover:bg-white/10 disabled:opacity-40"
          >
            ♥
          </button>
          <input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onFocus={() => setPaletteOpen(false)}
            placeholder="메시지를 입력하세요"
            maxLength={1000}
            enterKeyHint="send"
            className="min-w-0 flex-1 rounded-full border border-white/20 bg-black/40 px-4 py-2 text-base text-white outline-none placeholder:text-white/50 focus:border-indigo-400 wide:border-slate-700 wide:bg-slate-900 wide:text-sm"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="shrink-0 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            전송
          </button>
        </form>
      </div>
    </div>
  );
}
