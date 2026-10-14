/**
 * 💬 답장 분량을 매 턴 정한다.
 *
 * 모델에게 "0~3개"라고만 하면 거의 매번 3개를 채우기 때문에, 서버가 이번 턴의 분량을 골라 지침(buildTurnContext)에 넣는다.
 *  · 기본은 짧게(1~2개). 긴 답은 "긴 답이 어울리는 턴"에만 나온다 — 쓸데없이 길면 맥락이 흐트러진다.
 *  · 긴 답이 어울리는 턴: 분석 모델이 L(길게)로 판단 / 유저가 길게 털어놓음 / 설명·추천·방법을 묻는 질문 / 고민·감정 이야기
 *  · 분석 모델이 S(짧게)로 판단하면 짧은 분량만.
 *  · 지침은 "기준"이다: 이번 말에 맞지 않으면 모델이 더 짧게 해도 된다.
 */
import type { ReplyLen } from "@/lib/smartRouter";
import { EMOTION_PATTERN } from "@/config/routing";

export type LengthModeId = "tiny" | "short" | "two" | "burst" | "long" | "story";

interface LengthMode {
  id: LengthModeId;
  weight: number;
  guide: string;
}

const MODES: LengthMode[] = [
  { id: "tiny", weight: 18, guide: "아주 짧게: 말풍선 1개, 한 문장 안쪽. 한마디 반응이나 짧은 대답이면 충분하다." },
  { id: "short", weight: 34, guide: "짧게: 말풍선 1개, 1~2문장." },
  { id: "two", weight: 28, guide: "말풍선 2개: 각각 짧게. 반응 한 번, 이어서 한마디." },
  { id: "burst", weight: 8, guide: "신나서 연달아: 말풍선 3개를 톡톡 보내듯 한 문장씩 짧게 끊어서." },
  { id: "long", weight: 10, guide: "길게: 말풍선 1~2개에 3~5문장씩, 지금 이야기에 대한 네 생각·설명을 충분히 풀어서." },
  { id: "story", weight: 4, guide: "하고 싶은 말이 많다: 말풍선 3~4개로 이어서 말한다. 단, 지금 나누는 주제 안에서만 — 새 화제로 새지 마라." },
];

const EXPLAIN_RE = /추천|알려|어떻게|왜|설명|방법|무슨\s*뜻|이유|어떤\s*게|얘기\s*해\s*줘|들려\s*줘|뭐가\s*좋/;
const EMOTION_RE = new RegExp(EMOTION_PATTERN);

/** 이번 턴에 어울리는 모드별 가중치 배수 */
function tilt(userText: string, hint?: ReplyLen): Record<LengthModeId, number> {
  const len = userText.replace(/\s+/g, "").length;
  const w: Record<LengthModeId, number> = { tiny: 1, short: 1, two: 1, burst: 1, long: 0, story: 0 };
  const needLong = hint === "L" || len >= 50 || EXPLAIN_RE.test(userText) || (len >= 15 && EMOTION_RE.test(userText));

  if (hint === "S") return { tiny: 1.6, short: 1.3, two: 0.7, burst: 0.3, long: 0, story: 0 };
  if (len <= 4) {
    // "ㅇㅇ", "ㅋㅋ", "응" 같은 짧은 말
    w.tiny = 2;
    w.short = 1.5;
    w.burst = 0.5;
  }
  if (needLong) {
    w.tiny = 0.2;
    w.short = 0.6;
    w.long = hint === "L" || len >= 50 ? 3 : 2;
    w.story = hint === "L" && len >= 50 ? 2 : len >= 80 ? 1.5 : 0.5;
  }
  return w;
}

/** 이번 턴 분량 지침 한 줄 (프롬프트에 그대로 넣는다). hint = 분석 모델이 판단한 분량 */
export function pickLengthGuide(userText: string, hint?: ReplyLen, rng: () => number = Math.random): { id: LengthModeId; line: string } {
  const w = tilt(userText, hint);
  const total = MODES.reduce((s, m) => s + m.weight * w[m.id], 0);
  let r = rng() * total;
  let chosen = MODES[1];
  for (const m of MODES) {
    r -= m.weight * w[m.id];
    if (r <= 0) {
      chosen = m;
      break;
    }
  }
  return {
    id: chosen.id,
    line: `- 이번 턴 분량 기준: ${chosen.guide} (기준일 뿐이다. 이번 말에 긴 답이 어울리지 않으면 더 짧게 해라. 분량을 채우려고 새 화제를 꺼내거나 말을 늘이지 마라.)`,
  };
}
