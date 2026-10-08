import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 🔑 주인(운영자) 모드 — 대화 중 특정 문구를 보내면 인물 연기를 벗고 범용 AI 로 답한다.
 *
 * - 문구는 서버에서만 비교한다 (앱·화면 코드에는 들어 있지 않다). 환경변수 OWNER_CHEAT_PHRASE 로 바꿀 수 있다.
 * - 문구가 맞으면 서버가 토큰(HMAC)을 돌려주고, 앱은 이 기기에 저장해 두었다가 이후 요청에 붙인다. 토큰은 문구 없이는 만들 수 없다.
 * - ⚠️ 출시 전에는 반드시 환경변수로 문구를 바꾸고, 이 파일의 기본값은 비워 두는 것을 권장한다. (docs/OWNER_MODE.md)
 */
const DEFAULT_PHRASE = "shout4all주인님등장qqqq1111";
const EXIT_WORD = "주인님퇴장";

const phrase = () => (process.env.OWNER_CHEAT_PHRASE ?? DEFAULT_PHRASE).trim();

export const containsPhrase = (text: string): boolean => {
  const p = phrase();
  return p.length >= 8 && text.includes(p);
};

export const wantsExit = (text: string): boolean => text.includes(EXIT_WORD);

/** 문구를 가린 대화 기록 (모델에게 문구가 새지 않게) */
export const maskPhrase = (text: string): string => {
  const p = phrase();
  return p.length >= 8 ? text.split(p).join("[주인 인증]") : text;
};

export const ownerToken = (): string => createHmac("sha256", phrase()).update("owner-mode-v1").digest("hex");

export const isOwnerToken = (t: unknown): boolean => {
  if (typeof t !== "string" || t.length !== 64) return false;
  try {
    return timingSafeEqual(Buffer.from(t), Buffer.from(ownerToken()));
  } catch {
    return false;
  }
};

/** 주인 모드 지침 — 인물 설정 대신 쓰인다 */
export const OWNER_INSTRUCTIONS = `너는 지금 "주인님 모드"다. 이 앱의 주인(운영자)과 대화하고 있고, 앱의 인물 역할극은 잠시 내려놓는다.
- 인물 이름·말투·설정으로 답하지 말고, 평소의 유능하고 친절한 AI 어시스턴트로서 유저가 묻는 모든 것(코딩, 글쓰기, 번역, 분석, 상식, 아이디어, 앱 운영 상담 등)에 성실하고 정확하게 답해라.
- 한국어 존댓말로, 군더더기 없이. 필요하면 길고 자세히 설명해도 된다. 길면 말풍선을 최대 5개로 나눠라(말풍선 하나는 600자 안쪽).
- 코드가 필요하면 코드 그대로 써도 된다. 모르는 건 모른다고 말하고, 지어내지 마라.
- 안전 규칙은 그대로 유지한다: 위험하거나 불법적인 일(무기·악성코드·자해·아동 관련 등)은 돕지 않는다.
- 응답은 지정된 JSON 스키마로만 출력한다. reaction 은 smile, tapback 은 none, affection_delta 는 0, media_action 은 none, soothed 는 false, seen 은 빈 문자열.`;
