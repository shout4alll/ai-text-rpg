"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiUrl } from "@/lib/apiBase";
import { IconBubble } from "@/components/icons";

/**
 * 💬 실시간 대화 모니터 (🛠 주인님 모드 전용)
 *  손님들과 캐릭터가 주고받는 대화를 3초마다 받아 메신저처럼 보여 준다 (GET /api/owner/live · lib/liveFeed.ts).
 *  턴마다 답한 모델·경로·시간이 함께 표시된다. 서버 메모리라 인스턴스별 최근 400턴, 재배포하면 비워진다.
 */
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
  error?: string;
}

const short = (id: string) => id.replace(/^(global|us|apac|eu)\./, "").replace(/^(anthropic|amazon|mistral|meta)\./, "").replace(/-\d{8}-v\d:\d$/, "");
const chip = (m: string) =>
  /opus|fable/i.test(m) ? "bg-fuchsia-500 text-white" : /sonnet/i.test(m) ? "bg-sky-500 text-white" : /haiku/i.test(m) ? "bg-emerald-500 text-slate-950" : /nova/i.test(m) ? "bg-orange-400 text-slate-950" : /grok/i.test(m) ? "bg-rose-500 text-white" : /pool/i.test(m) ? "bg-slate-500 text-white" : "bg-slate-700 text-slate-100";
const time = (t: number) => new Date(t).toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
const KIND: Record<string, string> = { reaction: "💗 마음 리액션", return: "📲 다시 들어옴/선톡", gift: "🎁 선물", user_media: "🖼 사진·영상", call: "📞 통화" };

export default function LiveChatMonitor({ token, className = "" }: { token: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [err, setErr] = useState("");
  const [paused, setPaused] = useState(false);
  const [guestsOnly, setGuestsOnly] = useState(true);
  const [persona, setPersona] = useState("all");
  const [unseen, setUnseen] = useState(0);
  const since = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  // 열려 있으면 3초, 닫혀 있으면 15초마다 (새 대화 표시용)
  useEffect(() => {
    if (paused) return;
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch(apiUrl(`/api/owner/live?since=${since.current}`), { headers: { "x-owner-token": token }, cache: "no-store" });
        const j = (await r.json()) as { turns?: LiveTurn[]; error?: string };
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

  const personas = useMemo(() => [...new Map(turns.map((t) => [t.personaId, t.personaName])).entries()], [turns]);
  const shown = turns.filter((t) => (!guestsOnly || !t.owner) && (persona === "all" || t.personaId === persona));

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
        createPortal(
          <div data-live-panel className="fixed bottom-2 right-2 z-[81] flex h-[min(80dvh,44rem)] w-[min(96vw,26rem)] flex-col rounded-2xl bg-slate-950 text-[12px] text-slate-200 shadow-2xl ring-1 ring-sky-300/40">
            <div className="flex items-center gap-2 rounded-t-2xl bg-slate-900 px-3 py-2">
              <b className="text-sky-300">💬 실시간 대화</b>
              <span className={`h-1.5 w-1.5 rounded-full ${paused ? "bg-slate-500" : "animate-pulse bg-emerald-400"}`} />
              <span className="text-[10px] text-slate-400">{paused ? "멈춤" : "3초마다"} · {shown.length}턴</span>
              <span className="ml-auto flex gap-1">
                <button type="button" onClick={() => setPaused((p) => !p)} className="rounded bg-slate-800 px-2 py-0.5" data-live-pause>{paused ? "▶" : "⏸"}</button>
                <button type="button" onClick={() => setOpen(false)} className="rounded bg-slate-800 px-2 py-0.5">✕</button>
              </span>
            </div>
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
            {err && <p className="px-3 py-1 text-[11px] text-red-400">⚠️ {err}</p>}
            <div
              ref={listRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
              }}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-2"
            >
              {shown.length === 0 && <p className="pt-6 text-center text-slate-500">아직 오간 대화가 없어요.<br />손님이 말을 보내면 여기에 바로 떠요.</p>}
              {shown.map((t) => (
                <div key={`${t.id}-${t.at}`} data-live-turn>
                  <div className="mb-1 flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                    <span>{time(t.at)}</span>
                    <b className="text-amber-200">{t.personaName}</b>
                    <span>↔ {t.owner ? "🛠 주인님" : `👤 ${t.userName || "손님"}${t.device ? `#${t.device}` : ""}`}</span>
                    {t.model && <span className={`rounded px-1 font-bold ${chip(t.model)}`}>{short(t.model)}</span>}
                    <span className="text-slate-400">{t.route}</span>
                    {t.ms > 0 && <span>{(t.ms / 1000).toFixed(1)}s</span>}
                  </div>
                  <div className="flex justify-end">
                    <p className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-amber-300 px-2.5 py-1.5 text-slate-900">
                      {t.kind === "text" ? t.userText : KIND[t.kind] ?? t.kind}
                    </p>
                  </div>
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
            <p className="rounded-b-2xl bg-slate-900 px-3 py-1 text-[9px] text-slate-500">서버 메모리(인스턴스별 최근 400턴) · 파일로 저장하지 않아요 · 재배포하면 비워져요</p>
          </div>,
          document.body
        )}
    </>
  );
}
