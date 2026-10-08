import { NextResponse } from "next/server";
import { z } from "zod";
import { containsPhrase, ownerToken } from "@/lib/owner";

/**
 * POST /api/owner/enter { code } — 🔑 치트 코드로 입장 (치트룸·주인님 모드 공용)
 *  치트 문구는 서버에서만 비교한다. 맞으면 대화 중 문구를 쳤을 때와 같은 토큰을 내려 준다.
 *  무차별 대입 방지: 같은 IP 에서 1분에 8번까지.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const hits = new Map<string, number[]>();
const bodySchema = z.object({ code: z.string().min(1).max(200) });

export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 8) return NextResponse.json({ ok: false, error: "잠시 후 다시 시도해 주세요." }, { status: 429 });
  hits.set(ip, [...recent, now]);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "코드를 입력해 주세요." }, { status: 400 });
  // 문구가 글 안에 들어 있어도 인식하는 대화 중 규칙과 같게 비교한다
  if (!containsPhrase(parsed.data.code)) return NextResponse.json({ ok: false, error: "코드가 맞지 않아요." }, { status: 403 });
  return NextResponse.json({ ok: true, ownerToken: ownerToken() });
}
