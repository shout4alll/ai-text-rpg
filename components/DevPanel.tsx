"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { apiUrl } from "@/lib/apiBase";
import type { ChatResponse } from "@/types/game";

/**
 * 🛠 주인님 모드 상태판 — 지금 어떤 모델·모드·설정으로 돌아가는지 한눈에.
 * 서버 값: GET /api/status/full (주인 토큰 필요) · 이번 턴 값: /api/chat 응답의 debug
 * 설정을 바꾸는 곳은 각 줄의 "환경변수 / 파일" 표시 참고 (config/settings.ts 에 모두 정리됨)
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

const SRC: Record<string, string> = { env: "환경변수", default: "기본값", cms: "CMS" };

export default function DevPanel({
  token,
  last,
  client,
  className = "",
}: {
  token: string;
  last: ChatResponse["debug"] | null;
  /** 이 기기·이 대화방 상태 */
  client: { label: string; value: string }[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<FullStatus | null>(null);
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    try {
      const r = await fetch(apiUrl("/api/status/full"), { headers: { "x-owner-token": token }, cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setData(j as FullStatus);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "불러오지 못했어요");
    }
  };
  useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-dev-toggle
        className={`inline-flex h-8 items-center gap-1 rounded-full bg-slate-900/85 px-2.5 text-[12px] font-bold text-amber-300 shadow-sm ring-1 ring-amber-300/40 backdrop-blur active:scale-95 ${className}`}
        aria-label="상태판"
      >
        🛠 {last ? <span className="max-w-[7.5rem] truncate font-mono text-[10px] text-amber-100">{last.tier}·{shortModel(last.model)}</span> : "상태"}
      </button>
      {open &&
        createPortal(
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/50 p-3 pt-[max(1rem,env(safe-area-inset-top))]" onClick={() => setOpen(false)} data-dev-panel>
          <div className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-slate-950 p-4 font-mono text-[12px] leading-relaxed text-slate-200 shadow-xl ring-1 ring-amber-300/30" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <b className="text-amber-300">🛠 주인님 상태판</b>
              <span className="flex gap-2">
                <button type="button" onClick={() => void load()} className="rounded bg-slate-800 px-2 py-0.5">새로고침</button>
                <button type="button" onClick={() => setOpen(false)} className="rounded bg-slate-800 px-2 py-0.5">닫기</button>
              </span>
            </div>

            <Section title="이번 턴">
              {last ? (
                <>
                  <Row k="모델" v={`${last.model}`} />
                  <Row k="경로" v={`${last.tier} (${last.reason})${last.fellBack ? " · 대체됨" : ""}`} />
                  <Row k="매혹" v={last.allure ? `켜짐 · 수위 ${last.allureLevel}` : "꺼짐"} />
                  <Row k="응답 시간" v={`${(last.ms / 1000).toFixed(1)}초`} />
                </>
              ) : (
                <p className="text-slate-400">아직 답장이 없어요. 말을 보내면 표시돼요.</p>
              )}
            </Section>

            <Section title="이 기기 · 이 대화방">
              {client.map((c) => (
                <Row key={c.label} k={c.label} v={c.value} />
              ))}
            </Section>

            {err && <p className="my-2 text-red-400">⚠️ {err}</p>}
            {data && (
              <>
                <Section title={`서버 모델 (${data.env}${data.deploy ? ` · ${data.deploy}` : ""})`}>
                  <Row k="프로바이더" v={`${data.models.provider} · ${data.models.label}${data.models.region ? ` · ${data.models.region}` : ""}`} />
                  <Row k="메인" v={data.models.main} />
                  <Row k="가벼운 대화" v={`${data.models.light}${data.models.routing ? "" : " (라우팅 꺼짐)"}`} />
                  <Row k="기억 정리" v={data.models.cheap} />
                  <Row k="성인(매혹)" v={data.models.mature} />
                </Section>

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
                  {data.modelEnv.map((e) => (
                    <Row key={e.name} k={e.name} v={e.value ?? "— (기본값)"} />
                  ))}
                  {data.secrets.map((e) => (
                    <Row key={e.name} k={e.name} v={e.set ? "🔒 설정됨" : "없음"} />
                  ))}
                </Section>
              </>
            )}
            <p className="mt-2 text-[10px] text-slate-500">값 바꾸기: Vercel › Settings › Environment Variables → Redeploy. 기본값은 config/settings.ts. 전체 표 docs/MODES.md</p>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}

function shortModel(id: string) {
  return id.replace(/^(global|us|apac|eu)\./, "").replace(/^anthropic\.|^mistral\.|^amazon\./, "").replace(/-\d{8}-v\d:\d$/, "");
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
