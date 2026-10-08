/**
 * 구조화 답장(JSON 도구)을 제대로 못 돌려주는 모델용 복구.
 *  Bedrock 의 도구 강제(toolChoice)는 Claude·Mistral Large 등 일부 모델만 지원한다.
 *  Grok·Llama 등은 도구를 무시하고 그냥 글로 답하거나, JSON 을 ```json 코드 블록에 넣어 답하는 경우가 있어
 *  "No object generated: could not parse the response" 오류가 난다.
 *  → 응답 글에서 JSON 을 찾아 쓰고, JSON 이 없으면 글 자체를 말풍선으로 나눠 쓴다.
 */
export function extractJsonObject(text: string): unknown | null {
  const t = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const cands = [fence?.[1], t];
  for (const c of cands) {
    if (!c) continue;
    const s = c.indexOf("{");
    const e = c.lastIndexOf("}");
    if (s < 0 || e <= s) continue;
    try {
      const v = JSON.parse(c.slice(s, e + 1));
      if (v && typeof v === "object") return (v as { json?: unknown }).json && typeof (v as { json?: unknown }).json === "object" ? (v as { json: unknown }).json : v;
    } catch {
      /* 다음 후보 */
    }
  }
  return null;
}

/** JSON 이 없을 때: 글을 말풍선(최대 5개)으로 */
export function proseToBubbles(text: string): string[] {
  const t = text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```[\s\S]*?```/g, "").trim();
  if (!t) return [];
  const parts = t.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  return (parts.length ? parts : [t]).slice(0, 5).map((s) => s.slice(0, 600));
}
