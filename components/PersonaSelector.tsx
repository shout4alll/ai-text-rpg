"use client";

import { useState } from "react";
import PersonaPortrait from "@/components/PersonaPortrait";
import { BRAND } from "@/config/brand";
import { GemBadge } from "@/components/GemShop";
import { IconBackup, IconBell, IconChats, IconClose, IconSparkle } from "@/components/icons";
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
  /** 🎨 대화창 꾸미기 */
  onTheme?: () => void;
  /** 🔔 알림 설정 */
  onNotify?: () => void;
  gems?: number;
  onGems?: () => void;
  /** 대화방별 마지막 메시지 (대화한 적 있는 사람만) */
  previews?: Record<string, string>;
}

export default function PersonaSelector({
  personas,
  currentId,
  onSelect,
  onClose,
  onBackup,
  onTheme,
  onNotify,
  gems,
  onGems,
  previews = {},
}: PersonaSelectorProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = personas.filter((p) => filter === "all" || p.profile.gender === filter);
  const count = (f: Filter) =>
    f === "all" ? personas.length : personas.filter((p) => p.profile.gender === f).length;

  return (
    <div
      className="fade-in fixed inset-0 z-50 overflow-y-auto bg-paper"
      role="dialog"
      aria-modal="true"
      aria-labelledby="persona-selector-title"
    >
      {/* 상단 바 */}
      <div className="sticky top-0 z-10 border-b border-ink-line/70 bg-paper/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-400 text-onbrand shadow-glow">
              <IconChats className="h-[18px] w-[18px]" />
            </span>
            <span className="flex items-baseline gap-1.5"><span className="text-[19px] font-extrabold tracking-tight" data-brand>{BRAND.name}</span><span className="text-[12px] font-semibold text-ink-mute">{BRAND.ko}</span></span>
            {onGems && typeof gems === "number" && <GemBadge gems={gems} onClick={onGems} className="ml-1" />}
          </div>
          <div className="flex shrink-0 gap-2">
            {onTheme && (
              <button
                type="button"
                onClick={onTheme}
                aria-label="테마"
                data-selector-theme
                className="flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-sm text-ink-soft shadow-soft ring-1 ring-ink-line transition hover:text-ink"
              >
                <IconSparkle className="h-4 w-4" /> 테마
              </button>
            )}
            {onNotify && (
              <button
                type="button"
                onClick={onNotify}
                aria-label="알림 설정"
                data-selector-notify
                className="flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-sm text-ink-soft shadow-soft ring-1 ring-ink-line transition hover:text-ink"
              >
                <IconBell className="h-4 w-4" /> 알림
              </button>
            )}
            {onBackup && (
              <button
                type="button"
                onClick={onBackup}
                data-selector-backup
                className="flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-sm text-ink-soft shadow-soft ring-1 ring-ink-line transition hover:text-ink"
              >
                <IconBackup className="h-4 w-4" /> 백업
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                aria-label="닫기"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink-soft shadow-soft ring-1 ring-ink-line transition hover:text-ink"
              >
                <IconClose className="h-[18px] w-[18px]" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col px-4 pb-12 pt-7 sm:px-6">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">Messenger</p>
          <h1 id="persona-selector-title" className="mt-1.5 text-[26px] font-extrabold leading-tight tracking-tight sm:text-3xl">
            누구와 이야기해 볼까요?
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-mute">
            메시지로 천천히 알아 가는 사람들이에요. 대화는 사람마다 따로 저장돼서 언제든 이어서 할 수 있어요.
          </p>
        </div>

        <div className="mb-6 inline-flex w-fit gap-1 rounded-full bg-surface p-1 shadow-soft ring-1 ring-ink-line" role="tablist" aria-label="캐릭터 필터">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              data-filter={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-4 py-1.5 text-sm transition ${
                filter === f.id ? "bg-ink font-semibold text-white" : "text-ink-soft hover:text-ink"
              }`}
            >
              {f.label} <span className="opacity-60">{count(f.id)}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((p) => {
            const selected = p.id === currentId;
            return (
              <button
                key={p.id}
                type="button"
                data-persona={p.id}
                onClick={() => onSelect(p.id)}
                className={`group flex flex-col overflow-hidden rounded-[26px] bg-surface text-left shadow-soft ring-1 transition duration-300 hover:-translate-y-1 hover:shadow-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                  selected ? "ring-2" : "ring-ink-line"
                }`}
                style={selected ? ({ "--tw-ring-color": p.accent } as React.CSSProperties) : undefined}
              >
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-ink-line">
                  <PersonaPortrait
                    persona={p}
                    className="h-full w-full transition duration-500 group-hover:scale-[1.04]"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-4 pt-16">
                    <p className="text-xl font-bold text-white">{p.name}</p>
                    <p className="truncate text-xs text-white/80">
                      {p.profile.age}세 · {p.profile.occupation}
                    </p>
                  </div>
                  {previews[p.id] && !selected && (
                    <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-semibold text-ink shadow-soft backdrop-blur">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 대화 중
                    </span>
                  )}
                  {selected && (
                    <span className="absolute right-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-semibold text-ink shadow-soft backdrop-blur">
                      지금 대화 상대
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <p className="flex items-center gap-1.5 truncate text-xs font-medium text-ink-soft">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: p.accent }} />
                    <span className="truncate">{p.status}</span>
                  </p>
                  {previews[p.id] ? (
                    <p className="line-clamp-2 rounded-2xl bg-paper px-3 py-2 text-sm text-ink-soft" data-preview>
                      {previews[p.id]}
                    </p>
                  ) : (
                    <p className="line-clamp-3 text-sm leading-relaxed text-ink-mute">{p.description}</p>
                  )}
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    {p.tags.map((t) => (
                      <span key={t} className="rounded-full bg-paper px-2.5 py-0.5 text-[11px] text-ink-soft ring-1 ring-ink-line">
                        #{t}
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
