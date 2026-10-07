"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PersonaPortrait from "@/components/PersonaPortrait";
import { HEART_REACTIONS, HEART_REACTION_IDS, isHeartReactionId, type HeartReactionId } from "@/config/reactions";
import type { Persona } from "@/lib/personas/types";
import type { ChatMessage } from "@/types/game";
import { mediaUrl } from "@/lib/userMedia";
import { IconHeart, IconImage, IconSend } from "@/components/icons";

export type ChatVariant = "default" | "kakao";

/** 화면 모드별 스타일 (default = 영상 위 / 넓은 화면은 wide: 로 오른쪽 패널, kakao = 메신저 모드) */
function stylesOf(v: ChatVariant) {
  // 색은 모두 테마 변수 (app/globals.css · config/themes.ts)
  if (v === "kakao") {
    return {
      scroll: "flex-1 overflow-y-auto px-3 pb-3 pt-3",
      ai: "bg-ai text-ai-ink shadow-[0_1px_1px_rgba(0,0,0,.04)]",
      user: "bg-me text-me-ink shadow-[0_1px_1px_rgba(0,0,0,.04)]",
      aiShape: "rounded-[16px] rounded-tl-[5px]",
      userShape: "rounded-[16px] rounded-tr-[5px]",
      meta: "text-chat-meta",
      name: "text-chat-name",
      chip: "bg-ink/10 text-chat-name",
      avatar: "h-10 w-10 overflow-hidden rounded-[15px]",
      avatarBox: "w-10",
      badge: "bg-surface ring-1 ring-ink-line shadow-soft",
      unread: "text-brand-600",
      dot: "bg-ink-mute",
      form: "bg-surface border-t border-ink-line",
      input: "bg-ink/[0.05] text-ink placeholder:text-ink-mute rounded-full focus:bg-surface focus:ring-1 focus:ring-ink-line",
      send: "rounded-full bg-brand-400 px-3.5 text-sm font-semibold text-onbrand disabled:bg-ink/5 disabled:text-ink-mute",
      iconBtn: "text-ink-soft hover:bg-ink/5",
      heartBtn: "text-brand-500 hover:bg-ink/5",
      picker: "bg-surface ring-1 ring-ink-line text-ink",
      pickerLabel: "text-ink-mute",
      call: "bg-surface/70 text-chat-name",
      mediaRing: "ring-1 ring-black/5",
      text: "text-[15px] leading-relaxed",
    };
  }
  return {
    scroll:
      "fade-top-mask max-h-[54dvh] overflow-y-auto px-3 pb-2 pt-16 wide:no-mask wide:max-h-none wide:flex-1 wide:px-6 wide:pt-6",
    ai: "bg-ai/95 text-ai-ink shadow-soft backdrop-blur-md wide:bg-ai wide:backdrop-blur-none",
    user: "bg-me text-me-ink shadow-[0_4px_14px_-8px_rgb(var(--b500)/.7)]",
    aiShape: "rounded-[20px] rounded-tl-md",
    userShape: "rounded-[20px] rounded-tr-md",
    meta: "text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,.6)] wide:text-chat-meta wide:[text-shadow:none]",
    name: "font-medium text-white [text-shadow:0_1px_2px_rgba(0,0,0,.6)] wide:text-chat-name wide:[text-shadow:none]",
    chip: "bg-surface/80 text-ink-soft shadow-soft backdrop-blur wide:bg-surface wide:ring-1 wide:ring-ink-line wide:shadow-none",
    avatar: "h-9 w-9 overflow-hidden rounded-2xl ring-2 ring-white/80 shadow-soft",
    avatarBox: "w-9",
    badge: "bg-surface ring-1 ring-ink-line shadow-soft",
    unread: "text-amber-300 wide:text-brand-600",
    dot: "bg-ink-mute/70",
    form: "border-t border-white/40 bg-surface/85 backdrop-blur-xl wide:border-ink-line wide:bg-surface wide:backdrop-blur-none",
    input: "bg-ink/[0.05] text-ink placeholder:text-ink-mute rounded-full focus:bg-surface focus:ring-2 focus:ring-brand-200",
    send: "flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-400 text-onbrand shadow-glow disabled:bg-none disabled:bg-ink/10 disabled:text-ink-mute disabled:shadow-none",
    iconBtn: "text-ink-soft hover:bg-ink/5",
    heartBtn: "text-brand-500 hover:bg-brand-50",
    picker: "bg-surface ring-1 ring-ink-line text-ink",
    pickerLabel: "text-ink-mute",
    call: "bg-surface/80 text-brand-600 shadow-soft backdrop-blur wide:bg-brand-50 wide:shadow-none",
    mediaRing: "ring-1 ring-black/5 shadow-soft",
    text: "text-[15px] leading-relaxed wide:text-[14.5px]",
  };
}
type Styles = ReturnType<typeof stylesOf>;

/** 유저가 올린 파일(IndexedDB)의 화면용 주소 — 저장된 기록을 다시 열 때 복원 */
function useLocalSrc(md: ChatMessage["media"] | undefined): string {
  const [src, setSrc] = useState(md?.src ?? "");
  useEffect(() => {
    if (md?.src) {
      setSrc(md.src);
      return;
    }
    if (!md?.localKey) return;
    let alive = true;
    mediaUrl(md.localKey).then((u) => {
      if (alive && u) setSrc(u);
    });
    return () => {
      alive = false;
    };
  }, [md?.src, md?.localKey]);
  return src;
}

/** 유저가 보낸 사진·영상 말풍선 */
function UserMediaBubble({
  m,
  badge,
  onOpen,
  S,
  timeLabel,
}: {
  m: ChatMessage;
  badge?: HeartReactionId;
  onOpen: (md: NonNullable<ChatMessage["media"]>) => void;
  S: Styles;
  timeLabel: string;
}) {
  const md = m.media!;
  const src = useLocalSrc(md);
  return (
    <div className="mt-3 flex justify-end gap-2" data-user-media={md.type}>
      <div className="flex max-w-[78%] flex-col items-end">
        <div className="flex flex-row-reverse items-end gap-1.5">
          <div className="relative">
            {src ? (
              <button
                type="button"
                onClick={() => onOpen({ ...md, src })}
                aria-label={md.type === "video" ? "내 영상 크게 보기" : "내 사진 크게 보기"}
                className={`relative block overflow-hidden rounded-2xl rounded-tr-md ${S.mediaRing}`}
              >
                {md.type === "video" ? (
                  <>
                    <video src={src} muted playsInline preload="metadata" className="block max-h-72 w-40 object-cover wide:w-44" />
                    <span className="absolute inset-0 flex items-center justify-center text-3xl text-white/90 [text-shadow:0_1px_6px_rgba(0,0,0,.6)]">
                      ▶
                    </span>
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="내가 보낸 사진" loading="lazy" className="block max-h-72 w-40 object-cover wide:w-44" />
                )}
              </button>
            ) : (
              <span className={`block rounded-2xl rounded-tr-md px-3.5 py-2 text-xs opacity-80 ${S.user}`}>
                {md.type === "video" ? "🎬 영상" : "🖼 사진"} (이 기기에 없음)
              </span>
            )}
            {badge && (
              <span
                className={`absolute -bottom-3 left-1 rounded-full px-1.5 py-0.5 text-sm leading-none ${S.badge}`}
                data-badge={badge}
                title={HEART_REACTIONS[badge].label}
              >
                {HEART_REACTIONS[badge].emoji}
              </span>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end pb-0.5">
            {m.read === false && <span className={`text-[10px] font-bold ${S.unread}`}>1</span>}
            <span className={`text-[10px] ${S.meta}`}>{timeLabel}</span>
          </div>
        </div>
        {m.text && (
          <span className={`${badge ? "mt-4" : "mt-1"} whitespace-pre-wrap break-words px-3.5 py-2 ${S.userShape} ${S.user} ${S.text}`}>
            {m.text}
          </span>
        )}
      </div>
    </div>
  );
}

/** 대화 속 프로필 사진 (누르면 프로필) */
function Avatar({ persona, S, onOpen }: { persona: Persona; S: Styles; onOpen?: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      aria-label={`${persona.name} 프로필 보기`}
      data-open-profile
      className="block transition active:scale-95"
    >
      <PersonaPortrait persona={persona} size="sm" className={S.avatar} />
    </button>
  );
}

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
  /** 사진·영상 보내기 */
  onAttach?: (file: File) => void;
  /** 파일 처리 중 */
  uploading?: boolean;
  /** 화면 모드 (기본 / 카톡 모드) */
  variant?: ChatVariant;
  /** 프로필 사진을 누르면 프로필 열기 */
  onOpenProfile?: () => void;
}

const timeFmt = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "full" });
const dayKey = (t: number) => new Date(t).toDateString();
const minuteKey = (t: number) => Math.floor(t / 60000);

function HeartPicker({ onPick, className = "", S }: { onPick: (h: HeartReactionId) => void; className?: string; S: Styles }) {
  return (
    <div
      className={`flex flex-wrap gap-1 rounded-2xl p-1.5 shadow-lift ${S.picker} ${className}`}
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
          className="flex w-12 flex-col items-center rounded-xl py-1 transition hover:bg-black/5 active:scale-90"
        >
          <span className="text-xl leading-none">{HEART_REACTIONS[id].emoji}</span>
          <span className={`mt-0.5 text-[9px] ${S.pickerLabel}`}>{HEART_REACTIONS[id].label}</span>
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
  onAttach,
  uploading = false,
  variant = "default",
  onOpenProfile,
}: ChatPanelProps) {
  const S = stylesOf(variant);
  const kakao = variant === "kakao";
  /** 대화 목록 스크롤 영역 — 맨 아래 고정은 여기서만 한다 (화면 전체가 같이 움직이지 않게) */
  const scrollRef = useRef<HTMLDivElement>(null);
  /** 지금 맨 아래 근처를 보고 있는가 (위로 올려 읽는 중이면 새 말풍선이 와도 끌어내리지 않는다) */
  const stick = useRef(true);
  /** 이미 처음 위치를 맞춘 방 */
  const settledRoom = useRef<string | null>(null);
  const settleTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  /** 크게 보기 */
  const [viewer, setViewer] = useState<ChatMessage["media"] | null>(null);

  // 말풍선만 표시하고, 마음 리액션은 대상 말풍선의 배지로 붙인다 (역할별 최신 1개)
  const { bubbles, badges, lastAiId } = useMemo(() => {
    const bubbles = messages.filter(
      (m) => (m.kind ?? "text") === "text" || m.kind === "call" || m.kind === "media" || m.kind === "notice" || m.kind === "gift"
    );
    const badges = new Map<number, { user?: HeartReactionId; ai?: HeartReactionId }>();
    for (const m of messages) {
      if (m.kind === "reaction" && m.targetId !== undefined && isHeartReactionId(m.text)) {
        const b = badges.get(m.targetId) ?? {};
        b[m.role === "user" ? "user" : "ai"] = m.text;
        badges.set(m.targetId, b);
      }
    }
    const lastAi = [...bubbles]
      .reverse()
      .find((m) => m.role === "ai" && (m.kind ?? "text") === "text" && !m.text.startsWith("⚠️"));
    return { bubbles, badges, lastAiId: lastAi?.id ?? null };
  }, [messages]);

  /** 코드가 마지막으로 스크롤을 내린 시각 — 그 직후의 스크롤 이벤트는 "유저가 위로 올려 읽는 중"으로 세지 않는다 */
  const autoAt = useRef(0);
  const toBottom = (smooth: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    autoAt.current = performance.now();
    stick.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "instant" });
  };

  // 위로 올려 읽는 중인지 기억
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      // 점프 직후 사진·글꼴이 늦게 로드되어 높이가 늘면 거리가 벌어져 보이므로, 직후 0.4초는 판단하지 않는다
      if (performance.now() - autoAt.current < 400) return;
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // 방에 들어오면 마지막 대화가 보이도록 즉시 맨 아래로. 사진·영상이 늦게 뜨며 높이가 바뀌어도 잠시 동안 다시 맞춘다.
  // 그 뒤 새 말풍선은 맨 아래를 보고 있을 때만 부드럽게 따라 내려간다.
  useEffect(() => {
    if (messages.length === 0) return;
    if (settledRoom.current !== persona.id) {
      settledRoom.current = persona.id;
      stick.current = true;
      settleTimers.current.forEach(clearTimeout);
      toBottom(false);
      settleTimers.current = [60, 250, 700, 1500].map((ms) => setTimeout(() => stick.current && toBottom(false), ms));
      return;
    }
    const mine = messages[messages.length - 1]?.role === "user";
    if (stick.current || mine) toBottom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona.id, messages, typing]);

  // 키보드가 올라오거나 화면 크기가 바뀌어도 맨 아래를 보고 있었다면 그대로 유지
  useEffect(() => {
    const vv = window.visualViewport;
    const onResize = () => stick.current && toBottom(false);
    window.addEventListener("resize", onResize);
    vv?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      vv?.removeEventListener("resize", onResize);
      settleTimers.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 마음 선택창이 열리면 보이도록 스크롤
  useEffect(() => {
    if (pickerFor !== null) pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [pickerFor]);

  const react = (targetId: number, h: HeartReactionId) => {
    setPickerFor(null);
    setPaletteOpen(false);
    onReact(targetId, h);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col justify-end">
        <div
          ref={scrollRef}
          className={`pointer-events-auto ${S.scroll}`}
          data-chat-variant={variant}
          onLoadCapture={() => stick.current && toBottom(false)}
          onLoadedMetadataCapture={() => stick.current && toBottom(false)}
        >
          {bubbles.map((m, i) => {
            const prev = bubbles[i - 1];
            const next = bubbles[i + 1];
            const newDay = !prev || dayKey(prev.at) !== dayKey(m.at);
            const startsGroup = newDay || !prev || prev.role !== m.role || minuteKey(prev.at) !== minuteKey(m.at);
            const endsGroup =
              !next || next.role !== m.role || minuteKey(next.at) !== minuteKey(m.at) || dayKey(next.at) !== dayKey(m.at);
            if (m.kind === "notice") {
              return (
                <div key={m.id} className="my-3 flex justify-center" data-notice>
                  <span className={`rounded-full px-3 py-1 text-[11px] ${S.chip}`}>
                    {m.text}
                  </span>
                </div>
              );
            }
            if (m.kind === "gift") {
              return (
                <div key={m.id} className="my-3 flex justify-center" data-gift>
                  <span className={`rounded-2xl px-4 py-2 text-xs font-semibold shadow-soft ${kakao ? "bg-surface text-ink" : "bg-gradient-to-r from-brand-500 to-brand-400 text-onbrand"}`}>
                    🎁 {m.text} 을(를) 선물했어요 · {timeFmt.format(m.at)}
                  </span>
                </div>
              );
            }
            if (m.kind === "media" && m.media && m.role === "user") {
              return (
                <UserMediaBubble
                  key={m.id}
                  m={m}
                  badge={badges.get(m.id)?.ai}
                  onOpen={(md) => setViewer(md)}
                  S={S}
                  timeLabel={timeFmt.format(m.at)}
                />
              );
            }
            if (m.kind === "media" && m.media) {
              const md = m.media;
              const first = !prev || prev.role !== "ai" || minuteKey(prev.at) !== minuteKey(m.at);
              return (
                <div key={m.id} className={`flex gap-2 ${first ? "mt-3" : "mt-1"}`} data-media={md.type}>
                  <div className={`${S.avatarBox} shrink-0`}>
                    {first && (
                      <Avatar persona={persona} S={S} onOpen={onOpenProfile} />
                    )}
                  </div>
                  <div className="flex items-end gap-1.5">
                    {md.src ? (
                      <button
                        type="button"
                        onClick={() => setViewer(md)}
                        aria-label={md.type === "video" ? "영상 크게 보기" : "사진 크게 보기"}
                        className={`relative block overflow-hidden rounded-2xl rounded-tl-md ${S.mediaRing}`}
                      >
                        {md.type === "video" ? (
                          <>
                            <video src={md.src} muted playsInline preload="metadata" className="block w-40 object-cover wide:w-44" style={{ aspectRatio: "9 / 16" }} />
                            <span className="absolute inset-0 flex items-center justify-center text-3xl text-white/90 [text-shadow:0_1px_6px_rgba(0,0,0,.6)]">
                              ▶
                            </span>
                          </>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={md.src} alt="사진" loading="lazy" className="block max-h-72 w-40 object-cover wide:w-44" />
                        )}
                        {md.generated && (
                          <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] text-white/90">AI 생성</span>
                        )}
                      </button>
                    ) : (
                      <span className={`rounded-2xl px-3.5 py-2 text-xs ${S.ai}`}>사진은 이 기기에 저장되지 않았어요</span>
                    )}
                    <span className={`pb-0.5 text-[10px] ${S.meta}`}>{timeFmt.format(m.at)}</span>
                  </div>
                </div>
              );
            }
            if (m.kind === "call") {
              const sec = Number(m.text) || 0;
              return (
                <div key={m.id} className="my-3 flex justify-center" data-call-log>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${S.call}`}>
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
                    <span className={`rounded-full px-3 py-1 text-[11px] ${S.chip}`}>
                      {dateFmt.format(m.at)}
                    </span>
                  </div>
                )}
                <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"} ${startsGroup ? "mt-3" : "mt-1"}`}>
                  {!isUser && (
                    <div className={`${S.avatarBox} shrink-0`}>
                      {startsGroup && (
                        <Avatar persona={persona} S={S} onOpen={onOpenProfile} />
                      )}
                    </div>
                  )}
                  <div className={`flex max-w-[78%] flex-col ${isUser ? "items-end" : "items-start"}`}>
                    {!isUser && startsGroup && <span className={`mb-1 text-xs ${S.name}`}>{persona.name}</span>}
                    <div className={`flex items-end gap-1.5 ${isUser ? "flex-row-reverse" : ""}`}>
                      <button
                        type="button"
                        disabled={!canPick}
                        onClick={() => setPickerFor((p) => (p === m.id ? null : m.id))}
                        aria-label={canPick ? "마음 리액션 달기" : undefined}
                        data-bubble
                        className={`relative whitespace-pre-wrap break-words px-3.5 py-2 text-left ${S.text} ${
                          isUser ? `${S.userShape} ${S.user}` : `${S.aiShape} ${S.ai}`
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
                            className={`absolute -bottom-3 ${isUser ? "left-1" : "right-1"} rounded-full px-1.5 py-0.5 text-sm leading-none ${S.badge}`}
                            data-badge={shownBadge}
                            title={HEART_REACTIONS[shownBadge].label}
                          >
                            {HEART_REACTIONS[shownBadge].emoji}
                          </span>
                        )}
                      </button>
                      <div className={`flex shrink-0 flex-col pb-0.5 ${isUser ? "items-end" : "items-start"}`}>
                        {isUser && m.read === false && (
                          <span className={`text-[10px] font-bold ${S.unread}`} data-unread>
                            1
                          </span>
                        )}
                        {endsGroup && <span className={`text-[10px] ${S.meta}`}>{timeFmt.format(m.at)}</span>}
                      </div>
                    </div>
                    {pickerFor === m.id && canPick && (
                      <div ref={pickerRef} className="mt-2">
                        <HeartPicker S={S} className="max-w-[19rem]" onPick={(h) => react(m.id, h)} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {typing && (
            <div className="mt-3 flex items-center gap-2" aria-live="polite" aria-label={`${persona.name} 입력 중`}>
              <div className={`${S.avatarBox} shrink-0`}>
                <Avatar persona={persona} S={S} onOpen={onOpenProfile} />
              </div>
              <div className={`flex items-center gap-1 px-4 py-3 ${S.aiShape} ${S.ai}`} data-typing>
                {[0, 150, 300].map((d) => (
                  <span key={d} className={`h-1.5 w-1.5 animate-bounce rounded-full ${S.dot}`} style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {viewer && (
        <div
          className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setViewer(null)}
          role="dialog"
          aria-label="크게 보기"
          data-media-viewer
        >
          {viewer.type === "video" ? (
            <video src={viewer.src} controls autoPlay playsInline className="max-h-full max-w-full rounded-xl" onClick={(e) => e.stopPropagation()} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={viewer.src} alt="사진" className="max-h-full max-w-full rounded-xl object-contain" />
          )}
          <button type="button" className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] text-2xl text-white/80" aria-label="닫기">
            ✕
          </button>
        </div>
      )}

      <div className="pointer-events-auto relative">
        {paletteOpen && lastAiId !== null && (
          <div className="absolute bottom-full left-3 z-10 mb-2">
            <HeartPicker S={S} className="max-w-[19rem]" onPick={(h) => react(lastAiId, h)} />
          </div>
        )}
        <form
          className={`flex items-center gap-1.5 px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] ${S.form}`}
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
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition disabled:opacity-40 ${S.heartBtn}`}
          >
            <IconHeart className="h-[22px] w-[22px]" />
          </button>
          {onAttach && (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy || uploading}
                aria-label="사진·영상 보내기"
                title="사진·영상 보내기"
                data-attach-button
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition disabled:opacity-40 ${S.iconBtn}`}
              >
                {uploading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-mute/40 border-t-ink-soft" /> : <IconImage className="h-[22px] w-[22px]" />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                data-attach-input
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) onAttach(f);
                }}
              />
            </>
          )}
          <input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onFocus={() => setPaletteOpen(false)}
            placeholder="메시지를 입력하세요"
            maxLength={1000}
            enterKeyHint="send"
            className={`h-10 min-w-0 flex-1 px-4 text-base outline-none transition wide:text-[14.5px] ${S.input}`}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="전송"
            data-send
            className={`h-10 shrink-0 transition disabled:cursor-not-allowed ${S.send}`}
          >
            {kakao ? "전송" : <IconSend className="h-5 w-5" />}
          </button>
        </form>
      </div>
    </div>
  );
}
