"use client";

import { useState } from "react";
import PersonaPortrait from "@/components/PersonaPortrait";
import type { Persona, PersonaId } from "@/lib/personas/types";

type Filter = "all" | "female" | "male";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "female", label: "여성" },
  { id: "male", label: "남성" },
];

interface PersonaSelectorProps {
  personas: Persona[];
  currentId: PersonaId | null;
  onSelect: (id: PersonaId) => void;
  /** 지정하면 닫기 버튼 표시 (게임 진행 중 교체할 때) */
  onClose?: () => void;
  /** 💾 대화 기록 백업 열기 */
  onBackup?: () => void;
  /** 대화방별 마지막 메시지 (대화한 적 있는 사람만) */
  previews?: Record<string, string>;
}

export default function PersonaSelector({
  personas,
  currentId,
  onSelect,
  onClose,
  onBackup,
  previews = {},
}: PersonaSelectorProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = personas.filter((p) => filter === "all" || p.profile.gender === filter);
  const count = (f: Filter) =>
    f === "all" ? personas.length : personas.filter((p) => p.profile.gender === f).length;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="persona-selector-title"
    >
      <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 id="persona-selector-title" className="text-2xl font-bold">
              누구와 이야기해 볼까요?
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              메시지로 천천히 알아 가는 사람들이에요. 대화는 사람마다 따로 저장돼서 언제든 이어서 할 수 있어요.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
          {onBackup && (
            <button
              type="button"
              onClick={onBackup}
              data-selector-backup
              className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              💾 백업
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              닫기
            </button>
          )}
          </div>
        </div>

        <div className="mb-5 flex gap-2" role="tablist" aria-label="캐릭터 필터">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              data-filter={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1 text-sm transition ${
                filter === f.id
                  ? "bg-slate-100 font-medium text-slate-900"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {f.label} <span className="opacity-60">{count(f.id)}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((p) => {
            const selected = p.id === currentId;
            return (
              <button
                key={p.id}
                type="button"
                data-persona={p.id}
                onClick={() => onSelect(p.id)}
                className={`group flex flex-col overflow-hidden rounded-2xl border bg-slate-900 text-left transition hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-2 ${
                  selected ? "border-2" : "border-slate-800"
                }`}
                style={selected ? { borderColor: p.accent } : undefined}
              >
                <div className="relative aspect-[4/5] w-full overflow-hidden">
                  <PersonaPortrait
                    persona={p}
                    className="h-full w-full transition duration-300 group-hover:scale-105"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10">
                    <p className="text-lg font-semibold text-white">{p.name}</p>
                    <p className="truncate text-xs text-slate-300">
                      {p.profile.age}세 · {p.profile.occupation}
                    </p>
                    <p className="mt-0.5 truncate text-xs" style={{ color: p.accent }}>
                      {p.status}
                    </p>
                  </div>
                  {previews[p.id] && !selected && (
                    <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
                      대화 중
                    </span>
                  )}
                  {selected && (
                    <span
                      className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium text-slate-950"
                      style={{ backgroundColor: p.accent }}
                    >
                      선택됨
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-3">
                  {previews[p.id] ? (
                    <p className="line-clamp-2 rounded-lg bg-slate-800/70 px-2.5 py-1.5 text-sm text-slate-200" data-preview>
                      {previews[p.id]}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-300">{p.description}</p>
                  )}
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    {p.tags.map((t) => (
                      <span key={t} className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
