/**
 * 💬 답장 분량을 매 턴 랜덤으로 정한다.
 *
 * 모델에게 "0~3개"라고만 하면 거의 매번 3개를 채우기 때문에,
 * 서버가 이번 턴의 분량을 무작위로 골라 지침(buildTurnContext)에 넣는다.
 * 유저가 짧게 보냈으면 짧은 답이, 길게 털어놓았으면 긴 답이 나오기 쉽게 가중치를 조정한다.
 */

export type LengthModeId = "tiny" | "short" | "two" | "burst" | "long" | "ramble";

interface LengthMode {
  id: LengthModeId;
  weight: number;
  guide: string;
}

const MODES: LengthMode[] = [
  { id: "tiny", weight: 12, guide: "이번엔 아주 짧게: 말풍선 1개, 한 문장 안쪽. 한마디 반응이나 짧은 대답이면 충분하다." },
  { id: "short", weight: 28, guide: "이번엔 짧게: 말풍선 1개, 1~2문장." },
  { id: "two", weight: 24, guide: "이번엔 말풍선 2개: 각각 짧게. 반응 한 번, 이어서 한마디." },
  { id: "burst", weight: 14, guide: "이번엔 신나서 연달아: 말풍선 3~4개를 톡톡 보내듯 한 문장씩 짧게 끊어서." },
  { id: "long", weight: 14, guide: "이번엔 길게: 말풍선 1~2개에 3~5문장씩, 네 생각이나 이야기를 충분히 풀어서 말한다." },
  { id: "ramble", weight: 8, guide: "이번엔 하고 싶은 말이 많다: 말풍선 4~5개로 이어서 계속 말한다. 화제가 이어지거나 살짝 샛길로 빠져도 자연스럽다." },
];

/** 유저 글자 수(공백 제외)에 따라 가중치를 기울인다 */
function tilt(userLen: number, hasQuestion: boolean): Record<LengthModeId, number> {
  const w: Record<LengthModeId, number> = { tiny: 1, short: 1, two: 1, burst: 1, long: 1, ramble: 1 };
  if (userLen <= 4) {
    // "ㅇㅇ", "ㅋㅋ", "응" 같은 짧은 말
    w.tiny = 2;
    w.short = 1.5;
    w.long = 0.3;
    w.ramble = 0.2;
  } else if (userLen <= 14) {
    w.long = 0.7;
    w.ramble = 0.6;
  } else if (userLen >= 50) {
    // 길게 털어놓았거나 이야기를 들려줬을 때
    w.tiny = 0.3;
    w.short = 0.7;
    w.long = 2.5;
    w.ramble = 2;
    w.burst = 1.3;
  }
  if (hasQuestion) {
    w.tiny *= 0.6;
    w.long *= 1.3;
  }
  return w;
}

/** 이번 턴 분량 지침 한 줄 (프롬프트에 그대로 넣는다) */
export function pickLengthGuide(userText: string, rng: () => number = Math.random): { id: LengthModeId; line: string } {
  const len = userText.replace(/\s+/g, "").length;
  const w = tilt(len, /[?？]|뭐|어때|왜|어디|언제|누구|어떻게/.test(userText));
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
  return { id: chosen.id, line: `- 이번 턴 분량: ${chosen.guide} (이 분량은 시스템이 정한 것이니 그대로 따르되, 내용이 부자연스러울 만큼 억지로 늘리거나 자르지는 마라.)` };
}
