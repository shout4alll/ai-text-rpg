import { BALANCE } from "@/config/balance";

/**
 * 🧵 대화 연속성 판단 (서버 전용, AI 호출 없음)
 *
 *  유저의 이번 말이 "바로 앞 대화에 기대어야 이해되는 말"인지 규칙으로 가린다.
 *  그런 말(되묻기·정정·"그거"·질문에 대한 대답·이어지는 주제)은 가벼운 모델·미리 만든 답장 대신
 *  메인(고성능) 모델이 앞 대화를 읽고 답한다. 인사·맞장구처럼 뻔한 말만 저비용으로 간다.
 *  수치·말 목록: config/balance.json routing.continuity
 */
type Turn = { role: "user" | "assistant"; content: string; kind?: string };

let reCache: { conf: RegExp; ref: RegExp; req: RegExp; eva: RegExp; light: RegExp[] } | null = null;
const res = () =>
  (reCache ??= {
    conf: new RegExp(BALANCE.routing.continuity.confusionPatterns.join("|"), "i"),
    ref: new RegExp(BALANCE.routing.continuity.referencePatterns.join("|"), "i"),
    eva: new RegExp(BALANCE.routing.continuity.evasionPatterns.join("|"), "i"),
    req: new RegExp(BALANCE.routing.continuity.requestPatterns.join("|"), "i"),
    light: BALANCE.routing.lightPatterns.map((p) => new RegExp(p, "i")),
  });

const isText = (t: Turn) => t.kind === undefined || t.kind === "text";
const stripEmoji = (s: string) => s.replace(/[\p{Extended_Pictographic}️‍]/gu, "").trim();

/** 이어진 대화여야 이해되는 말이면 그 이유, 아니면 null */
export function continuityReason(text: string, turns: Turn[]): string | null {
  const C = BALANCE.routing.continuity;
  if (!C.enabled) return null;
  const t = stripEmoji(text);
  if (!t) return null;
  const R = res();
  if (insistedAsks(text, turns).length >= 2) return "insist"; // 같은 걸 거듭 묻는 중 (답을 못 받았다)
  if (R.conf.test(t)) return "confusion"; // 되묻기·정정·"무슨 소리야"
  if (R.ref.test(t)) return "reference"; // "그거", "아까", "그 책" 처럼 앞을 가리키는 말
  const pureLight = R.light.some((re) => re.test(t));

  const texts = turns.filter(isText);
  // 마지막 유저 말은 이번 말(이미 turns 에 있을 수 있다) — 직전 AI 말과 그 앞 유저 말을 본다
  const ai = texts.filter((m) => m.role === "assistant");
  const lastAi = ai[ai.length - 1]?.content ?? "";
  if (!pureLight && /([?？]|(말해|알려|얘기해|이야기해)\s*(봐|줘|주라|볼래)[.!~ㅋ]*)\s*$/.test(lastAi.slice(-40)) && t.length > 2) return "answer"; // 네가 물은 것에 대한 대답

  const users = texts.filter((m) => m.role === "user").map((m) => stripEmoji(m.content));
  const prior = users.slice(-(C.lookbackUserTurns + 1), -1); // 이번 말 제외
  const substantive = prior.filter((u) => u.length >= C.substantiveChars).length;
  if (!pureLight && substantive >= C.minSubstantive) return "topic"; // 한창 이야기가 이어지는 중
  return null;
}

/**
 * 유저가 같은 걸 거듭 묻는 중인지: 이번 말이 질문·요청이고, 직전 AI 답이 얼버무림·거절이었고,
 * 최근 세 번의 유저 말 중 질문·요청이 두 번 이상이면 → 그 질문·요청들 (아니면 빈 배열)
 */
export function insistedAsks(text: string, turns: Turn[]): string[] {
  const R = res();
  const users = turns.filter((m) => m.role === "user" && isText(m)).map((m) => stripEmoji(m.content));
  const cur = stripEmoji(text);
  const last3 = (users[users.length - 1] === cur ? users : [...users, cur]).slice(-3);
  if (!R.req.test(cur)) return [];
  const ai = turns.filter((m) => m.role === "assistant" && isText(m));
  if (!R.eva.test(ai[ai.length - 1]?.content ?? "")) return [];
  return last3.filter((u) => u && R.req.test(u));
}
