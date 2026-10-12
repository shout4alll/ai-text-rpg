import { NextResponse } from "next/server";
import { isOwnerToken } from "@/lib/owner";
import { liveSince } from "@/lib/liveFeed";

/** GET /api/owner/live?since=<ms> — 💬 실시간 대화 모니터 (헤더 x-owner-token 필요, lib/liveFeed.ts) */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isOwnerToken(request.headers.get("x-owner-token"))) {
    return NextResponse.json({ error: "주인님 모드에서만 볼 수 있어요." }, { status: 403 });
  }
  const since = Number(new URL(request.url).searchParams.get("since") ?? 0) || 0;
  return NextResponse.json({ now: Date.now(), turns: liveSince(since) });
}
