"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiUrl } from "@/lib/apiBase";
import { loadOwnerOpts, saveOwnerOpts, type StoredOwnerOpts } from "@/lib/ownerClient";
import { asText, fromText, type FieldDef, type OverrideValue } from "@/lib/ownerOverrides";
import type { ChatResponse } from "@/types/game";

/**
 * 🛠 주인님 모드 관리창 — 떠 있는 창(끌어서 이동·접기·투명도)으로 대화를 보면서 작업한다.
 *   📡실시간: 턴마다 적용된 모델·경로·맥락 의존도 (이 기기) / 모든 유저 (서버 전체, /api/owner/ctxlog)
 *   상태 : 이번 턴 모델·경로·토큰, 이 대화방 상태, 서버 모델        (GET /api/status/full)
 *   모델 : 모델 목록에서 골라 바로 바꿔 테스트 (Grok 포함) · 직접 입력   (config/models.ts)
 *   캐릭터: 성격·말투·설정을 고쳐 다음 메시지부터 적용               (lib/ownerOverrides.ts PERSONA_FIELDS)
 *   규칙 : 공통·안전·수위·주인님 모드 규칙                          (RULE_FIELDS · config/rules.ts)
 *   설정 : 운영 스위치·앱 설정·환경변수 (config/settings.ts)
 *  테스트 값은 이 기기에만 저장되고 주인 인증된 요청에만 반영된다. CMS 로 옮길 때는 같은 항목 정의를 그대로 쓴다.
 */
interface FullStatus {
  env: string;
  deploy: string | null;
  models: { provider: string; label: string; region: string | null; main: string; light: string; cheap: string; mature: string; routing: boolean };
  settings: { key: string; label: string; group: string; value: string; source: "cms" | "env" | "default"; env: string; options: string[] | null; desc: string; usedIn: string }[];
  app: { label: string; value: string; file: string }[];
  modelEnv: { name: string; value: string | null }[];
  secrets: { name: string; set: boolean }[];
}
interface OwnerCfg {
  models: { choices: { key: string; label: string; provider: string; modelId: string; note: string; hasKey: boolean }[]; providers: Record<string, boolean>; server: { provider: string; main: string; light: string; cheap: string; mature?: string }; fallback?: { spec: string; provider: string; modelId: string; usable: boolean; ok: number; fail: number; rate: number }[]; fallbackOn?: boolean };
  persona: { id: string; name: string; hasAllure: boolean; fields: FieldDef[]; defaults: Record<string, OverrideValue | undefined> };
  rules: { fields: FieldDef[]; defaults: Record<string, OverrideValue | undefined>; hard: string[] };
}

/** 🛠 실시간 창: 한 턴의 기록 */
export type TurnLog = NonNullable<ChatResponse["debug"]> & { at: number; personaId: string; personaName: string; kind: string; replies?: string[] };
interface ServerRow { at: number; persona: string; text: string; prevAi: string; score: number; level: string; reason: string | null; features: Record<string, number>; route?: string; model?: string }

type Tab = "live" | "status" | "model" | "persona" | "rules" | "check" | "settings" | "cheat";

/** 🔑 치트룸 전용 조작 (ChatApp 이 넘겨 준다) */
export interface CheatActions {
  affection: number;
  setAffection: (v: number) => void;
  clearSulk: () => void;
  addGems: (n: number) => void;
  resetChat: () => void;
}
const SRC: Record<string, string> = { env: "환경변수", default: "기본값", cms: "CMS" };
const POS_KEY = "ai-rpg.dev.ui2"; // v2: 크기(w·h) 추가 — 처음엔 화면 아래쪽에 뜬다
const OPACITY = [1, 0.8, 0.55];

export default function DevPanel({
  token,
  last,
  history = [],
  client,
  personaId,
  cheat,
  className = "",
}: {
  token: string;
  last: ChatResponse["debug"] | null;
  /** 이 기기에서 오간 턴마다의 모델 기록 (실시간 탭) */
  history?: TurnLog[];
  /** 이 기기·이 대화방 상태 */
  client: { label: string; value: string }[];
  personaId: string;
  /** 치트룸일 때만 */
  cheat?: CheatActions;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("live");
  const [data, setData] = useState<FullStatus | null>(null);
  const [cfg, setCfg] = useState<OwnerCfg | null>(null);
  const [err, setErr] = useState("");
  // opts = 편집 중인 값(초안), saved = 실제로 적용된 값. 하단 [확인]을 눌러야 saved 가 되어 다음 메시지부터 적용된다
  const [opts, setOpts] = useState<StoredOwnerOpts>({ personas: {} });
  const [saved, setSaved] = useState<StoredOwnerOpts>({ personas: {} });
  const [appliedAt, setAppliedAt] = useState(0);
  const [ver, setVer] = useState(0);
  const [ui, setUi] = useState({ x: 8, y: 120, w: 0, h: 0, min: false, op: 0 });
  const sizing = useRef<{ sx: number; sy: number; w: number; h: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const headers = { "x-owner-token": token };
  const loadStatus = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch(apiUrl("/api/status/full"), { headers, cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setData(j as FullStatus);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "불러오지 못했어요");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  const loadCfg = useCallback(async () => {
    try {
      const r = await fetch(apiUrl(`/api/owner/config?persona=${encodeURIComponent(personaId)}`), { headers, cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setCfg(j as OwnerCfg);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "불러오지 못했어요");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, personaId]);

  // 창 위치·접기·투명도 기억
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(POS_KEY) ?? "null");
      if (v) setUi((u) => ({ ...u, ...v }));
      else {
        // 처음: 화면 아래쪽, 가로 가득(최대 34rem), 높이는 화면의 55%
        const w = Math.min(window.innerWidth - 16, 544);
        const h = Math.round(Math.min(window.innerHeight * 0.55, 560));
        setUi((u) => ({ ...u, w, h, x: Math.max(8, (window.innerWidth - w) / 2), y: Math.max(8, window.innerHeight - h - 12) }));
      }
    } catch {
      /* 무시 */
    }
    const o = loadOwnerOpts();
    setOpts(o);
    setSaved(o);
  }, []);
  useEffect(() => {
    if (!open) return;
    const fit = () => setUi((u) => ({ ...u, ...clamp(u.x, u.y) }));
    const t = setTimeout(fit, 0);
    window.addEventListener("resize", fit);
    return () => { clearTimeout(t); window.removeEventListener("resize", fit); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const saveUi = (next: typeof ui) => {
    setUi(next);
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(next));
    } catch {
      /* 무시 */
    }
  };
  useEffect(() => {
    if (!open) return;
    const o = loadOwnerOpts();
    setOpts(o);
    setSaved(o);
    void loadStatus();
    void loadCfg();
  }, [open, loadStatus, loadCfg]);

  /** 편집 값을 초안에 반영 (아직 적용 전) */
  const commit = (next: StoredOwnerOpts) => setOpts(next);
  const dirty = JSON.stringify(opts) !== JSON.stringify(saved);
  /** [확인] — 초안을 저장해 바로 적용 (다음 메시지부터) */
  const apply = () => {
    saveOwnerOpts(opts);
    setSaved(opts);
    setAppliedAt(Date.now());
    setTimeout(() => setAppliedAt(0), 2200);
  };
  const discard = () => setOpts(saved);
  /** 모델 선택은 누르는 즉시 적용 (다른 편집 중인 값은 그대로 초안으로 둔다) */
  const pickModel = (model: StoredOwnerOpts["model"]) => {
    const nextSaved = { ...saved, model };
    saveOwnerOpts(nextSaved);
    setSaved(nextSaved);
    setOpts({ ...opts, model });
    setAppliedAt(Date.now());
    setTimeout(() => setAppliedAt(0), 2200);
  };

  const clamp = (x: number, y: number) => {
    const w = boxRef.current?.offsetWidth ?? 360;
    return { x: Math.min(Math.max(0, x), Math.max(0, window.innerWidth - w)), y: Math.min(Math.max(0, y), window.innerHeight - 44) };
  };
  /** ◢ 손잡이로 크기 바꾸기 (손가락·마우스) */
  const onSizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const r = boxRef.current?.getBoundingClientRect();
    sizing.current = { sx: e.clientX, sy: e.clientY, w: r?.width ?? 360, h: r?.height ?? 400 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onSizeMove = (e: React.PointerEvent) => {
    const s0 = sizing.current;
    if (!s0) return;
    const w = Math.round(Math.min(window.innerWidth - ui.x, Math.max(260, s0.w + e.clientX - s0.sx)));
    const h = Math.round(Math.min(window.innerHeight - ui.y, Math.max(180, s0.h + e.clientY - s0.sy)));
    setUi((u) => ({ ...u, w, h }));
  };
  const onSizeUp = () => {
    if (sizing.current) saveUi(ui);
    sizing.current = null;
  };
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { dx: e.clientX - ui.x, dy: e.clientY - ui.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const p = clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy);
    setUi((u) => ({ ...u, ...p }));
  };
  const onUp = () => {
    if (drag.current) saveUi(ui);
    drag.current = null;
  };

  const personaOv = opts.personas[personaId] ?? {};
  const nPersona = Object.keys(personaOv).length;
  const nRules = Object.keys(opts.rules ?? {}).length;
  const active = !!saved.model || saved.promptMode === "service" || Object.keys(saved.personas[personaId] ?? {}).length > 0 || Object.keys(saved.rules ?? {}).length > 0;

  const setPersonaField = (def: FieldDef, text: string) => {
    const v = fromText(def, text);
    const def0 = cfg?.persona.defaults[def.key];
    const same = v === undefined || asText(v) === asText(def0);
    const cur = { ...(opts.personas[personaId] ?? {}) } as Record<string, OverrideValue>;
    if (same) delete cur[def.key];
    else cur[def.key] = v as OverrideValue;
    commit({ ...opts, personas: { ...opts.personas, [personaId]: cur } });
  };
  const setRuleField = (def: FieldDef, text: string) => {
    const v = fromText(def, text);
    const def0 = cfg?.rules.defaults[def.key];
    const same = v === undefined || asText(v) === asText(def0);
    const cur = { ...(opts.rules ?? {}) } as Record<string, OverrideValue>;
    if (same) delete cur[def.key];
    else cur[def.key] = v as OverrideValue;
    commit({ ...opts, rules: cur });
  };

  const [custom, setCustom] = useState({ provider: "xai", modelId: "" });
  const curModel = opts.model;
  const choiceOf = cfg?.models.choices.find((c) => curModel && c.provider === curModel.provider && c.modelId === curModel.modelId);

  const tabs: [Tab, string][] = [
    ...(cheat ? ([["cheat", "🔑치트"]] as [Tab, string][]) : []),
    ["status", "상태"],
    ["live", "📡실시간"],
    ["model", `모델${curModel ? " ●" : ""}`],
    ["persona", `캐릭터${nPersona ? ` ${nPersona}` : ""}`],
    ["rules", `규칙${nRules ? ` ${nRules}` : ""}`],
    ["check", "점검"],
    ["settings", "설정"],
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-dev-toggle
        className={`inline-flex h-8 items-center gap-1 rounded-full bg-slate-900/85 px-2.5 text-[12px] font-bold text-amber-300 shadow-sm ring-1 ring-amber-300/40 backdrop-blur active:scale-95 ${className}`}
        aria-label="상태판"
      >
        🛠{active && <span className="text-emerald-300">●</span>}{" "}
        {saved.model ? (
          <span className="max-w-[7.5rem] truncate font-mono text-[10px] text-amber-100" title="🛠 에서 고정한 모델 (다음 메시지부터)">🔒{shortModel(saved.model.modelId)}</span>
        ) : last ? (
          <span className="max-w-[7.5rem] truncate font-mono text-[10px] text-amber-100">{last.tier}·{shortModel(last.model)}</span>
        ) : (
          "상태"
        )}
      </button>
      {open &&
        createPortal(
          <div
            ref={boxRef}
            data-dev-panel
            style={{ left: ui.x, top: ui.y, opacity: OPACITY[ui.op], ...(ui.w ? { width: ui.w } : {}), ...(ui.h && !ui.min ? { height: ui.h } : {}) }}
            className="fixed z-[80] flex w-[min(96vw,34rem)] flex-col rounded-2xl bg-slate-950 font-mono text-[12px] leading-relaxed text-slate-200 shadow-2xl ring-1 ring-amber-300/40"
          >
            {/* 끌어서 옮기는 손잡이 */}
            <div
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              data-dev-drag
              className="flex cursor-grab touch-none select-none items-center justify-between rounded-t-2xl bg-slate-900 px-3 py-2 active:cursor-grabbing"
            >
              <b className="text-amber-300">⠿ 🛠 주인님 관리창</b>
              <span className="flex gap-1">
                <button type="button" onClick={() => saveUi({ ...ui, op: (ui.op + 1) % OPACITY.length })} className="rounded bg-slate-800 px-2 py-0.5" title="투명도">◐</button>
                <button type="button" onClick={() => saveUi({ ...ui, min: !ui.min })} className="rounded bg-slate-800 px-2 py-0.5" data-dev-min>{ui.min ? "▢" : "–"}</button>
                <button type="button" onClick={() => setOpen(false)} className="rounded bg-slate-800 px-2 py-0.5">✕</button>
              </span>
            </div>

            {!ui.min && (
              <>
                <div className="flex gap-1 overflow-x-auto px-2 pt-2">
                  {tabs.map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      data-dev-tab={k}
                      onClick={() => setTab(k)}
                      className={`shrink-0 rounded-full px-2.5 py-1 ${tab === k ? "bg-amber-300 font-bold text-slate-900" : "bg-slate-800 text-slate-300"}`}
                    >
                      {label}
                    </button>
                  ))}
                  <button type="button" onClick={() => { void loadStatus(); void loadCfg(); }} className="ml-auto shrink-0 rounded-full bg-slate-800 px-2.5 py-1" title="새로고침">↻</button>
                </div>

                <div className={`min-h-0 flex-1 overflow-y-auto p-3 ${ui.h ? "" : "max-h-[66dvh]"}`}>
                  {err && <p className="mb-2 text-red-400">⚠️ {err}</p>}

                  {tab === "live" && <LiveTab token={token} history={history} />}

                  {tab === "status" && (
                    <>
                      <Section title="이번 턴">
                        {last ? (
                          <>
                            <Row k="모델" v={last.model} />
                            <Row k="경로" v={`${last.tier} (${last.reason})${last.fellBack ? " · 대체됨" : ""}`} />
                            <Row k="프롬프트" v={last.promptMode === "service" ? "서비스(일반 유저와 동일)" : "주인님(제한 해제)"} />
                            <Row k="매혹" v={last.allure ? `켜짐 · 수위 ${last.allureLevel}` : "꺼짐"} />
                            <Row k="응답 시간" v={`${(last.ms / 1000).toFixed(1)}초`} />
                            <Row k="토큰" v={last.tokens ? `입력 ${last.tokens.in} (캐시 ${last.tokens.cache}) · 출력 ${last.tokens.out}` : "—"} />
                            <Row k="대화 정화" v={last.sanitized ? `성인 구간 ${last.sanitized}개를 요약으로 대체해 전달` : "없음 (원문 그대로)"} />
                            <Row k="연속 라우팅" v={last.sticky ? "회상 대화 → 성인 모델 유지" : "아님"} />
                            <Row k="적용된 편집" v={last.overrides?.length ? last.overrides.join(", ") : "없음"} />
                          </>
                        ) : (
                          <p className="text-slate-400">아직 답장이 없어요. 말을 보내면 표시돼요.</p>
                        )}
                      </Section>
                      {last?.sent?.length ? (
                        <Section title="모델에 실제 전달된 대화 (최근 12)">
                          {last.sent.map((t, i) => (
                            <p key={i} className="break-all text-[10px] text-slate-400"><b className={t.role === "user" ? "text-sky-300" : "text-emerald-300"}>{t.role === "user" ? "유저" : "AI"}</b> {t.text}</p>
                          ))}
                        </Section>
                      ) : null}
                      <Section title="이 기기 · 이 대화방">
                        {client.map((c) => (
                          <Row key={c.label} k={c.label} v={c.value} />
                        ))}
                      </Section>
                      {data && (
                        <Section title={`서버 모델 (${data.env}${data.deploy ? ` · ${data.deploy}` : ""})`}>
                          <Row k="프로바이더" v={`${data.models.provider} · ${data.models.label}${data.models.region ? ` · ${data.models.region}` : ""}`} />
                          <Row k="메인" v={data.models.main} />
                          <Row k="가벼운 대화" v={`${data.models.light}${data.models.routing ? "" : " (라우팅 꺼짐)"}`} />
                          <Row k="기억 정리" v={data.models.cheap} />
                          <Row k="성인(매혹)" v={data.models.mature} />
                        </Section>
                      )}
                    </>
                  )}

                  {tab === "model" && (
                    <>
                      <p className="mb-2 text-[11px] text-slate-400">모델을 누르면 바로 적용되어 다음 메시지부터 이 모델만 사용 (가벼운 대화·성인 라우팅 무시, 실패해도 대체하지 않고 오류를 그대로 보여 줌). ‘자동’이면 서비스와 같은 순서로 시도하고, 실패 시 아래 우회 목록으로 넘어가며 그 경과를 대화창에 보여 줍니다. 이 기기 · 주인님 모드에서만.</p>
                      {cfg?.models.fallback && (
                        <Section title={`🔁 우회 목록 (서비스 대화방) — ${cfg.models.fallbackOn === false ? "꺼짐" : "켜짐"}`}>
                          {cfg.models.fallback.length === 0 && <p className="text-slate-500">우회 모델 없음</p>}
                          {cfg.models.fallback.map((f, i) => (
                            <div key={f.spec} className={`flex items-center justify-between gap-2 border-b border-slate-800 py-1 last:border-0 ${f.usable ? "" : "opacity-40"}`}>
                              <span className="min-w-0 truncate"><b className="text-amber-300">{i + 1}</b> {f.provider}/{f.modelId}</span>
                              <span className="shrink-0 text-[10px] text-slate-400">{f.usable ? `성공 ${f.ok} · 실패 ${f.fail} · ${f.rate}%` : "키 없음"}</span>
                            </div>
                          ))}
                          <p className="mt-1 text-[10px] text-slate-500">성공률이 높은 모델이 앞으로 옵니다. 순서·목록은 환경변수 AI_FALLBACK_MODELS, 끄기 SERVICE_FALLBACK=off.</p>
                        </Section>
                      )}
                      <Section title="프롬프트">
                        <div className="flex gap-1">
                          {([["owner", "주인님 (제한 해제)"], ["service", "서비스 (유저와 동일)"]] as const).map(([k, l]) => (
                            <button
                              key={k}
                              type="button"
                              data-dev-mode={k}
                              onClick={() => commit({ ...opts, promptMode: k === "owner" ? undefined : k })}
                              className={`flex-1 rounded px-2 py-1 ${(opts.promptMode ?? "owner") === k ? "bg-amber-300 font-bold text-slate-900" : "bg-slate-800"}`}
                            >
                              {l}
                            </button>
                          ))}
                        </div>
                        <p className="mt-1 text-[10px] text-slate-500">서비스 = 일반 유저 규칙·말투·호감도·사진 흐름 그대로 (모델·캐릭터·규칙 편집만 적용)</p>
                      </Section>
                      <Section title="모델 선택">
                        <button
                          type="button"
                          data-dev-model="auto"
                          onClick={() => pickModel(undefined)}
                          className={`mb-1 w-full rounded px-2 py-1.5 text-left ${!curModel ? "bg-amber-300 font-bold text-slate-900" : "bg-slate-800"}`}
                        >
                          자동 (서버 설정){cfg ? <span className="block text-[10px] opacity-70">{`내용에 따라: 평소 ${cfg.models.server.main}${cfg.models.server.mature ? ` · 설렘·스킨십 말 → ${cfg.models.server.mature}` : ""} · 실패 시 우회 목록`}</span> : null}
                        </button>
                        {cfg?.models.choices.map((c) => {
                          const sel = !!curModel && c.provider === curModel.provider && c.modelId === curModel.modelId;
                          return (
                            <button
                              key={c.key}
                              type="button"
                              data-dev-model={c.key}
                              onClick={() => pickModel({ provider: c.provider, modelId: c.modelId })}
                              className={`mb-1 w-full rounded px-2 py-1.5 text-left ${sel ? "bg-amber-300 font-bold text-slate-900" : "bg-slate-800"} ${c.hasKey ? "" : "opacity-50"}`}
                            >
                              <span className="flex justify-between gap-2"><span>{c.label}</span><span className="text-[10px] opacity-70">{c.provider}{c.hasKey ? "" : " · 키 없음"}</span></span>
                              <span className="block break-all text-[10px] opacity-70">{c.modelId}</span>
                              <span className="block text-[10px] opacity-70">{c.note}</span>
                            </button>
                          );
                        })}
                      </Section>
                      <Section title="직접 입력">
                        <div className="flex gap-1">
                          <select value={custom.provider} onChange={(e) => setCustom({ ...custom, provider: e.target.value })} className="rounded bg-slate-800 px-1 py-1">
                            {["mantle", "bedrock", "xai", "google", "openai"].map((p) => (<option key={p}>{p}</option>))}
                          </select>
                          <input value={custom.modelId} onChange={(e) => setCustom({ ...custom, modelId: e.target.value })} placeholder="모델 ID (예: grok-4.6)" className="min-w-0 flex-1 rounded bg-slate-800 px-2 py-1 text-base outline-none sm:text-[12px]" />
                          <button type="button" disabled={!custom.modelId.trim()} onClick={() => pickModel({ provider: custom.provider, modelId: custom.modelId.trim() })} className="rounded bg-amber-300 px-2 py-1 font-bold text-slate-900 disabled:opacity-40">담기</button>
                        </div>
                        {curModel && !choiceOf && <p className="mt-1 text-[10px] text-emerald-300">지금: {curModel.provider} · {curModel.modelId}</p>}
                      </Section>
                    </>
                  )}

                  {tab === "persona" && (
                    <>
                      <p className="mb-2 text-[11px] text-slate-400">
                        {cfg ? `${cfg.persona.name}(${cfg.persona.id})` : personaId} 의 설정. 고치면 다음 메시지부터 적용 — 기본값과 같거나 비우면 원래대로. 인물마다 따로 저장돼요.
                      </p>
                      {cfg ? (
                        <FieldList
                          defs={cfg.persona.fields.filter((f) => f.key !== "allurePrompt" || cfg.persona.hasAllure)}
                          defaults={cfg.persona.defaults}
                          values={personaOv as Record<string, OverrideValue | undefined>}
                          onCommit={setPersonaField}
                          ver={`${personaId}-${ver}`}
                        />
                      ) : (
                        <p className="text-slate-400">불러오는 중…</p>
                      )}
                      <ResetBar
                        n={nPersona}
                        label="이 인물 편집 모두 되돌리기"
                        onReset={() => { commit({ ...opts, personas: { ...opts.personas, [personaId]: {} } }); setVer((v) => v + 1); }}
                        json={JSON.stringify({ [personaId]: personaOv }, null, 2)}
                      />
                    </>
                  )}

                  {tab === "rules" && (
                    <>
                      <p className="mb-2 text-[11px] text-slate-400">모든 인물에 적용되는 규칙. 고치면 다음 메시지부터 적용 — 비우면 기본값.</p>
                      {cfg ? (
                        <>
                          <FieldList
                            defs={cfg.rules.fields}
                            defaults={cfg.rules.defaults}
                            values={(opts.rules ?? {}) as Record<string, OverrideValue | undefined>}
                            onCommit={setRuleField}
                            ver={`rules-${ver}`}
                          />
                          <Section title="🔒 고정 규칙 (이 한 줄만 고정, 나머지는 모두 수정 가능)">
                            {cfg.rules.hard.map((r) => (<p key={r} className="text-[11px] text-slate-400">• {r}</p>))}
                          </Section>
                        </>
                      ) : (
                        <p className="text-slate-400">불러오는 중…</p>
                      )}
                      <ResetBar
                        n={nRules}
                        label="규칙 편집 모두 되돌리기"
                        onReset={() => { commit({ ...opts, rules: {} }); setVer((v) => v + 1); }}
                        json={JSON.stringify(opts.rules ?? {}, null, 2)}
                      />
                    </>
                  )}

                  {tab === "cheat" && cheat && (
                    <div data-dev-cheat className="space-y-3">
                      <p className="text-slate-400">치트룸 전용. 결제·멤버십·성인 확인이 모두 풀려 있고(💎 무제한, 특별 리액션·매혹 모드 사용 가능), 대화 제한은 <b>규칙 탭</b>과 <b>캐릭터 탭</b>에서 바로 고칩니다.</p>
                      <Section title={`호감도 ${Math.round(cheat.affection)}`}>
                        <input type="range" min={0} max={100} value={Math.round(cheat.affection)} onChange={(e) => cheat.setAffection(Number(e.target.value))} className="w-full" data-dev-cheat-aff />
                        <div className="mt-1 flex flex-wrap gap-1">
                          {[0, 20, 45, 75, 100].map((v) => (
                            <button key={v} type="button" onClick={() => cheat.setAffection(v)} className="rounded bg-slate-800 px-2 py-1">{v}</button>
                          ))}
                        </div>
                      </Section>
                      <Section title="바로 실행">
                        <div className="flex flex-wrap gap-1.5">
                          <button type="button" onClick={() => cheat.addGems(1000)} className="rounded bg-slate-800 px-2.5 py-1.5">💎 +1000</button>
                          <button type="button" onClick={cheat.clearSulk} className="rounded bg-slate-800 px-2.5 py-1.5">삐짐 풀기</button>
                          <button type="button" onClick={cheat.resetChat} className="rounded bg-red-900/70 px-2.5 py-1.5">대화 처음부터</button>
                        </div>
                      </Section>
                    </div>
                  )}

                  {tab === "check" && <CheckTab token={token} serverMain={data?.models.main ?? ""} choices={cfg?.models.choices ?? []} />}

                  {tab === "settings" && data && (
                    <>
                      <Section title="운영 스위치 — config/settings.ts">
                        {data.settings.map((s) => (
                          <div key={s.key} className="border-b border-slate-800 py-1.5 last:border-0">
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-300">{s.label}</span>
                              <span className={s.source === "env" ? "text-emerald-300" : "text-sky-300"}>
                                {s.value || "—"} <span className="text-[10px] text-slate-500">({SRC[s.source]})</span>
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              env {s.env}
                              {s.options ? ` = ${s.options.join(" | ")}` : ""} · {s.desc}
                            </div>
                          </div>
                        ))}
                      </Section>
                      <Section title="앱 설정 (파일 수정 후 배포)">
                        {data.app.map((a) => (
                          <div key={a.label} className="border-b border-slate-800 py-1.5 last:border-0">
                            <Row k={a.label} v={a.value} />
                            <div className="text-[10px] text-slate-500">{a.file}</div>
                          </div>
                        ))}
                      </Section>
                      <Section title="환경변수">
                        {data.modelEnv.map((e) => (<Row key={e.name} k={e.name} v={e.value ?? "— (기본값)"} />))}
                        {data.secrets.map((e) => (<Row key={e.name} k={e.name} v={e.set ? "🔒 설정됨" : "없음"} />))}
                      </Section>
                      <p className="text-[10px] text-slate-500">값 바꾸기: Vercel › Settings › Environment Variables → Redeploy. 기본값은 config/settings.ts. 전체 표 docs/MODES.md</p>
                    </>
                  )}
                </div>

                {(tab === "model" || tab === "persona" || tab === "rules") && (
                  <div className="sticky bottom-0 flex items-center gap-2 rounded-b-2xl border-t border-slate-700 bg-slate-950/95 py-2 pl-3 pr-8" data-dev-applybar>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-slate-400" data-dev-apply-state>
                      {appliedAt ? <b className="text-emerald-300">✓ 적용됨 — 다음 메시지부터</b> : dirty ? <b className="text-amber-300">● 수정됨 — 확인을 눌러야 적용돼요</b> : tab === "model" ? <span className="text-emerald-300">적용 중: {saved.model ? `🔒 ${saved.model.modelId}` : "자동"} (모델은 누르면 바로 적용)</span> : "수정 사항 없음"}
                    </span>
                    <button type="button" disabled={!dirty} onClick={discard} className="rounded bg-slate-800 px-2.5 py-1.5 disabled:opacity-40" data-dev-discard>되돌리기</button>
                    <button type="button" disabled={!dirty} onClick={apply} className="rounded bg-amber-300 px-4 py-1.5 font-bold text-slate-900 disabled:opacity-40" data-dev-apply>확인</button>
                  </div>
                )}
              </>
            )}
            {!ui.min && (
              <div
                onPointerDown={onSizeDown}
                onPointerMove={onSizeMove}
                onPointerUp={onSizeUp}
                onPointerCancel={onSizeUp}
                data-dev-resize
                title="끌어서 크기 조절"
                className="absolute bottom-0 right-0 z-10 flex h-7 w-7 cursor-nwse-resize touch-none select-none items-end justify-end rounded-br-2xl p-1 text-[13px] leading-none text-amber-300/80"
              >
                ◢
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

function FieldList({
  defs,
  defaults,
  values,
  onCommit,
  ver,
}: {
  defs: FieldDef[];
  defaults: Record<string, OverrideValue | undefined>;
  values: Record<string, OverrideValue | undefined>;
  onCommit: (def: FieldDef, text: string) => void;
  ver: string;
}) {
  return (
    <>
      {defs.map((d) => {
        const changed = values[d.key] !== undefined;
        const text = asText(changed ? values[d.key] : defaults[d.key]);
        const cls = `w-full rounded bg-slate-800 px-2 py-1 text-base outline-none focus:ring-1 focus:ring-amber-300 sm:text-[12px] ${changed ? "ring-1 ring-emerald-400/60" : ""}`;
        return (
          <label key={`${ver}-${d.key}-${changed}`} className="mb-2.5 block" data-dev-field={d.key}>
            <span className="mb-0.5 flex justify-between text-[11px] text-slate-400">
              <span>{d.label}{changed && <b className="ml-1 text-emerald-300">● 수정됨</b>}</span>
              {changed && (
                <button type="button" onClick={() => onCommit(d, "")} className="text-amber-300 underline">기본값</button>
              )}
            </span>
            {d.kind === "line" || d.kind === "number" ? (
              <input defaultValue={text} inputMode={d.kind === "number" ? "decimal" : undefined} onBlur={(e) => e.target.value !== text && onCommit(d, e.target.value)} className={cls} />
            ) : (
              <textarea defaultValue={text} rows={d.kind === "lines" ? 5 : 4} onBlur={(e) => e.target.value !== text && onCommit(d, e.target.value)} className={`${cls} resize-y leading-snug`} />
            )}
            {d.hint && <span className="mt-0.5 block text-[10px] text-slate-500">{d.hint}</span>}
          </label>
        );
      })}
    </>
  );
}

function ResetBar({ n, label, onReset, json }: { n: number; label: string; onReset: () => void; json: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="mt-1 flex gap-1.5">
      <button type="button" disabled={!n} onClick={onReset} className="rounded bg-slate-800 px-2 py-1 disabled:opacity-40">{label}</button>
      <button
        type="button"
        disabled={!n}
        onClick={() => {
          void navigator.clipboard?.writeText(json).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); });
        }}
        className="rounded bg-slate-800 px-2 py-1 disabled:opacity-40"
      >
        {done ? "복사됨" : "JSON 복사"}
      </button>
    </div>
  );
}

function shortModel(id: string) {
  return id.replace(/^(global|us|apac|eu)\./, "").replace(/^anthropic\.|^mistral\.|^amazon\.|^meta\./, "").replace(/-\d{8}-v\d:\d$/, "");
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-3 rounded-xl bg-slate-900 p-2.5">
      <h3 className="mb-1 text-[11px] font-bold text-amber-200">{title}</h3>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="shrink-0 text-slate-400">{k}</span>
      <span className="min-w-0 break-all text-right">{v}</span>
    </div>
  );
}

interface ProbeResult {
  mode: string;
  requestedModelId: string;
  ms: number;
  text: string;
  error: string;
  ok: boolean;
  request: { url: string; modelIdInUrl: string; headerNames: string[]; bodyKeys: string[]; guardrail: boolean; guardrailWhere: string[] } | null;
}

/** 🛡 Bedrock 요청 점검 — guardrail 없이 순수 모델 ID 로만 가는지 확인 */
function CheckTab({ token, serverMain, choices }: { token: string; serverMain: string; choices: OwnerCfg["models"]["choices"] }) {
  const [modelId, setModelId] = useState("");
  const [busy, setBusy] = useState<"" | "dry" | "live" | "selftest">("");
  const [res, setRes] = useState<ProbeResult | null>(null);
  const [err, setErr] = useState("");
  const bedrock = choices.filter((c) => c.provider === "bedrock");
  const run = async (mode: "dry" | "live" | "selftest") => {
    setBusy(mode);
    setErr("");
    try {
      const r = await fetch(apiUrl("/api/owner/probe"), {
        method: "POST",
        headers: { "x-owner-token": token, "Content-Type": "application/json" },
        body: JSON.stringify({ mode, modelId: modelId || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setRes(j as ProbeResult);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "실패");
    } finally {
      setBusy("");
    }
  };
  return (
    <>
      <p className="mb-2 text-[11px] text-slate-400">Bedrock 으로 나가는 요청에 guardrail(guardrailIdentifier·guardrailConfig·관련 헤더)이 없고 순수 모델 ID 로만 호출되는지 확인해요. 코드에도 안전장치가 있어서, 섞이면 전송 전에 막혀요.</p>
      <Section title="확인할 모델">
        <select value={modelId} onChange={(e) => setModelId(e.target.value)} data-dev-probe-model className="w-full rounded bg-slate-800 px-2 py-1 text-base outline-none sm:text-[12px]">
          <option value="">서버 메인 모델{serverMain ? ` (${serverMain})` : ""}</option>
          {bedrock.map((c) => (<option key={c.key} value={c.modelId}>{c.label} — {c.modelId}</option>))}
        </select>
        <div className="mt-2 flex gap-1.5">
          <button type="button" disabled={!!busy} onClick={() => void run("dry")} data-dev-probe="dry" className="flex-1 rounded bg-amber-300 px-2 py-1.5 font-bold text-slate-900 disabled:opacity-40">{busy === "dry" ? "확인 중…" : "요청 확인 (전송 없음)"}</button>
          <button type="button" disabled={!!busy} onClick={() => void run("live")} data-dev-probe="live" className="flex-1 rounded bg-slate-700 px-2 py-1.5 disabled:opacity-40">{busy === "live" ? "호출 중…" : "실제 호출 1회"}</button>
        </div>
        <button type="button" disabled={!!busy} onClick={() => void run("selftest")} data-dev-probe="selftest" className="mt-1.5 w-full rounded bg-slate-800 px-2 py-1 text-[11px] disabled:opacity-40">{busy === "selftest" ? "시험 중…" : "차단 장치 시험 (일부러 guardrail 을 섞어 막히는지 확인, 전송 없음)"}</button>
        <p className="mt-1 text-[10px] text-slate-500">요청 확인은 네트워크로 보내지 않고 ‘보내질 요청’만 만들어 검사해요. 실제 호출은 아주 짧은 인사 1번(토큰 수십 개).</p>
      </Section>
      {err && <p className="mb-2 text-red-400">⚠️ {err}</p>}
      {res && (
        <Section title={`결과 — ${res.mode === "live" ? "실제 호출" : res.mode === "selftest" ? "차단 장치 시험" : "요청 확인"}`}>
          <p className={`mb-1 text-[13px] font-bold ${res.ok ? "text-emerald-300" : "text-red-400"}`} data-dev-probe-result>
            {res.mode === "selftest" ? (res.ok ? "✅ 차단 장치 정상 — guardrail 이 섞이면 전송 전에 막힘" : "❌ 차단 장치가 동작하지 않았어요") : res.ok ? "✅ guardrail 없음 · 순수 모델 ID 요청" : "❌ 문제 있음"}
          </p>
          {res.request ? (
            <>
              <Row k="요청 URL" v={res.request.url} />
              <Row k="URL 속 모델 ID" v={res.request.modelIdInUrl} />
              <Row k="요청한 모델 ID" v={res.requestedModelId} />
              <Row k="본문 최상위 항목" v={res.request.bodyKeys.join(", ") || "—"} />
              <Row k="헤더 이름" v={res.request.headerNames.join(", ") || "—"} />
              <Row k="guardrail 포함" v={res.request.guardrail ? `있음: ${res.request.guardrailWhere.join(", ")}` : "없음"} />
            </>
          ) : (
            <p className="text-slate-400">요청을 만들지 못했어요.</p>
          )}
          {res.text && <Row k="응답" v={res.text} />}
          {res.error && <p className="mt-1 break-all text-[11px] text-red-300">{res.error}</p>}
          <Row k="걸린 시간" v={`${(res.ms / 1000).toFixed(1)}초`} />
        </Section>
      )}
    </>
  );
}

/* ── 📡 실시간 모델 모니터 ──────────────────────────────────────────────────
 *  이 기기: 내가 보낸 턴마다 받은 debug (모델·경로·맥락 의존도·시간·토큰)
 *  서버 전체: GET /api/owner/ctxlog 를 4초마다 (모든 유저의 일반 대화방 턴 — 서버 인스턴스별 메모리)
 */
const FAMILIES: { id: string; label: string; re: RegExp; cls: string }[] = [
  { id: "opus", label: "Opus", re: /opus|fable|mythos/i, cls: "bg-fuchsia-500 text-white" },
  { id: "sonnet", label: "Sonnet", re: /sonnet/i, cls: "bg-sky-500 text-white" },
  { id: "haiku", label: "Haiku", re: /haiku/i, cls: "bg-emerald-500 text-slate-950" },
  { id: "nova", label: "Nova", re: /nova/i, cls: "bg-orange-400 text-slate-950" },
  { id: "grok", label: "Grok", re: /grok/i, cls: "bg-rose-500 text-white" },
  { id: "gemini", label: "Gemini", re: /gemini/i, cls: "bg-indigo-400 text-white" },
  { id: "pool", label: "답장풀", re: /^pool$|reply-pool/i, cls: "bg-slate-500 text-white" },
];
const familyOf = (model?: string, route?: string) =>
  (route === "pool" ? FAMILIES.find((f) => f.id === "pool") : FAMILIES.find((f) => f.re.test(model ?? ""))) ?? { id: "other", label: "기타", re: /./, cls: "bg-slate-700 text-slate-100" };
const LEVEL_CLS: Record<string, string> = { high: "text-rose-300", mid: "text-amber-300", low: "text-emerald-300" };
const hhmmss = (t: number) => new Date(t).toLocaleTimeString("ko-KR", { hour12: false });

function UsageBar({ items }: { items: { model?: string; route?: string }[] }) {
  if (!items.length) return null;
  const counts = new Map<string, { label: string; cls: string; n: number }>();
  for (const it of items) {
    const f = familyOf(it.model, it.route);
    const c = counts.get(f.id) ?? { label: f.label, cls: f.cls, n: 0 };
    c.n++;
    counts.set(f.id, c);
  }
  const list = [...counts.values()].sort((a, b) => b.n - a.n);
  return (
    <div className="mb-2">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-800">
        {list.map((c) => (
          <span key={c.label} className={c.cls} style={{ width: `${(c.n / items.length) * 100}%` }} />
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
        {list.map((c) => (
          <span key={c.label} className={`rounded px-1.5 ${c.cls}`}>{c.label} {Math.round((c.n / items.length) * 100)}% ({c.n})</span>
        ))}
      </div>
    </div>
  );
}

function LiveTab({ token, history }: { token: string; history: TurnLog[] }) {
  const [scope, setScope] = useState<"me" | "server">("me");
  const [rows, setRows] = useState<ServerRow[]>([]);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (scope !== "server") return;
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch(apiUrl("/api/owner/ctxlog"), { headers: { "x-owner-token": token }, cache: "no-store" });
        const j = (await r.json()) as { rows?: ServerRow[]; error?: string };
        if (stop) return;
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        setRows(j.rows ?? []);
        setErr("");
      } catch (e) {
        if (!stop) setErr(e instanceof Error ? e.message : String(e));
      }
    };
    void load();
    const t = setInterval(load, 4000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [scope, token]);

  const mine = [...history].reverse();
  const server = [...rows].reverse().slice(0, 80);

  return (
    <div data-dev-live>
      <div className="mb-2 flex items-center gap-1">
        {(["me", "server"] as const).map((k) => (
          <button key={k} type="button" data-dev-live-scope={k} onClick={() => setScope(k)} className={`rounded-full px-2.5 py-0.5 ${scope === k ? "bg-amber-300 font-bold text-slate-900" : "bg-slate-800"}`}>
            {k === "me" ? "이 기기" : "서버 전체"}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          {scope === "me" ? "매 턴 갱신" : "4초마다"}
        </span>
      </div>

      {scope === "me" ? (
        <>
          <UsageBar items={history.map((h) => ({ model: h.model, route: h.path }))} />
          {mine.length === 0 && <p className="text-slate-400">아직 기록이 없어요. 말을 보내면 턴마다 여기에 쌓여요. (모델 탭에서 고정 모델을 풀고, 프롬프트를 &quot;서비스&quot;로 두면 손님과 같은 라우팅을 볼 수 있어요)</p>}
          {mine.map((h, i) => {
            const prev = mine[i + 1];
            const f = familyOf(h.model, h.path);
            const changed = !!prev && prev.model !== h.model;
            return (
              <div key={h.at + "-" + i} data-dev-live-row className={`mb-1 rounded-lg p-1.5 ${i === 0 ? "bg-slate-800 ring-1 ring-amber-300/50" : "bg-slate-900"}`} onClick={() => setOpen(open === i ? null : i)}>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500">{hhmmss(h.at)}</span>
                  <span className={`rounded px-1.5 text-[10px] font-bold ${f.cls}`}>{f.label}</span>
                  <span className="min-w-0 truncate text-[11px]">{shortModel(h.model)}</span>
                  {changed && <span className="shrink-0 text-[10px] text-amber-300" title={`이전: ${prev.model}`}>↔ 바뀜</span>}
                  {h.fellBack && <span className="shrink-0 text-[10px] text-rose-300">우회</span>}
                  <span className="ml-auto shrink-0 text-[10px] text-slate-400">{(h.ms / 1000).toFixed(1)}s</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span className="shrink-0">{h.personaName}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-200">{h.kind === "text" ? `"${h.userText ?? ""}"` : `(${h.kind})`}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px]">
                  <span>경로 <b className="text-amber-200">{h.path ?? h.tier}</b></span>
                  {h.ctx && (
                    <span>맥락 <b className={LEVEL_CLS[h.ctx.level] ?? ""}>{h.ctx.level} {h.ctx.score}</b>{h.ctx.reason ? ` · ${h.ctx.reason}` : ""}</span>
                  )}
                  <span className="text-slate-500">토큰 {h.tokens.in}/{h.tokens.out}{h.tokens.cache ? ` (캐시 ${h.tokens.cache})` : ""}</span>
                </div>
                {open === i && (
                  <div className="mt-1 border-t border-slate-700 pt-1 text-[10px] text-slate-400">
                    <p>tier: {h.tier} · reason: {h.reason} · 프롬프트: {h.promptMode}</p>
                    {h.ctx && <p>피처: {Object.entries(h.ctx.features).map(([k, v]) => `${k} ${v}`).join(" · ") || "없음"}</p>}
                    {h.attempts.length > 0 && <p>시도: {h.attempts.map((a) => `${a.ok ? "✅" : "✕"} ${shortModel(a.model)} ${a.ms}ms`).join(" → ")}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </>
      ) : (
        <>
          {err && <p className="mb-1 text-red-400">⚠️ {err}</p>}
          <UsageBar items={rows.map((r) => ({ model: r.model, route: r.route }))} />
          <p className="mb-1 text-[10px] text-slate-500">손님(일반 대화방) 턴만 · 이 서버 인스턴스에 쌓인 최근 {rows.length}개 · 엑셀: /api/owner/ctxlog?format=csv</p>
          {server.length === 0 && !err && <p className="text-slate-400">아직 기록이 없어요.</p>}
          {server.map((r, i) => {
            const f = familyOf(r.model, r.route);
            return (
              <div key={r.at + "-" + i} data-dev-live-srow className="mb-1 rounded-lg bg-slate-900 p-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500">{hhmmss(r.at)}</span>
                  <span className={`rounded px-1.5 text-[10px] font-bold ${f.cls}`}>{r.model || r.route ? f.label : "…"}</span>
                  <span className="min-w-0 truncate text-[11px]">{r.model ? shortModel(r.model) : r.route ?? "응답 대기/실패"}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-slate-400">{r.persona}</span>
                </div>
                <div className="mt-0.5 flex gap-1.5 text-[10px]">
                  <span className="min-w-0 flex-1 truncate text-slate-200">&quot;{r.text}&quot;</span>
                  <span className={`shrink-0 ${LEVEL_CLS[r.level] ?? ""}`}>{r.level} {r.score}{r.reason ? ` · ${r.reason}` : ""}</span>
                  <span className="shrink-0 text-amber-200">{r.route}</span>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
