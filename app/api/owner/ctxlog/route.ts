import { NextResponse } from "next/server";
import { isOwnerToken } from "@/lib/owner";
import { ctxLog } from "@/lib/continuity";

/**
 * GET /api/owner/ctxlog — 🧵 맥락 의존도 판단 기록 (헤더 x-owner-token 필요)
 *  ?format=csv 면 엑셀에서 바로 여는 CSV. 마지막 "label" 칸에 사람이 0(맥락 없이 이해 가능)/1(앞 대화가 필요)을 적어
 *  가중치·문턱(config/balance.json routing.continuity.score)을 맞추는 데 쓴다.
 *  (서버 메모리 — Vercel 인스턴스마다 따로 쌓이고, 재배포·재시작하면 비워진다)
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FEATURES = ["veryShort", "short", "reference", "noSubject", "interjection", "closing", "answer", "overlapAi", "overlapTopic", "topic", "confusion", "insist"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!isOwnerToken(request.headers.get("x-owner-token") ?? url.searchParams.get("token"))) {
    return NextResponse.json({ error: "주인님 모드에서만 볼 수 있어요." }, { status: 403 });
  }
  const rows = ctxLog();
  if (url.searchParams.get("format") !== "csv") return NextResponse.json({ count: rows.length, rows });
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/\s+/g, " ")}"`;
  const head = ["at", "persona", "text", "prevAi", "score", "level", "reason", "route", "model", ...FEATURES, "label"];
  const lines = rows.map((r) =>
    [new Date(r.at).toISOString(), r.persona, r.text, r.prevAi, r.score, r.level, r.reason, r.route, r.model, ...FEATURES.map((k) => r.features[k] ?? 0), ""].map(q).join(",")
  );
  return new NextResponse("﻿" + [head.join(","), ...lines].join("\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="ctxlog-${Date.now()}.csv"` },
  });
}
