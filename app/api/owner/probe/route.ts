import { NextResponse } from "next/server";
import { generateText } from "ai";
import { bedrockClaudeOptions, createBedrockModel, defaultBedrockModelId, fixBedrockModelId, lastBedrockRequest, resetBedrockRequest } from "@/config/ai";
import { isOwnerToken } from "@/lib/owner";

/**
 * POST /api/owner/probe — 🛠 점검 탭: Bedrock 요청에 guardrail 이 없는지 확인 (헤더 x-owner-token 필요)
 *  body { mode: "dry" | "live" | "selftest", modelId?: string }
 *   dry  = 네트워크 전송 없이 "보내질 요청"만 만들어 검사 (키 없어도 가능)
 *   live = 실제로 아주 짧은 호출 1번 (토큰 몇십 개 비용) → 응답 글자·걸린 시간·오류까지 확인
 *   selftest = 일부러 guardrail 을 섞어 보내 보고, 코드의 차단 장치가 전송 전에 막는지 확인 (네트워크 전송 없음)
 *  결과: URL 속 모델 ID, 헤더 이름, 본문 최상위 항목, guardrail 포함 여부 (값·키는 내보내지 않음)
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  if (!isOwnerToken(request.headers.get("x-owner-token"))) {
    return NextResponse.json({ error: "주인님 모드에서만 쓸 수 있어요." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { mode?: string; modelId?: string };
  const live = body.mode === "live";
  const selftest = body.mode === "selftest";
  const modelId = fixBedrockModelId((body.modelId?.trim() || defaultBedrockModelId()).replace(/^bedrock:/, ""));
  const started = Date.now();
  resetBedrockRequest();

  // 전송하지 않는 가짜 응답 (dry)
  const fakeFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({ output: { message: { role: "assistant", content: [{ text: "(dry-run: 전송하지 않음)" }] } }, stopReason: "end_turn", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }),
      { status: 200, headers: { "content-type": "application/json" } }
    );

  let text = "";
  let error = "";
  try {
    const model = createBedrockModel(modelId, live ? {} : { fetchImpl: fakeFetch, apiKey: "dry-run-key" });
    const r = await generateText({
      model,
      // 실제 대화와 같은 모양: 시스템 지침 + 캐시 지점 + 모델별 옵션
      instructions: { role: "system", content: "한 단어로 짧게 인사해라.", providerOptions: { bedrock: { cachePoint: { type: "default" } } } },
      messages: [{ role: "user", content: "안녕" }],
      maxOutputTokens: 40,
      maxRetries: 0,
      providerOptions: (selftest
        ? { bedrock: { ...(bedrockClaudeOptions(modelId)?.bedrock ?? {}), guardrailConfig: { guardrailIdentifier: "selftest", guardrailVersion: "1" } } }
        : bedrockClaudeOptions(modelId)) as never,
    });
    text = r.text;
  } catch (e) {
    error = e instanceof Error ? e.message.slice(0, 400) : String(e).slice(0, 400);
  }
  const rec = lastBedrockRequest();
  return NextResponse.json({
    mode: selftest ? "selftest" : live ? "live" : "dry",
    requestedModelId: modelId,
    ms: Date.now() - started,
    text,
    error,
    request: rec,
    // selftest: 차단 장치가 제대로 막았으면 성공 / 그 밖: guardrail 이 없어야 성공
    ok: selftest ? !!rec?.guardrail && error.includes("전송을 막았습니다") : !!rec && !rec.guardrail && rec.modelIdInUrl === modelId,
  });
}
