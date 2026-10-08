"use client";

import { useState } from "react";
import PersonaPortrait from "@/components/PersonaPortrait";
import { IconClose, IconPhone, IconChats, IconGift, IconClock, IconHeart } from "@/components/icons";
import { affectionProgress, affectionStage } from "@/config/reactions";
import type { Persona } from "@/lib/personas/types";

export interface ProfileStats {
  /** 주고받은 말풍선 수 */
  messages: number;
  /** 첫 대화 시각 (없으면 아직 대화 전) */
  firstAt: number | null;
  /** 기억 노트 수 */
  memories: number;
  /** 지금까지 받은 사진·영상 */
  media: { src: string; type: "photo" | "video" }[];
}

const dateFmt = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" });

/**
 * 인물 프로필 — 헤더의 프로필 아이콘이나 대화 속 프로필 사진을 누르면 열린다.
 * 폰: 아래에서 올라오는 시트 / 넓은 화면: 가운데 카드
 */
export default function ProfileSheet({
  persona,
  affection,
  stats,
  onClose,
  onCall,
  kakao = false,
}: {
  persona: Persona;
  affection: number;
  stats: ProfileStats;
  onClose: () => void;
  onCall?: () => void;
  kakao?: boolean;
}) {
  const [viewer, setViewer] = useState<ProfileStats["media"][number] | null>(null);
  const stage = affectionStage(affection, persona.relationshipType);
  const prog = affectionProgress(affection, persona.relationshipType);
  const days = stats.firstAt ? Math.max(1, Math.ceil((Date.now() - stats.firstAt) / 86_400_000)) : 0;
  const accentBtn = kakao ? "bg-brand-400 text-onbrand" : "bg-gradient-to-r from-brand-500 to-brand-400 text-onbrand shadow-glow";

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${persona.name} 프로필`}
      data-profile-sheet={persona.id}
      onClick={onClose}
    >
      <div
        className="sheet-up relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-surface text-ink shadow-lift sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-y-auto">
          {/* 대표 사진 */}
          <div className="relative aspect-[4/5] max-h-[52dvh] w-full overflow-hidden bg-ink-line">
            <PersonaPortrait persona={persona} className="h-full w-full" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 text-white">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/70">Profile</p>
              <h2 className="mt-1 text-[28px] font-bold leading-tight">{persona.name}</h2>
              <p className="mt-0.5 text-sm text-white/85">
                {persona.profile.age}세 · {persona.profile.occupation}
              </p>
              <p className="mt-2 inline-flex max-w-full items-center rounded-full bg-surface/15 px-3 py-1 text-xs text-white/95 ring-1 ring-white/25 backdrop-blur">
                <span className="truncate">“{persona.status}”</span>
              </p>
            </div>
          </div>

          <div className="space-y-5 px-5 pb-6 pt-5">
            {/* 바로 하기 */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-paper py-3 text-sm font-semibold text-ink ring-1 ring-ink-line transition hover:bg-ink-line/60"
              >
                <IconChats className="h-[18px] w-[18px]" /> 대화하기
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCall?.();
                }}
                disabled={!onCall}
                data-profile-call
                className={`flex items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-semibold transition disabled:opacity-40 ${accentBtn}`}
              >
                <IconPhone className="h-[18px] w-[18px]" /> 보이스톡
              </button>
            </div>

            {/* 우리 사이 */}
            <section className="rounded-2xl bg-paper p-4 ring-1 ring-ink-line" data-profile-relation>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-ink-mute">우리 사이</p>
                <p className="flex items-center gap-1 text-xs font-semibold text-brand-500">
                  <IconHeart className="h-3.5 w-3.5" /> {Math.round(affection)}
                </p>
              </div>
              <p className="mt-1 text-lg font-bold">{stage.label}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-line">
                <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-500" style={{ width: `${Math.round(prog.ratio * 100)}%` }} />
              </div>
              <p className="mt-1.5 text-[11px] text-ink-mute">
                {prog.next ? `“${prog.next.label}”까지 ${prog.toNext} 남았어요` : "가장 가까운 사이예요"}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat label="함께한 날" value={days ? `${days}일` : "-"} />
                <Stat label="주고받은 말" value={stats.messages.toLocaleString()} />
                <Stat label="기억" value={`${stats.memories}개`} />
              </div>
              {stats.firstAt && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-ink-mute">
                  <IconClock className="h-3.5 w-3.5" /> {dateFmt.format(stats.firstAt)}에 처음 대화했어요
                </p>
              )}
            </section>

            {/* 소개 */}
            <section>
              <h3 className="text-xs font-semibold text-ink-mute">소개</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{persona.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {persona.tags.map((t) => (
                  <span key={t} className="rounded-full bg-paper px-2.5 py-1 text-xs text-ink-soft ring-1 ring-ink-line">
                    #{t}
                  </span>
                ))}
              </div>
            </section>

            {persona.story && (
              <section data-profile-story>
                <h3 className="text-xs font-semibold text-ink-mute">{persona.name}의 이야기</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{persona.story.background}</p>
                <div className="mt-3 space-y-2.5">
                  {persona.story.chapters.map((c) =>
                    affection >= c.min ? (
                      <div key={c.title} className="rounded-2xl bg-paper px-3.5 py-3 ring-1 ring-ink-line" data-story-chapter="open">
                        <p className="text-[13px] font-semibold text-ink">{c.title}</p>
                        <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{c.text}</p>
                      </div>
                    ) : (
                      <div key={c.title} className="rounded-2xl bg-paper px-3.5 py-3 text-[13px] text-ink-mute ring-1 ring-ink-line" data-story-chapter="locked">
                        🔒 호감도 {c.min} 이상이 되면 열려요
                      </div>
                    ),
                  )}
                </div>
              </section>
            )}

            {persona.details.lifestyle && (
              <section>
                <h3 className="text-xs font-semibold text-ink-mute">요즘 일상</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{persona.details.lifestyle}</p>
              </section>
            )}

            {(persona.details.likes.length > 0 || persona.details.dislikes.length > 0) && (
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {persona.details.likes.length > 0 && (
                  <div className="rounded-2xl bg-brand-50/70 p-3.5 ring-1 ring-brand-100">
                    <h3 className="text-xs font-semibold text-brand-600">좋아하는 것</h3>
                    <ul className="mt-1.5 space-y-1 text-sm text-ink-soft">
                      {persona.details.likes.map((x) => (
                        <li key={x}>· {x}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {persona.details.dislikes.length > 0 && (
                  <div className="rounded-2xl bg-paper p-3.5 ring-1 ring-ink-line">
                    <h3 className="text-xs font-semibold text-ink-mute">싫어하는 것</h3>
                    <ul className="mt-1.5 space-y-1 text-sm text-ink-soft">
                      {persona.details.dislikes.map((x) => (
                        <li key={x}>· {x}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            <section className="flex items-center gap-3 rounded-2xl bg-paper p-3.5 ring-1 ring-ink-line">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-xl shadow-soft">{persona.traits.gift.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-xs font-semibold text-ink-mute">
                  <IconGift className="h-3.5 w-3.5" /> 좋아하는 선물
                </p>
                <p className="text-sm font-semibold">{persona.traits.gift.name}</p>
              </div>
            </section>

            {/* 받은 사진·영상 */}
            <section>
              <h3 className="text-xs font-semibold text-ink-mute">
                받은 사진·영상 <span className="font-normal">{stats.media.length}</span>
              </h3>
              {stats.media.length ? (
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {stats.media.slice(-9).reverse().map((m, i) => (
                    <button
                      key={`${m.src}-${i}`}
                      type="button"
                      onClick={() => setViewer(m)}
                      className="relative aspect-square overflow-hidden rounded-xl bg-ink-line"
                    >
                      {m.type === "video" ? (
                        <video src={m.src} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.src} alt="" loading="lazy" className="h-full w-full object-cover" />
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-sm text-ink-mute">대화하다 사진을 부탁해 보세요.</p>
              )}
            </section>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          data-profile-close
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur transition hover:bg-black/45"
        >
          <IconClose className="h-5 w-5" />
        </button>
      </div>

      {viewer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={(e) => { e.stopPropagation(); setViewer(null); }}>
          {viewer.type === "video" ? (
            <video src={viewer.src} controls autoPlay playsInline className="max-h-full max-w-full rounded-xl" onClick={(e) => e.stopPropagation()} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={viewer.src} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface px-2 py-2 shadow-soft">
      <p className="text-[15px] font-bold tabular-nums">{value}</p>
      <p className="text-[10px] text-ink-mute">{label}</p>
    </div>
  );
}
