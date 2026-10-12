import { NextResponse } from "next/server";
import { listPublicPersonas } from "@/lib/personas/server";

/**
 * GET /api/personas — 📦 앱이 시작할 때 받는 최신 인물 목록 (업데이트 이원화)
 *  인물 JSON·리소스를 서버에 올리고 배포만 하면, 이미 설치된 앱도 다음 실행부터 새 인물·영상·사진을 쓴다.
 *  ?abs=1 이면 리소스 주소를 서버 전체 주소로 바꿔 준다 (앱 안에 없는 새 파일도 서버에서 받도록).
 *  공개 데이터만 (프롬프트는 서버에만).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = `${url.protocol}//${request.headers.get("x-forwarded-host") ?? url.host}`;
  const abs = url.searchParams.get("abs") === "1";
  const list = listPublicPersonas();
  const fix = (v: unknown): unknown => {
    if (typeof v === "string") return abs && v.startsWith("/avatar/") ? `${origin}${v}` : v;
    if (Array.isArray(v)) return v.map(fix);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fix(x)]));
    return v;
  };
  return NextResponse.json({ v: Date.now(), personas: abs ? fix(list) : list }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
}
