import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getPersonaFile, isPersonaId } from "@/lib/personas/server";
import { resolveModel } from "@/config/ai";
import { BALANCE } from "@/config/balance";

/**
 * POST /api/memory — 기억 노트 갱신 (텍스트 톡 + 보이스톡 공통)
 *
 * 최근 대화를 읽고 "앞으로도 기억할 만한 것"을 한 줄씩 정리해 기존 기억과 합친다.
 * 만든 기억은 브라우저에 저장되고(대화방 기록과 함께), 다음 텍스트 톡·보이스톡 프롬프트에 들어간다.
 * 💰 저렴한 보조 모델을 쓴다 (config/ai.ts cheapModel, 또는 AI_CHEAP_MODEL)
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const bodySchema = z.object({
  personaId: z.string().max(64),
  facts: z.array(z.string().max(300)).max(80).default([]),
  turns: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(1000), voice: z.boolean().optional(), at: z.number().optional() }))
    .min(1)
    .max(200),
  timeZone: z.string().max(64).optional(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isPersonaId(parsed.data.personaId)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const persona = getPersonaFile(parsed.data.personaId);
  const max = BALANCE.memory.maxFacts;
  const turns = parsed.data.turns.slice(-BALANCE.memory.maxTurnsPerUpdate);
  let today = "";
  try {
    today = new Intl.DateTimeFormat("ko-KR", { timeZone: parsed.data.timeZone || "Asia/Seoul", dateStyle: "long" }).format(new Date());
  } catch {
    /* 무시 */
  }
  const log = turns
    .map((t) => `${t.role === "user" ? "유저" : persona.name}${t.voice ? "(보이스톡)" : ""}: ${t.content.slice(0, 400)}`)
    .join("\n");

  try {
    const resolved = resolveModel("cheap");
    const { output } = await generateText({
      model: resolved.model,
      instructions: `너는 "${persona.name}"의 기억을 정리하는 도우미다. ${persona.name}가 유저와 나눈 대화(톡과 보이스톡)를 읽고, 앞으로 대화할 때 기억하고 있어야 할 것을 한 줄씩 정리한다.
- 기억할 것: 유저의 이름·호칭, 직업·일상, 좋아하는 것/싫어하는 것, 기분과 고민, 중요한 사건·일정, 약속, 둘만의 농담·별명, 관계의 변화(고백, 말 놓기 등).
- 각 항목은 짧은 한국어 한 문장. 시점이 중요하면 날짜를 붙인다(오늘: ${today}).
- 기존 기억과 합쳐 중복을 없애고, 바뀐 내용은 새 것으로 고친다. 덜 중요하고 오래된 것부터 빼서 최대 ${max}개.
- 대화에 없는 것은 지어내지 마라. 주소·연락처·금융정보·비밀번호 같은 개인정보는 적지 마라.`,
      messages: [
        {
          role: "user",
          content: `[기존 기억]\n${parsed.data.facts.map((f) => `- ${f}`).join("\n") || "(없음)"}\n\n[최근 대화]\n${log}`,
        },
      ],
      output: Output.object({
        schema: z.object({ facts: z.array(z.string()).catch([]).describe(`정리된 기억 목록 (최대 ${max}개, 중요한 순)`) }),
        name: "memory",
      }),
      maxOutputTokens: 1200,
      maxRetries: 1,
      ...(resolved.providerOptions ? { providerOptions: resolved.providerOptions as never } : {}),
    });
    const facts = output.facts.map((f) => f.trim().slice(0, 200)).filter(Boolean).slice(0, max);
    // 모델이 실패해 빈 목록을 주면 기존 기억을 지키기
    return NextResponse.json({ facts: facts.length ? facts : parsed.data.facts.slice(0, max), model: resolved.modelId });
  } catch (error) {
    console.error("[/api/memory]", error);
    return NextResponse.json({ error: "기억을 정리하지 못했어요." }, { status: 502 });
  }
}
