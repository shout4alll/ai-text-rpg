"use client";

import { useEffect, useRef, useState } from "react";
import { DAYPART_LINES, LOBBY_NOTES, MOOD_LINES, SEASON_LINES } from "@/config/lobbyNotes";
import type { Persona } from "@/lib/personas/types";
import type { UserGender } from "@/lib/userProfile";

/**
 * 💌 로비 쪽지 — 로비에 머무는 동안 이성 인물이 먼저 짧은 쪽지를 보낸다 (config/lobbyNotes.ts).
 *  · 처음 보내는 쪽지(아직 대화가 없는 인물): 인사·호기심 문구 (config/lobbyNotes.ts, AI 호출 없음)
 *  · 이미 대화한 인물: 지난 대화·기억·흐른 시간·시간대를 종합해 AI 가 이어지는 말로 쓴다 (compose → /api/chat lobbyNote)
 *    AI 가 실패하면 그 인물에게는 이번에 쪽지를 보내지 않는다 (맥락 없는 인사를 대신 보내지 않음)
 *  누르면 그 인물과의 대화방이 열리고, 쪽지가 대화로 들어간다.
 */
const SENT_KEY = "ai-rpg.lobbyNotes";
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
const rand = ([a, b]: [number, number]) => (a + Math.random() * (b - a)) * 1000;

function season(m: number): keyof typeof SEASON_LINES {
  return m >= 2 && m <= 4 ? "spring" : m >= 5 && m <= 7 ? "summer" : m >= 8 && m <= 10 ? "autumn" : "winter";
}
function daypart(h: number): keyof typeof DAYPART_LINES {
  return h >= 5 && h < 11 ? "morning" : h >= 11 && h < 17 ? "noon" : h >= 17 && h < 22 ? "evening" : "night";
}
export function makeNote(userName?: string): string {
  const now = new Date();
  const nm = userName ? ` ${userName} 씨` : "";
  const parts = [pick(DAYPART_LINES[daypart(now.getHours())]).replace("{name}", nm), Math.random() < 0.6 ? pick(SEASON_LINES[season(now.getMonth())]) : null, pick(MOOD_LINES)];
  return parts.filter(Boolean).join(" ");
}

export default function LobbyNotes({
  personas,
  userGender,
  userName,
  onOpen,
  hasHistory,
  compose,
}: {
  personas: Persona[];
  userGender?: UserGender;
  userName?: string;
  onOpen: (personaId: string, text: string) => void;
  /** 이 인물과 이미 대화한 적이 있는지 */
  hasHistory?: (personaId: string) => boolean;
  /** 지난 대화를 바탕으로 쪽지(말풍선들)를 만든다 — 실패하면 null */
  compose?: (personaId: string) => Promise<string[] | null>;
}) {
  const [note, setNote] = useState<{ p: Persona; text: string } | null>(null);
  const count = useRef(0);

  useEffect(() => {
    if (!userGender) return;
    const want = userGender === "male" ? "female" : "male";
    const pool = personas.filter((p) => !p.cheatRoom && p.profile.gender === want);
    if (!pool.length) return;
    let timer: ReturnType<typeof setTimeout>;
    let hide: ReturnType<typeof setTimeout>;
    let alive = true;
    const send = async () => {
      if (!alive || count.current >= LOBBY_NOTES.maxPerVisit) return;
      let sent: Record<string, number> = {};
      try {
        sent = JSON.parse(localStorage.getItem(SENT_KEY) ?? "{}");
      } catch {
        /* 무시 */
      }
      const fresh = pool.filter((p) => Date.now() - (sent[p.id] ?? 0) > LOBBY_NOTES.samePersonaHours * 3_600_000);
      if (fresh.length) {
        const p = pick(fresh);
        count.current += 1;
        // 이미 대화한 인물이면 지난 대화에 이어지는 쪽지 (AI), 처음이면 인사·호기심 문구
        let text: string | null = null;
        if (hasHistory?.(p.id) && compose) {
          const lines = await compose(p.id).catch(() => null);
          text = lines?.length ? lines.join("\n") : null;
        } else {
          text = makeNote(userName);
        }
        try {
          localStorage.setItem(SENT_KEY, JSON.stringify({ ...sent, [p.id]: Date.now() }));
        } catch {
          /* 무시 */
        }
        if (text && alive) {
          setNote({ p, text });
          hide = setTimeout(() => setNote(null), LOBBY_NOTES.showSec * 1000);
        }
      }
      if (alive) timer = setTimeout(() => void send(), rand(LOBBY_NOTES.gapSec));
    };
    timer = setTimeout(() => void send(), rand(LOBBY_NOTES.firstDelaySec));
    return () => {
      alive = false;
      clearTimeout(timer);
      clearTimeout(hide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personas, userGender, userName]);

  if (!note) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-5" data-lobby-note-wrap>
      <div className="pointer-events-auto relative w-full max-w-sm rounded-3xl bg-surface/97 p-4 shadow-2xl ring-1 ring-brand-300/60 backdrop-blur" data-lobby-note={note.p.id}>
        <button type="button" onClick={() => setNote(null)} aria-label="쪽지 닫기" data-lobby-note-close className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] text-sm text-ink-soft">
          ✕
        </button>
        <div className="flex items-center gap-3 pr-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={note.p.assets.poster} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" style={{ objectPosition: note.p.assets.objectPosition }} />
          <span className="text-sm font-bold text-brand-600">💌 {note.p.name}의 쪽지</span>
        </div>
        <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink">{note.text}</p>
        <button
          type="button"
          onClick={() => {
            onOpen(note.p.id, note.text);
            setNote(null);
          }}
          data-lobby-note-reply
          className="mt-4 w-full rounded-full bg-brand-500 py-2.5 text-sm font-semibold text-onbrand"
        >
          답장하기
        </button>
      </div>
    </div>
  );
}
