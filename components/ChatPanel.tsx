"use client";

import { useEffect, useRef } from "react";
import PersonaPortrait from "@/components/PersonaPortrait";
import type { Persona } from "@/lib/personas/types";
import type { ChatMessage } from "@/types/game";

interface ChatPanelProps {
  persona: Persona;
  messages: ChatMessage[];
  input: string;
  /** 상대가 답장을 입력 중 (… 표시) */
  typing: boolean;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
}

const timeFmt = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "full" });
const dayKey = (t: number) => new Date(t).toDateString();
const minuteKey = (t: number) => Math.floor(t / 60000);

export default function ChatPanel({
  persona,
  messages,
  input,
  typing,
  onInputChange,
  onSubmit,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const newDay = !prev || dayKey(prev.at) !== dayKey(m.at);
          // 같은 사람이 같은 분에 연달아 보낸 말풍선은 한 묶음 (카카오톡처럼)
          const startsGroup = newDay || !prev || prev.role !== m.role || minuteKey(prev.at) !== minuteKey(m.at);
          const endsGroup = !next || next.role !== m.role || minuteKey(next.at) !== minuteKey(m.at) || dayKey(next.at) !== dayKey(m.at);
          const isUser = m.role === "user";

          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-4 flex justify-center">
                  <span className="rounded-full bg-slate-800/80 px-3 py-1 text-[11px] text-slate-400">
                    {dateFmt.format(m.at)}
                  </span>
                </div>
              )}
              <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"} ${startsGroup ? "mt-3" : ""}`}>
                {!isUser && (
                  <div className="w-9 shrink-0">
                    {startsGroup && (
                      <PersonaPortrait
                        persona={persona}
                        size="sm"
                        className="h-9 w-9 overflow-hidden rounded-2xl"
                      />
                    )}
                  </div>
                )}
                <div className={`flex max-w-[75%] flex-col ${isUser ? "items-end" : "items-start"}`}>
                  {!isUser && startsGroup && (
                    <span className="mb-1 text-xs text-slate-400">{persona.name}</span>
                  )}
                  <div className={`flex items-end gap-1.5 ${isUser ? "flex-row-reverse" : ""}`}>
                    <div
                      className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                        isUser ? "rounded-tr-md bg-indigo-600 text-white" : "rounded-tl-md bg-slate-800 text-slate-100"
                      }`}
                    >
                      {m.text}
                    </div>
                    {endsGroup && (
                      <span className="shrink-0 pb-0.5 text-[10px] text-slate-500">{timeFmt.format(m.at)}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {typing && (
          <div className="mt-3 flex items-center gap-2" aria-live="polite" aria-label={`${persona.name} 입력 중`}>
            <div className="w-9 shrink-0">
              <PersonaPortrait persona={persona} size="sm" className="h-9 w-9 overflow-hidden rounded-2xl" />
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-slate-800 px-4 py-3" data-typing>
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex gap-2 border-t border-slate-800 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="메시지를 입력하세요"
          maxLength={1000}
          className="flex-1 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={typing || !input.trim()}
          className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          전송
        </button>
      </form>
    </div>
  );
}
