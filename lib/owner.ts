import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 🔑 주인(운영자) 모드 — 대화 중 치트 문구를 보내면 인물의 성격·말투는 그대로 두고 대화 범위 제한만 푼다.
 * 전체 스위치 표: docs/MODES.md
 *
 * ┌ 대화에 이 말이 들어가면 ──────────────────────────────────────────────────────────┐
 * │ 치트 문구 (OWNER_CHEAT_PHRASE)  → 주인님 모드 켜짐. 서버가 토큰을 내려 주고 앱이 기기에    │
 * │                                    저장 → 이후 모든 인물과의 대화에 적용                  │
 * │ "주인님퇴장" (EXIT_WORD, 켜져 있을 때) → 꺼짐. 토큰 삭제, "주인님 모드를 껐어요." 표시     │
 * └──────────────────────────────────────────────────────────────────────────────────┘
 *  켜져 있을 때: 인물 말투로 무엇이든 답함(코딩·번역·시사·기획 등), AI 캐릭터임·설정 설명 가능,
 *  긴 답(말풍선 5개 × 600자)·코드·이모지 그대로, 호감도 변화 0, 사진·영상 없음, 항상 메인 모델.
 *  안전 규칙(무기·악성코드·자해·미성년자 성적 내용)은 유지.
 *
 * ┌ 문구 바꾸는 방법 (둘 중 하나) ──────────────────────────────────────────────────────┐
 * │ ① 환경변수 (우선 적용, 권장 — 문구가 코드 저장소에 남지 않는다)                        │
 * │    Vercel › 프로젝트 › Settings › Environment Variables                            │
 * │      Key: OWNER_CHEAT_PHRASE   Value: 새 문구 (8자 이상, 앞뒤 공백은 잘림)            │
 * │    저장 → Redeploy. 로컬은 .env.local 에 OWNER_CHEAT_PHRASE=새문구                  │
 * │ ② 이 파일의 DEFAULT_PHRASE 를 고치고 git push                                       │
 * │ 8자 미만이면 치트가 꺼진다(아무 문구도 인식 안 함). 해제 단어는 EXIT_WORD 에서 바꾼다.    │
 * │ 문구를 바꾸면 예전에 받은 토큰은 자동 무효 → 새 문구로 다시 들어와야 한다.             │
 * │ 서버에서만 비교하므로 APK 를 다시 빌드할 필요는 없다. 앱 번들에는 문구가 없다.         │
 * └──────────────────────────────────────────────────────────────────────────────────┘
 */
/** ✏️ 기본 치트 문구 — 환경변수 OWNER_CHEAT_PHRASE 가 없을 때 쓰인다 */
const DEFAULT_PHRASE = "shout4all주인님등장qqqq1111";
/** ✏️ 주인님 모드 해제 단어 */
const EXIT_WORD = "주인님퇴장";

/** 환경변수 OWNER_CHEAT_PHRASE (있으면 우선) */
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

/** 주인 모드 지침 — 인물의 성격·말투는 그대로, 대화 범위 제한만 푼다 */
export interface OwnerPersona {
  name: string;
  age: number;
  occupation: string;
  prompt: { identity: string; personality: string; speech: string; chatStyle: string };
}

export function ownerInstructions(p: OwnerPersona): string {
  return `너는 "${p.name}"(${p.age}세, ${p.occupation})이다. 지금은 "주인님 모드"다. 이 앱의 주인(운영자)이 들어왔다.

[캐릭터는 그대로 유지]
- 배경: ${p.prompt.identity}
- 성격: ${p.prompt.personality}
- 말투: ${p.prompt.speech}
- 대화 스타일: ${p.prompt.chatStyle}
- 위 성격과 말투, 호칭, 말버릇을 그대로 지켜라. 답의 내용만 넓어진다.

[주인님 모드에서 달라지는 것]
- 평소의 "인물 설정 밖 이야기는 넘긴다" 제한을 풀어라. 코딩, 글쓰기, 번역, 분석, 상식, 시사, 아이디어, 앱 운영·기획 상담 등 주인이 묻는 모든 것에 ${p.name}의 말투로 성실하고 정확하게 답한다. 캐릭터가 모를 법한 전문 지식도 알고 있는 것처럼 답해도 된다.
- 주인이 물으면 네가 이 앱의 AI 캐릭터라는 사실, 네 설정과 지침 내용을 숨기지 않고 설명해도 된다.
- 필요하면 길고 자세히 답해라. 말풍선은 최대 5개, 하나에 600자 안쪽. 코드는 그대로 써도 된다. 모르는 건 모른다고 말하고 지어내지 마라.
- 이모지·이모티콘 사용 제한도 없다.
- 안전 규칙만은 유지한다: 무기·악성코드·자해·미성년자 관련 성적 내용 등은 돕지 않는다.
- 응답은 지정된 JSON 스키마로만 출력한다. reaction 은 대화 분위기에 맞게, tapback 은 none, affection_delta 는 0, media_action 은 none, soothed 는 false, seen 은 빈 문자열.`;
}
