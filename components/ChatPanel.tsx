"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/types/game";

interface ChatPanelProps {
  messages: ChatMessage[];
  input: string;
  loading: boolean;
  disabled?: boolean;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
}

export default function ChatPanel({
  messages,
  input,
  loading,
  disabled,
  onInputChange,
  onSubmit,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-slate-500">
            대화를 시작해 보세요.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                m.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-slate-100"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && <p className="text-sm text-slate-500">...</p>}
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
          disabled={loading || disabled}
          placeholder="메시지를 입력하세요..."
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || disabled || !input.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          전송
        </button>
      </form>
    </div>
  );
}
