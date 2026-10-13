"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiUrl } from "@/lib/apiBase";
import { IconBubble } from "@/components/icons";
import type { TurnLog } from "@/components/DevPanel";

/**
 * 💬 실시간 대화 모니터 (🛠 주인님 모드 전용)
 *  손님들과 캐릭터가 주고받는 대화를 3초마다 받아 메신저처럼 보여 준다 (GET /api/owner/live · lib/liveFeed.ts).
 *  턴마다 답한 모델·경로·시간이 함께 표시된다. 서버 메모리라 인스턴스별 최근 400턴, 재배포하면 비워진다.
 *  창: 제목줄을 끌어 이동 · ◢ 로 크기 조절 · ◐ 투명도 · – 접기 · ✕ 닫기 (위치·크기는 이 기기에 기억)
 */
const POS_KEY = "ai-rpg.dev.livePos";
const OPACITY = [1, 0.85, 0.6];
type Ui = { x: number; y: number; w: number; h: number; min: boolean; op: number };
interface LiveTurn {
  id: number;
  at: number;
  personaId: string;
  personaName: string;
  device: string;
  userName: string;
  owner: boolean;
  kind: string;
  userText: string;
  replies: string[];
  model: string;
  route: string;
  ms: number;
  fellBack?: boolean;
  tried?: { model: string; ok: boolean; ms: number }[];
  ctx?: { score: number; level: string; reason: string | null } | null;
  cost?: { usd: number; base: number; analyzer: number };
  error?: string;
}
/** $0.00123 → "0.12¢" (센트) */
const cents = (usd: number) => `${(usd * 100).toFixed(usd * 100 < 0.1 ? 3 : 2)}¢`;

const short = (id: string) => id.replace(/^(global|us|apac|eu)\./, "").replace(/^(anthropic|amazon|mistral|meta)\./, "").replace(/-\d{8}-v\d:\d$/, "");
const chip = (m: string) =>
  /opus|fable/i.test(m) ? "bg-fuchsia-500 text-white" : /sonnet/i.test(m) ? "bg-sky-500 text-white" : /haiku/i.test(m) ? "bg-emerald-500 text-slate-950" : /nova/i.test(m) ? "bg-orange-400 text-slate-950" : /grok/i.test(m) ? "bg-rose-500 text-white" : /pool/i.test(m) ? "bg-slate-500 text-white" : "bg-slate-700 text-slate-100";
/** 모델 ID → 읽기 쉬운 이름 (예: global.anthropic.claude-sonnet-5 → Sonnet 5) */
function modelName(id: string): string {
  if (!id) return "—";
  if (/pool/i.test(id)) return "답장 풀 (AI 호출 없음)";
  const c = /claude-(opus|sonnet|haiku|fable|mythos)-(\d+(?:-\d+)?)/i.exec(id);
  if (c) return `${c[1][0].toUpperCase()}${c[1].slice(1)} ${c[2].replace("-", ".")}`;
  const n = /nova-(\d+)?-?(lite|micro|pro|premier)?/i.exec(id);
  if (n && /nova/i.test(id)) return `Nova${n[1] ? ` ${n[1]}` : ""}${n[2] ? ` ${n[2][0].toUpperCase()}${n[2].slice(1)}` : ""}`;
  const g = /grok-?([\d.]+)?/i.exec(id);
  if (g) return `Grok${g[1] ? ` ${g[1]}` : ""}`;
  const gm = /gemini-([\d.]+)-?(\w+)?/i.exec(id);
  if (gm) return `Gemini ${gm[1]}${gm[2] ? ` ${gm[2]}` : ""}`;
  return short(id);
}
const ROUTE_KO: Record<string, string> = { deep: "대화 꼬임 → 고성능", mature: "성인 모델", light: "가벼운 대화", chat: "메인", forced: "주인님 고정", error: "실패" };
const routeKo = (r: string): string => {
  if (r.startsWith("Opus한도→")) return `${routeKo(r.slice("Opus한도→".length))} · ⚠ 오늘 Opus 한도 → 소넷5.5`;
  if (r.startsWith("pool")) return "뻔한 말 → 답장 풀";
  const g = /^([LMPT])\((.*)\)$/.exec(r);
  if (g) return `${{ L: "등급L 단순", M: "등급M 보통", P: "등급P 맥락 깊음", T: "등급T 고난도" }[g[1]]} · ${g[2]}`;
  const m = /^(\w+)\((\w+)\)$/.exec(r);
  if (m) return `${{ daily: "일상", emotion: "감정·대화", knowledge: "지식" }[m[1]] ?? m[1]} · ${{ rule: "규칙", cache: "캐시", default: "분류실패", continuity: "맥락↑" }[m[2]] ?? "분류"}`;
  return ROUTE_KO[r] ?? r;
};
const time = (t: number) => new Date(t).toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
const KIND: Record<string, string> = { reaction: "💗 마음 리액션", return: "📲 다시 들어옴/선톡", gift: "🎁 선물", user_media: "🖼 사진·영상", call: "📞 통화" };

export default function LiveChatMonitor({ token, mine = [], className = "" }: { token: string; /** 이 기기에서 오간 내 턴 (서버 저장소와 상관없이 항상 보이게) */ mine?: TurnLog[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [err, setErr] = useState("");
  const [paused, setPaused] = useState(false);
  const [guestsOnly, setGuestsOnly] = useState(false);
  const [store, setStore] = useState<{ store: string; instance: string } | null>(null);
  const [persona, setPersona] = useState("all");
  const [unseen, setUnseen] = useState(0);
  const since = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  // ── 창 위치·크기 ──
  const [ui, setUi] = useState<Ui | null>(null);
  const uiRef = useRef<Ui | null>(null);
  uiRef.current = ui;
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const sizing = useRef<{ sx: number; sy: number; w: number; h: number } | null>(null);
  const fitIn = (u: Ui): Ui => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const w = Math.min(Math.max(260, u.w), W);
    const h = Math.min(Math.max(200, u.h), H);
    return { ...u, w, h, x: Math.min(Math.max(0, u.x), Math.max(0, W - w)), y: Math.min(Math.max(0, u.y), Math.max(0, H - 44)) };
  };
  const persist = (u: Ui | null) => {
    if (!u) return;
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(u));
    } catch {
      /* 무시 */
    }
  };
  const saveUi = (u: Ui) => {
    setUi(u);
    persist(u);
  };
  useEffect(() => {
    if (!open) return;
    let u: Ui | null = null;
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) u = JSON.parse(raw) as Ui;
    } catch {
      /* 무시 */
    }
    if (!u) {
      // 처음: 화면 오른쪽 아래, 너비 최대 26rem, 높이 화면의 75%
      const w = Math.min(window.innerWidth - 16, 416);
      const h = Math.round(Math.min(window.innerHeight * 0.75, 704));
      u = { x: window.innerWidth - w - 8, y: window.innerHeight - h - 8, w, h, min: false, op: 0 };
    }
    setUi(fitIn(u));
    const onResize = () => setUi((cur) => (cur ? fitIn(cur) : cur));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const onDragDown = (e: React.PointerEvent) => {
    if (!ui || (e.target as HTMLElement).closest("button")) return;
    drag.current = { dx: e.clientX - ui.x, dy: e.clientY - ui.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setUi((u) => (u ? fitIn({ ...u, x: e.clientX - d.dx, y: e.clientY - d.dy }) : u));
  };
  const onDragUp = () => {
    if (drag.current) persist(uiRef.current);
    drag.current = null;
  };
  const onSizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const r = boxRef.current?.getBoundingClientRect();
    sizing.current = { sx: e.clientX, sy: e.clientY, w: r?.width ?? 360, h: r?.height ?? 400 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onSizeMove = (e: React.PointerEvent) => {
    const s0 = sizing.current;
    if (!s0) return;
    setUi((u) =>
      u
        ? {
            ...u,
            w: Math.round(Math.min(window.innerWidth - u.x, Math.max(260, s0.w + e.clientX - s0.sx))),
            h: Math.round(Math.min(window.innerHeight - u.y, Math.max(200, s0.h + e.clientY - s0.sy))),
          }
        : u
    );
  };
  const onSizeUp = () => {
    if (sizing.current) persist(uiRef.current);
    sizing.current = null;
  };

  // 열려 있으면 3초, 닫혀 있으면 15초마다 (새 대화 표시용)
  useEffect(() => {
    if (paused) return;
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch(apiUrl(`/api/owner/live?since=${since.current}`), { headers: { "x-owner-token": token }, cache: "no-store" });
        const j = (await r.json()) as { turns?: LiveTurn[]; error?: string; store?: string; instance?: string };
        if (j.store) setStore({ store: j.store, instance: j.instance ?? "" });
        if (stop) return;
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        const add = j.turns ?? [];
        if (add.length) {
          since.current = Math.max(since.current, ...add.map((t) => t.at));
          setTurns((prev) => {
            const seen = new Set(prev.map((t) => `${t.id}-${t.at}`));
            return [...prev, ...add.filter((t) => !seen.has(`${t.id}-${t.at}`))].slice(-400);
          });
          if (!open) setUnseen((n) => n + add.filter((t) => !t.owner).length);
        }
        setErr("");
      } catch (e) {
        if (!stop) setErr(e instanceof Error ? e.message : String(e));
      }
    };
    void load();
    const t = setInterval(load, open ? 3000 : 15000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [open, paused, token]);

  // 서버 기록 + 이 기기 기록(서버가 여러 대라 내 대화가 안 잡혀도 보이게) — 같은 턴은 하나로
  const all = useMemo(() => {
    const local: LiveTurn[] = mine.map((m, i) => ({
      id: -1 - i,
      at: m.at,
      personaId: m.personaId,
      personaName: m.personaName,
      device: "",
      userName: "",
      owner: true,
      kind: m.kind,
      userText: m.userText ?? "",
      replies: m.replies ?? [],
      model: m.model,
      route: m.path ?? m.tier,
      ms: m.ms,
      fellBack: m.fellBack,
      tried: m.attempts.map((a) => ({ model: a.model, ok: a.ok, ms: a.ms })),
      ctx: m.ctx ? { score: m.ctx.score, level: m.ctx.level, reason: m.ctx.reason } : null,
      cost: m.cost,
    }));
    const dup = (l: LiveTurn) => turns.some((t) => t.owner && t.personaId === l.personaId && Math.abs(t.at - l.at) < 90_000 && t.userText.startsWith(l.userText.slice(0, 40)));
    return [...turns, ...local.filter((l) => !dup(l))].sort((a, b) => a.at - b.at);
  }, [turns, mine]);
  const personas = useMemo(() => [...new Map(all.map((t) => [t.personaId, t.personaName])).entries()], [all]);
  const shown = all.filter((t) => (!guestsOnly || !t.owner) && (persona === "all" || t.personaId === persona));
  /** 모델별 사용 비율 (보이는 턴 기준) */
  const usage = useMemo(() => {
    const m = new Map<string, { n: number; cls: string }>();
    for (const t of shown) {
      if (!t.model) continue;
      const k = modelName(t.model).replace(/ \(.*\)$/, "");
      const c = m.get(k) ?? { n: 0, cls: chip(t.model) };
      c.n++;
      m.set(k, c);
    }
    const total = [...m.values()].reduce((a, b) => a + b.n, 0);
    // 💵 예상 비용 합계 vs 같은 턴을 모두 소넷 5 로 답했을 때
    let usd = 0;
    let base = 0;
    let n = 0;
    for (const t of shown) {
      if (!t.cost) continue;
      usd += t.cost.usd;
      base += t.cost.base;
      n++;
    }
    return { total, list: [...m.entries()].sort((a, b) => b[1].n - a[1].n), usd, base, n };
  }, [shown]);
  /** 같은 대화(인물+기기)에서 바로 전 턴의 모델 — 바뀌었으면 표시 */
  const prevModel = useMemo(() => {
    const last = new Map<string, string>();
    const out = new Map<string, string>();
    for (const t of all) {
      const k = `${t.personaId}|${t.owner ? "owner" : t.device}`;
      const p = last.get(k);
      if (p !== undefined) out.set(`${t.id}-${t.at}`, p);
      if (t.model) last.set(k, t.model);
    }
    return out;
  }, [all]);

  // 맨 아래를 보고 있을 때만 새 대화로 자동 스크롤
  useEffect(() => {
    const el = listRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [shown.length, open]);

  return (
    <>
      <button
        type="button"
        data-live-toggle
        onClick={() => {
          setOpen((o) => !o);
          setUnseen(0);
        }}
        aria-label="실시간 대화 모니터"
        className={`relative inline-flex h-8 items-center gap-1 rounded-full bg-slate-900/85 px-2.5 text-[12px] font-bold text-sky-300 shadow-sm ring-1 ring-sky-300/40 backdrop-blur active:scale-95 ${className}`}
      >
        <IconBubble className="h-4 w-4" />
        <span className="text-[10px]">LIVE</span>
        {unseen > 0 && <span className="absolute -right-1 -top-1 min-w-[1.1rem] rounded-full bg-rose-500 px-1 text-center text-[10px] text-white">{unseen > 99 ? "99+" : unseen}</span>}
      </button>
      {open &&
        ui &&
        createPortal(
          <div
            ref={boxRef}
            data-live-panel
            style={{ left: ui.x, top: ui.y, width: ui.w, opacity: OPACITY[ui.op] ?? 1, ...(ui.min ? {} : { height: ui.h }) }}
            className="fixed z-[81] flex flex-col rounded-2xl bg-slate-950 text-[12px] text-slate-200 shadow-2xl ring-1 ring-sky-300/40"
          >
            <div
              onPointerDown={onDragDown}
              onPointerMove={onDragMove}
              onPointerUp={onDragUp}
              onPointerCancel={onDragUp}
              data-live-drag
              className={`flex cursor-grab touch-none select-none items-center gap-2 bg-slate-900 px-3 py-2 active:cursor-grabbing ${ui.min ? "rounded-2xl" : "rounded-t-2xl"}`}
            >
              <b className="text-sky-300">⠿ 💬 실시간 대화</b>
              <span className={`h-1.5 w-1.5 rounded-full ${paused ? "bg-slate-500" : "animate-pulse bg-emerald-400"}`} />
              <span className="text-[10px] text-slate-400">{paused ? "멈춤" : "3초마다"} · {shown.length}턴</span>
              <span className="ml-auto flex gap-1">
                <button type="button" onClick={() => setPaused((p) => !p)} className="rounded bg-slate-800 px-2 py-0.5" title={paused ? "다시 받기" : "멈춤"} data-live-pause>{paused ? "▶" : "⏸"}</button>
                <button type="button" onClick={() => saveUi({ ...ui, op: (ui.op + 1) % OPACITY.length })} className="rounded bg-slate-800 px-2 py-0.5" title="투명도" data-live-opacity>◐</button>
                <button type="button" onClick={() => saveUi({ ...ui, min: !ui.min })} className="rounded bg-slate-800 px-2 py-0.5" title={ui.min ? "펼치기" : "접기"} data-live-min>{ui.min ? "▢" : "–"}</button>
                <button type="button" onClick={() => setOpen(false)} className="rounded bg-slate-800 px-2 py-0.5" title="닫기" data-live-close>✕</button>
              </span>
            </div>
            {!ui.min && (
            <>
            <div className="flex items-center gap-1.5 border-b border-slate-800 px-3 py-1.5 text-[11px]">
              <select value={persona} onChange={(e) => setPersona(e.target.value)} className="rounded bg-slate-800 px-1.5 py-0.5 text-base outline-none sm:text-[11px]" data-live-persona>
                <option value="all">모든 인물</option>
                {personas.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={guestsOnly} onChange={(e) => setGuestsOnly(e.target.checked)} /> 손님만
              </label>
              <button type="button" onClick={() => setTurns([])} className="ml-auto rounded bg-slate-800 px-2 py-0.5 text-[10px]">화면 비우기</button>
            </div>
            {usage.total > 0 && (
              <div className="border-b border-slate-800 px-3 py-1.5" data-live-usage>
                <div className="flex h-2 overflow-hidden rounded-full bg-slate-800">
                  {usage.list.map(([k, v]) => (
                    <span key={k} className={v.cls} style={{ width: `${(v.n / usage.total) * 100}%` }} />
                  ))}
                </div>
                <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                  {usage.list.map(([k, v]) => (
                    <span key={k} className={`rounded px-1.5 ${v.cls}`}>{k} {Math.round((v.n / usage.total) * 100)}% ({v.n})</span>
                  ))}
                </div>
                {usage.n > 0 && usage.base > 0 && (
                  <p className="mt-1 text-[10px] text-slate-300" data-live-cost>
                    💵 예상 비용 {cents(usage.usd)} · 소넷5 고정이면 {cents(usage.base)} →{" "}
                    <b className={usage.usd <= usage.base ? "text-emerald-300" : "text-rose-300"}>
                      {usage.usd <= usage.base ? `${Math.round((1 - usage.usd / usage.base) * 100)}% 절감` : `${Math.round((usage.usd / usage.base - 1) * 100)}% 더 씀`}
                    </b>{" "}
                    <span className="text-slate-500">({usage.n}턴 · 추정)</span>
                  </p>
                )}
              </div>
            )}
            {err && <p className="px-3 py-1 text-[11px] text-red-400">⚠️ {err}</p>}
            <div
              ref={listRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
              }}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-2"
            >
              {shown.length === 0 && (
                <p className="pt-6 text-center text-slate-500">
                  아직 오간 대화가 없어요.<br />손님이 말을 보내면 여기에 바로 떠요.
                  {guestsOnly && all.length > 0 && <><br />(“손님만”이 켜져 있어 주인님 대화 {all.length}개는 숨겨져 있어요)</>}
                </p>
              )}
              {shown.map((t) => (
                <div key={`${t.id}-${t.at}`} data-live-turn>
                  <div className="mb-1 flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                    <span>{time(t.at)}</span>
                    <b className="text-amber-200">{t.personaName}</b>
                    <span>↔ {t.owner ? "🛠 주인님" : `👤 ${t.userName || "손님"}${t.device ? `#${t.device}` : ""}`}</span>
                  </div>
                  <div className="flex justify-end">
                    <p className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-amber-300 px-2.5 py-1.5 text-slate-900">
                      {t.kind === "text" ? t.userText : KIND[t.kind] ?? t.kind}
                    </p>
                  </div>
                  {(() => {
                    const before = prevModel.get(`${t.id}-${t.at}`);
                    const changed = !!t.model && !!before && before !== t.model;
                    return (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px]" data-live-model>
                        <span className="text-slate-500">🤖 적용 모델</span>
                        <span className={`rounded px-1.5 py-px font-bold ${chip(t.model)}`} title={t.model}>{modelName(t.model)}</span>
                        {changed && <span className="text-amber-300" title={before}>↔ {modelName(before!)}에서 바뀜</span>}
                        {t.fellBack && <span className="rounded bg-rose-900/70 px-1 text-rose-200">우회</span>}
                        <span className="text-slate-400">· {routeKo(t.route)}</span>
                        {t.ctx && <span className={t.ctx.level === "high" ? "text-rose-300" : t.ctx.level === "mid" ? "text-amber-300" : "text-emerald-300"}>· 맥락 {t.ctx.level} {t.ctx.score}</span>}
                        {t.ms > 0 && <span className="text-slate-500">· {(t.ms / 1000).toFixed(1)}s</span>}
                        {t.cost && (
                          <span className="text-slate-400" title={`답장 ${cents(t.cost.usd - t.cost.analyzer)} + 분석 ${cents(t.cost.analyzer)} · 소넷5였다면 ${cents(t.cost.base)}`}>
                            · 💵{cents(t.cost.usd)}{t.cost.base > 0 ? ` (소넷5 대비 ${Math.round((t.cost.usd / t.cost.base) * 100)}%)` : ""}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  {t.tried && t.tried.some((a) => !a.ok) && (
                    <p className="text-[10px] text-slate-500">시도: {t.tried.map((a) => `${a.ok ? "✅" : "✕"} ${modelName(a.model)}`).join(" → ")}</p>
                  )}
                  {t.error ? (
                    <p className="mt-1 max-w-[85%] rounded-2xl bg-red-900/60 px-2.5 py-1.5 text-red-200">⚠️ 답장 실패: {t.error}</p>
                  ) : t.replies.length === 0 ? (
                    <p className="mt-1 text-[10px] text-slate-500">(말 없이 표정만)</p>
                  ) : (
                    t.replies.map((r, i) => (
                      <div key={i} className="mt-1 flex">
                        <p className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm bg-slate-800 px-2.5 py-1.5">{r}</p>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
            <p className="rounded-b-2xl bg-slate-900 py-1 pl-3 pr-8 text-[9px] text-slate-500" data-live-store>
              {store?.store === "redis" ? (
                <>공유 저장소(Redis) · 모든 서버의 최근 400턴 · 3일 보관</>
              ) : (
                <>
                  <span className="text-amber-300">⚠ 서버 메모리</span> — 서버가 여러 대 떠 있으면 일부 대화만 보여요(서버 {store?.instance ?? "?"}). 전부 보려면 Vercel에 Upstash Redis 연결
                </>
              )}
            </p>
            <div
              onPointerDown={onSizeDown}
              onPointerMove={onSizeMove}
              onPointerUp={onSizeUp}
              onPointerCancel={onSizeUp}
              data-live-resize
              title="끌어서 크기 조절"
              className="absolute bottom-0 right-0 z-10 flex h-7 w-7 cursor-nwse-resize touch-none select-none items-end justify-end rounded-br-2xl p-1 text-[13px] leading-none text-sky-300/80"
            >
              ◢
            </div>
            </>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
