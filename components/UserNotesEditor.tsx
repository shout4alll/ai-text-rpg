"use client";

import { useState } from "react";
import { freeCount, nextNoteCost, NOTE_LIMITS, type NoteKind, type UserNotes } from "@/lib/userNotes";

const KINDS: { kind: NoteKind; title: string; hint: string; ph: string }[] = [
  { kind: "world", title: "🌍 세계관 추가 요청", hint: "이 인물의 세계에 더하고 싶은 설정이에요. 대화에 자연스럽게 반영돼요.", ph: "예: 우리는 같은 동네 카페 단골 사이" },
  { kind: "wants", title: "💌 나의 요청사항", hint: "이 인물이 나에게 이렇게 해 줬으면 하는 것이에요. 기억하고 있다가 대화에 반영해요.", ph: "예: 내 하루가 어땠는지 먼저 물어봐 줘" },
];

/**
 * ✍️ 프로필 안의 "세계관 추가 요청 / 나의 요청사항" 편집 — 무료 개수를 넘기면 💎 보석이 든다 (지워도 환불 없음)
 * onAdd 는 실패 사유(문자열)를 돌려주고, 성공하면 null.
 */
export default function UserNotesEditor({
  notes,
  gems,
  onAdd,
  onRemove,
}: {
  notes: UserNotes;
  gems: number;
  onAdd: (kind: NoteKind, text: string) => string | null;
  onRemove: (kind: NoteKind, index: number) => void;
}) {
  const [draft, setDraft] = useState<Record<NoteKind, string>>({ world: "", wants: "" });
  const [err, setErr] = useState<{ kind: NoteKind; msg: string } | null>(null);

  return (
    <div className="space-y-3" data-user-notes>
      {KINDS.map(({ kind, title, hint, ph }) => {
        const list = notes[kind];
        const cost = nextNoteCost(kind, list.length);
        const full = list.length >= NOTE_LIMITS.maxItems;
        const submit = () => {
          const text = draft[kind].trim();
          if (!text) return;
          const e = onAdd(kind, text);
          if (e) setErr({ kind, msg: e });
          else {
            setErr(null);
            setDraft((d) => ({ ...d, [kind]: "" }));
          }
        };
        return (
          <section key={kind} className="rounded-2xl bg-paper p-3.5 ring-1 ring-ink-line" data-note-kind={kind}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-ink-mute">{title}</h3>
              <span className="text-[11px] text-ink-mute">
                무료 {freeCount(kind)}개 · {list.length}/{NOTE_LIMITS.maxItems}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-mute/90">{hint}</p>
            {list.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {list.map((t, i) => (
                  <li key={`${i}-${t}`} className="flex items-start gap-2 rounded-xl bg-surface px-3 py-2 text-[13px] ring-1 ring-ink-line">
                    <span className="flex-1 text-ink-soft">{t}</span>
                    <button type="button" onClick={() => onRemove(kind, i)} aria-label="지우기" data-note-remove className="shrink-0 text-xs text-ink-mute/80 hover:text-brand-600">
                      지우기
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!full && (
              <div className="mt-2 flex gap-2">
                <input
                  value={draft[kind]}
                  onChange={(e) => setDraft((d) => ({ ...d, [kind]: e.target.value.slice(0, NOTE_LIMITS.maxChars) }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
                  }}
                  placeholder={ph}
                  data-note-input={kind}
                  className="min-w-0 flex-1 rounded-xl bg-surface px-3 py-2 text-[13px] text-ink ring-1 ring-ink-line placeholder:text-ink-mute/60 focus:outline-none focus:ring-brand-400"
                />
                <button
                  type="button"
                  onClick={submit}
                  disabled={!draft[kind].trim()}
                  data-note-add={kind}
                  className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-40 ${cost > 0 && gems < cost ? "bg-rose-50 text-rose-600" : "bg-brand-500 text-onbrand"}`}
                >
                  {cost > 0 ? `💎 ${cost} 추가` : "추가"}
                </button>
              </div>
            )}
            {err?.kind === kind && <p className="mt-1.5 text-[11px] text-rose-600">{err.msg}</p>}
          </section>
        );
      })}
    </div>
  );
}
