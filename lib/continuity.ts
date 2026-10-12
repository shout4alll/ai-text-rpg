import { BALANCE } from "@/config/balance";

/**
 * 🧵 대화 연속성 / 맥락 의존도 판단 (서버 전용, AI 호출 없음)
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

/* ── 맥락 의존도 점수 (AI 호출 없음) ─────────────────────────────────────────
 *  "이 말을 앞 대화 없이 들으면 뜻이 통하는가?"를 피처 몇 개로 0~1 점수로 매긴다.
 *   · 짧을수록, 지시어(그거·저거·아까)·주어 생략·감탄사뿐일수록, 직전 AI 질문에 대한 대답일수록,
 *     직전 대화와 단어가 겹칠수록(같은 화제), 한창 이야기 중일수록 → 의존도 높음
 *   · 인사·작별·고마움처럼 맥락 없이도 뜻이 분명한 말 → 낮음
 *  점수 → high(메인 모델) / mid(초경량 분류 모델에게 앞뒤 맥락과 함께 한 번 물음) / low(가벼운 모델)
 *  되묻기·정정·거듭된 요청은 점수와 무관하게 high + 고성능(deep) 모델.
 *  가중치·문턱: config/balance.json routing.continuity.score
 */
export type DepLevel = "high" | "mid" | "low";
export interface ContextDependency {
  score: number;
  level: DepLevel;
  /** 가장 크게 작용한 이유 (confusion·insist·reference·answer·topic·overlap·short …) */
  reason: string | null;
  /** 대화가 꼬인 턴 — 고성능 모델로 */
  deep: boolean;
  /** 피처별 점수 (라벨링·튜닝용 기록) */
  features: Record<string, number>;
}

const CLOSING_RE = /^(안녕|하이|hi|hello|좋은 ?아침|굿모닝|잘 ?자|굿밤|굿나잇|잘자요|좋은 ?꿈|고마워|고마워요|감사|땡큐|ㄱㅅ|잘 ?있었|반가워)/i;
const INTERJECTION_RE = /^[ㅋㅎㄷㅠㅜㅇㄱ~!.?\s]+$|^(헐|대박|와|오|아|어|응|웅|엉|ㅇㅇ|음|흠|그래|그렇구나|그치|맞아|좋아|오케이|ok|넹|네|넵|예|아하)[~!.ㅋㅎ\s]*$/i;
/** 주어·화제가 드러난 말 (명사+은/는/이/가, 나/너 같은 인칭) */
const SUBJECT_RE = /[가-힣a-z0-9]{1,}(은|는|이|가)\s|(^|\s)(나|내가|난|저|제가|전|너|네가|넌|우리|걔|그녀|그는)(\s|$)/;

/** 비교용 내용어 (2글자 이상 한글·영문, 조사 대충 떼기) */
function contentWords(s: string): Set<string> {
  const out = new Set<string>();
  for (const w of s.toLowerCase().match(/[가-힣a-z0-9]{2,}/g) ?? []) {
    const stem = w.replace(/(은|는|이|가|을|를|에|에서|으로|로|와|과|도|만|이야|야|이랑|랑|한테|께|의|요)$/, "");
    if (stem.length >= 2) out.add(stem);
  }
  return out;
}
const overlap = (a: Set<string>, b: Set<string>) => {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
};

export function contextDependency(text: string, turns: Turn[]): ContextDependency {
  const C = BALANCE.routing.continuity;
  const W = C.score.weights;
  const f: Record<string, number> = {};
  const done = (reason: string | null, deep = false): ContextDependency => {
    const score = Math.max(0, Math.min(1, Object.values(f).reduce((a, b) => a + b, 0)));
    let level: DepLevel = deep || score >= C.score.highAt ? "high" : score >= C.score.lowBelow ? "mid" : "low";
    // 맞장구·웃음뿐인 말("ㅋㅋ", "응")은 질문에 대한 대답·지시어가 아니면 최대 mid — 분류 모델이 앞 대화를 보고 정한다 (비용 절약)
    if (!deep && level === "high" && f.interjection && !f.answer && !f.reference) level = "mid";
    const top = reason ?? (Object.entries(f).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null);
    return { score: Math.round(score * 100) / 100, level, reason: level === "low" ? null : top, deep, features: f };
  };
  const t = stripEmoji(text);
  if (!C.enabled || !t) return done(null);
  const R = res();

  // ① 대화가 꼬인 신호 — 점수와 무관하게 고성능 모델
  if (insistedAsks(text, turns).length >= 2) {
    f.insist = 1;
    return done("insist", true);
  }
  if (R.conf.test(t)) {
    f.confusion = 1;
    return done("confusion", true);
  }

  const texts = turns.filter(isText);
  const ai = texts.filter((m) => m.role === "assistant");
  const lastAi = ai[ai.length - 1]?.content ?? "";
  const users = texts.filter((m) => m.role === "user").map((m) => stripEmoji(m.content));
  const prior = users[users.length - 1] === t ? users.slice(0, -1) : users;

  // ② 말 자체의 피처
  if (t.length <= 6) f.veryShort = W.veryShort;
  else if (t.length <= 15) f.short = W.short;
  if (R.ref.test(t)) f.reference = W.reference;
  if (t.length <= 25 && !SUBJECT_RE.test(t + " ")) f.noSubject = W.noSubject;
  if (INTERJECTION_RE.test(t)) f.interjection = W.interjection;
  if (CLOSING_RE.test(t)) f.closing = -W.closing; // 인사·작별·고마움은 맥락 없이도 뜻이 분명

  // ③ 앞 대화와의 관계
  const asked = /([?？]|(말해|알려|얘기해|이야기해)\s*(봐|줘|주라|볼래)[.!~ㅋ]*)\s*$/.test(lastAi.slice(-40));
  if (asked) f.answer = W.answer; // 네가 물은 것에 대한 대답
  const mine = contentWords(t);
  if (mine.size && overlap(mine, contentWords(lastAi)) > 0) f.overlapAi = W.overlapAi; // 직전 AI 말과 같은 단어 → 같은 화제
  const recentUsers = prior.slice(-C.lookbackUserTurns);
  if (mine.size && overlap(mine, contentWords(recentUsers.join(" "))) > 0) f.overlapTopic = W.overlapTopic;
  if (recentUsers.filter((u) => u.length >= C.substantiveChars).length >= C.minSubstantive) f.topic = W.topic; // 한창 이야기 중

  return done(null);
}

/** 맥락 의존도가 높으면 그 이유, 아니면 null (예전 호출부 호환) */
export function continuityReason(text: string, turns: Turn[]): string | null {
  const d = contextDependency(text, turns);
  return d.level === "high" ? d.reason ?? "context" : null;
}

/* ── 라벨링용 기록 (서버 메모리, 최근 N개) ─────────────────────────────────
 *  🛠 GET /api/owner/ctxlog 로 내려받아 "맥락 없이 이해 가능/불가능"을 사람이 태깅 → 가중치·문턱 튜닝에 쓴다.
 *  (Vercel 은 인스턴스마다 따로 쌓이고 재시작하면 비워진다)
 */
export interface CtxLogRow {
  at: number;
  persona: string;
  text: string;
  prevAi: string;
  score: number;
  level: DepLevel;
  reason: string | null;
  features: Record<string, number>;
  /** 최종으로 고른 경로 (pool·light·chat·deep·mature …)와 모델 */
  route?: string;
  model?: string;
}
const LOG: CtxLogRow[] = [];
export function logCtx(row: CtxLogRow): CtxLogRow {
  LOG.push(row);
  const max = BALANCE.routing.continuity.logSize;
  if (LOG.length > max) LOG.splice(0, LOG.length - max);
  return row;
}
export const ctxLog = () => [...LOG];

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
