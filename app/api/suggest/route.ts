import { NextResponse } from "next/server";
import { generateText } from "ai";
import { z } from "zod";
import { getPersonaFile, isPersonaId } from "@/lib/personas/server";
import { runWithFallback } from "@/lib/modelRouter";

/**
 * POST /api/suggest — 💡 추천 대화: 지금 상황에 맞는 유저 쪽 답장·질문 3~5개 (유저 말투 그대로)
 *  💰 가벼운 모델(하이쿠) → 저렴한 모델 → 메인 순. 최근 12턴·턴당 200자만 보낸다. 출력은 JSON 한 줄.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  personaId: z.string(),
  turns: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .max(40),
  userName: z.string().max(20).optional(),
});

const SYSTEM = `너는 메신저 앱의 "추천 답장" 기능이다. 유저가 캐릭터에게 보낼 말을 대신 제안한다.
규칙:
- 유저의 말투를 그대로 따라 해라: 반말/존댓말, 문장 길이, 'ㅋㅋ'·'ㅎㅎ'·이모지·물결(~) 쓰는 습관, 캐릭터를 부르는 호칭. 유저 말이 없으면 가볍고 친근한 존댓말.
- 캐릭터의 마지막 말에 자연스럽게 이어지는 말이어야 한다. 질문을 받았으면 그 답이 되는 후보를 먼저.
- 서로 방향이 다른 후보 4개: 공감·리액션 / 대답·내 이야기 / 되묻는 질문 / 장난·설렘 또는 새 화제. 같은 말 반복 금지.
- 각 후보는 메신저 한 줄(25자 안팎, 최대 40자). 캐릭터 대사가 아니라 유저가 보낼 말이다.
- 성적인 표현, 욕설, 개인정보(전화번호·주소)는 넣지 마라.
출력은 JSON 한 줄만: {"s":["후보1","후보2","후보3","후보4"]}`;

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isPersonaId(parsed.data.personaId)) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  const persona = getPersonaFile(parsed.data.personaId);
  if (persona.cheatRoom) return NextResponse.json({ suggestions: [] });
  const recent = parsed.data.turns
    .filter((t) => t.content.trim())
    .slice(-12)
    .map((t) => `${t.role === "user" ? "유저" : persona.name}: ${t.content.replace(/\s+/g, " ").slice(0, 200)}`)
    .join("\n");
  const prompt = `캐릭터: ${persona.name} (${persona.age}세 · ${persona.occupation})${parsed.data.userName ? `\n유저 이름: ${parsed.data.userName}` : ""}
[최근 대화]
${recent || "(아직 대화가 없다 — 첫 인사·호기심 질문을 제안해라)"}

유저가 지금 보낼 말 후보 4개를 JSON 으로.`;
  try {
    const ran = await runWithFallback("/api/suggest", ["light", "cheap", "chat"], (r) =>
      generateText({
        model: r.model,
        system: SYSTEM,
        prompt,
        maxOutputTokens: 400,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(12_000),
        ...(r.providerOptions ? { providerOptions: r.providerOptions as never } : {}),
      })
    );
    const text = ran.result.text ?? "";
    let list: string[] = [];
    const m = /\{[\s\S]*\}/.exec(text);
    if (m) {
      try {
        const j = JSON.parse(m[0]) as { s?: unknown };
        if (Array.isArray(j.s)) list = j.s.filter((x): x is string => typeof x === "string");
      } catch {
        /* 아래에서 줄 단위로 */
      }
    }
    if (!list.length) list = text.split(/\n+/).map((l) => l.replace(/^[\s\-*\d.)"]+|"$/g, "").trim());
    const out = [...new Set(list.map((s) => s.trim().replace(/^["']|["']$/g, "").slice(0, 60)).filter((s) => s.length > 0))].slice(0, 5);
    return NextResponse.json({ suggestions: out, model: ran.resolved.modelId });
  } catch (e) {
    console.warn(`[/api/suggest] 실패: ${e instanceof Error ? e.message.slice(0, 160) : String(e)}`);
    return NextResponse.json({ error: "추천을 만들지 못했어요" }, { status: 500 });
  }
}
