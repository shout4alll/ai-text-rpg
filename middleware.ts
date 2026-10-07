import { NextResponse, type NextRequest } from "next/server";

/**
 * 📱 앱(Capacitor)에서 오는 API 요청 허용 (CORS).
 * 앱 화면의 주소: 안드로이드 https://localhost · iOS capacitor://localhost
 * 다른 출처를 더 허용하려면 APP_ORIGINS=https://a.com,https://b.com (쉼표 구분)
 */
const DEFAULT_ORIGINS = ["https://localhost", "capacitor://localhost", "http://localhost", "ionic://localhost"];

function allowed(origin: string | null): string | null {
  if (!origin) return null;
  const extra = (process.env.APP_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return [...DEFAULT_ORIGINS, ...extra].includes(origin) ? origin : null;
}

export function middleware(req: NextRequest) {
  const origin = allowed(req.headers.get("origin"));
  const headers: Record<string, string> = origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": req.headers.get("access-control-request-headers") ?? "content-type",
        "Access-Control-Expose-Headers": "x-ai-model",
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
      }
    : {};
  if (req.method === "OPTIONS") return new NextResponse(null, { status: origin ? 204 : 403, headers });
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

export const config = { matcher: "/api/:path*" };
