import { NextResponse } from "next/server";
import { isOwnerToken } from "@/lib/owner";

/**
 * POST /api/owner/verify { token } — 기기에 저장된 주인님 토큰이 아직 유효한지 확인한다.
 *  치트 문구(OWNER_CHEAT_PHRASE)를 바꾸면 예전 토큰은 무효가 되므로, 앱이 시작할 때 확인해서
 *  무효면 토큰을 지우고 치트룸에서 나오게 한다. (토큰만 확인 — 문구는 노출되지 않는다)
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  return NextResponse.json({ ok: isOwnerToken(body?.token) });
}
