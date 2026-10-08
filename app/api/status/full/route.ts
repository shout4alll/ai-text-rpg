import { NextResponse } from "next/server";
import { describeModel } from "@/config/ai";
import { appSettings, MODEL_ENV, resolveSetting, SECRET_ENV, SERVER_SETTINGS } from "@/config/settings";
import { isOwnerToken } from "@/lib/owner";

/**
 * GET /api/status/full — 🛠 주인님 모드 상태판용 (헤더 x-owner-token 필요).
 * 모든 운영 설정의 현재 값·출처, 모델, 환경변수 설정 여부. 비밀 값은 "있음/없음"만.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isOwnerToken(request.headers.get("x-owner-token"))) {
    return NextResponse.json({ error: "주인님 모드에서만 볼 수 있어요." }, { status: 403 });
  }
  const m = describeModel();
  return NextResponse.json({
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    deploy: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    models: {
      provider: m.provider,
      label: m.label,
      region: m.region ?? null,
      main: m.modelId,
      light: m.lightModelId,
      cheap: m.cheapModelId,
      mature: resolveSetting("matureModel").value || `(메인과 같음) ${m.modelId}`,
      routing: m.routing && resolveSetting("routing").value !== "off",
    },
    settings: SERVER_SETTINGS.map((s) => {
      const r = resolveSetting(s.key);
      return { key: s.key, label: s.label, group: s.group, value: r.value, source: r.source, env: s.env, options: "options" in s ? s.options : null, desc: s.desc, usedIn: s.usedIn };
    }),
    app: appSettings(),
    modelEnv: MODEL_ENV.map((k) => ({ name: k, value: process.env[k]?.trim() || null })),
    secrets: SECRET_ENV.map((k) => ({ name: k, set: !!process.env[k]?.trim() })),
  });
}
