"use client";

import { useEffect, useRef, useState } from "react";
import { DAYPART_LINES, LOBBY_NOTES, MOOD_LINES, SEASON_LINES } from "@/config/lobbyNotes";
import type { Persona } from "@/lib/personas/types";
import type { UserGender } from "@/lib/userProfile";

/**
 * 💌 로비 쪽지 — 로비에 머무는 동안 이성 인물이 먼저 짧은 인사를 보낸다 (config/lobbyNotes.ts).
 *  누르면 그 인물과의 대화방이 열리고, 쪽지가 첫 메시지로 들어간다.
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

export default function LobbyNotes({ personas, userGender, userName, onOpen }: { personas: Persona[]; userGender?: UserGender; userName?: string; onOpen: (personaId: string, text: string) => void }) {
  const [note, setNote] = useState<{ p: Persona; text: string } | null>(null);
  const count = useRef(0);

  useEffect(() => {
    if (!userGender) return;
    const want = userGender === "male" ? "female" : "male";
    const pool = personas.filter((p) => !p.cheatRoom && p.profile.gender === want);
    if (!pool.length) return;
    let timer: ReturnType<typeof setTimeout>;
    let hide: ReturnType<typeof setTimeout>;
    const send = () => {
      if (count.current >= LOBBY_NOTES.maxPerVisit) return;
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
        setNote({ p, text: makeNote(userName) });
        try {
          localStorage.setItem(SENT_KEY, JSON.stringify({ ...sent, [p.id]: Date.now() }));
        } catch {
          /* 무시 */
        }
        hide = setTimeout(() => setNote(null), LOBBY_NOTES.showSec * 1000);
      }
      timer = setTimeout(send, rand(LOBBY_NOTES.gapSec));
    };
    timer = setTimeout(send, rand(LOBBY_NOTES.firstDelaySec));
    return () => {
      clearTimeout(timer);
      clearTimeout(hide);
    };
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
        <p className="mt-3 text-[15px] leading-relaxed text-ink">{note.text}</p>
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
