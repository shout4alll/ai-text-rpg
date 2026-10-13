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
  // 깨진 JSON (키 중복·따옴표 누락·중간에 끊김 등): 필드를 하나씩 건져 낸다
  for (const c of cands) {
    if (!c) continue;
    const r = repairReply(c);
    if (r) return r;
  }
  return null;
}

const unq = (v: string) => {
  try {
    return JSON.parse(`"${v}"`) as string;
  } catch {
    return v.replace(/\\n/g, "\n").replace(/\\"/g, '"');
  }
};

/**
 * 형식이 깨진 답장 JSON 에서 messages 와 나머지 필드를 정규식으로 건진다.
 *  예) {"messages":["왔네.","..."],"reaction":"nod",...,"seen":"",", "soothed":false}  ← 모델이 쉼표·따옴표를 잘못 씀
 */
export function repairReply(text: string): Record<string, unknown> | null {
  const m = /"messages"\s*:\s*\[/.exec(text);
  if (!m) return null;
  // 배열 끝(]) 찾기 — 문자열 안의 ] 는 건너뛴다. 끝이 없으면(잘림) 끝까지
  let i = m.index + m[0].length;
  let inStr = false;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (ch === "\\") i++;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "]") break;
  }
  const body = text.slice(m.index + m[0].length, i);
  let messages: string[] = [];
  try {
    const arr = JSON.parse(`[${body}]`) as unknown;
    if (Array.isArray(arr)) messages = arr.filter((x): x is string => typeof x === "string");
  } catch {
    messages = [...body.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => unq(x[1]));
    // 중간에 끊긴 마지막 말풍선 ("두번째 말… 처럼 닫는 따옴표가 없음)
    const tail = /"((?:[^"\\]|\\.)*)$/.exec(body.replace(/"((?:[^"\\]|\\.)*)"/g, ""));
    if (tail && tail[1].trim().length > 1) messages.push(unq(tail[1]));
  }
  messages = messages.map((x) => x.trim()).filter(Boolean);
  if (!messages.length) return null;
  const out: Record<string, unknown> = { messages };
  for (const k of ["reaction", "tapback", "media_action", "album_id", "custom_request", "custom_kind", "seen"]) {
    const v = new RegExp(`"${k}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(text);
    if (v) out[k] = unq(v[1]);
  }
  const d = /"affection_delta"\s*:\s*(-?\d+(?:\.\d+)?)/.exec(text);
  if (d) out.affection_delta = Number(d[1]);
  const so = /"soothed"\s*:\s*(true|false)/.exec(text);
  if (so) out.soothed = so[1] === "true";
  return out;
}

/** JSON 이 없을 때: 글을 말풍선(최대 5개)으로 */
export function proseToBubbles(text: string): string[] {
  // JSON 조각이 섞여 있으면 말풍선만 건지고, 중괄호·키 이름이 그대로 화면에 나가지 않게 한다
  const fixed = repairReply(text);
  if (fixed) return (fixed.messages as string[]).slice(0, 5).map((x) => x.slice(0, 600));
  const t = text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\s*\{[\s\S]*\}\s*$/, "")
    .trim();
  if (!t) return [];
  const parts = t.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  return (parts.length ? parts : [t]).slice(0, 5).map((s) => s.slice(0, 600));
}
