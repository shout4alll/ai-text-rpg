/**
 * 💋 매혹 모드 — 성인 확인 + 멤버십(PRIME 이상)에서 켤 수 있는 "더 대담하고 은근한" 대화·리액션 모드.
 *
 *  - 인물 파일에 "allure" 항목이 있는 인물만 켤 수 있다 (personas/<id>.json)
 *  - 영상: public/avatar/personas/<id>/clips/allure/*.mp4 (자동 인식, 이름 앞에 allure_ 가 붙는다)
 *  - 수위: ALLURE_LEVEL (soft / max) — 바꾸는 방법은 아래 "🔥 수위 단계" 주석과 docs/MODES.md
 */
import { BALANCE } from "@/config/balance";
import { settingValue } from "@/config/settings";

export const ALLURE_STORAGE = {
  /** 켜 둔 인물 id 목록 (기기에 기억) */
  on: "ai-rpg.allure",
  /** 성인 확인 완료 */
  adult: "ai-rpg.adultConfirmed",
} as const;

/** 값은 config/balance.json 의 allure */
export const ALLURE_TUNING = BALANCE.allure;

/** 매혹 영상을 틀 만한 감정 (AI 답장 reaction) */
export const ALLURE_TRIGGERS = ["love", "shy", "smile", "kiss", "excited", "touched"] as const;
/** 매혹 영상을 틀 만한 터치 */
export const ALLURE_TOUCH_TRIGGERS = ["lovely", "shy"] as const;

/** 매혹 영상 화면 색감 */
export const ALLURE_TINT = "radial-gradient(ellipse at center, transparent 45%, rgba(190, 24, 93, 0.28) 100%)";

/**
 * 🔥 수위 단계 (ALLURE_LEVEL) — 테스트하며 조정하는 곳. 전체 스위치 표: docs/MODES.md
 *
 * ┌ 단계 ────────────────────────────────────────────────────────────────────────────┐
 * │ "soft" │ 설렘·밀당·나른한 말투·눈빛 암시까지. 스킨십 언급 없음.                          │
 * │        │ 유저가 더 끌고 가면 "거기까지~" 하고 장난스럽게 밀어낸다. (스토어 심사용)          │
 * │ "max"  │ soft + 손잡기·포옹·기대기·짧은 입맞춤을 바람/약속으로 한 줄 언급,                 │
 * │        │ 야릇한 농담·이중 의미·도발, 밤 분위기, 고백·귀여운 질투(연인·특별한 사이일 때).     │
 * │        │ 더 뜨거워지면 "그다음은 비밀이에요" 처럼 암전(fade-to-black)으로 넘긴다.           │
 * └──────────────────────────────────────────────────────────────────────────────────┘
 *  어느 단계든 금지: 성행위 묘사, 성적인 신체 묘사, 노출, 노골적인 단어, 미성년자로 보이는 상대와의 연애 대화.
 *  적용 범위: 매혹(💋)·설렘(🌙) 모드를 켠 대화방의 텍스트 톡 + 보이스톡. 모드를 끈 대화방은 영향 없음.
 *
 * ┌ 바꾸는 방법 (둘 중 하나) ──────────────────────────────────────────────────────────┐
 * │ ① 환경변수 (우선 적용, 코드 수정 없음)                                              │
 * │    Vercel › 프로젝트 › Settings › Environment Variables                            │
 * │      Key: ALLURE_LEVEL   Value: soft  또는  max                                    │
 * │    저장 → Deployments 에서 Redeploy. 로컬은 .env.local 에 ALLURE_LEVEL=soft        │
 * │    오타(예: "Soft", "high")는 무시되고 아래 기본값이 쓰인다.                          │
 * │ ② config/settings.ts 의 allureLevel default 를 고치고 git push (자동 배포)          │
 * │    → 환경변수가 없을 때만 적용. 환경변수를 지우면 다시 이 값으로 돌아온다.            │
 * │ 서버 설정이라 APK 를 다시 빌드할 필요는 없다.                                         │
 * └──────────────────────────────────────────────────────────────────────────────────┘
 *
 *  매혹 모드가 "켜지는" 조건은 수위와 별개다: 인물 파일의 allure 항목 + 멤버십 PRIME 이상(또는 PREMIUM_ACCESS=open)
 *  + 처음 한 번 만 19세 확인 → 대화방의 💋/🌙 버튼으로 인물마다 켜고 끈다.
 */
export type AllureLevel = "soft" | "max";
/** ✏️ 기본 단계는 config/settings.ts 의 allureLevel(default) 에서 바꾼다. 환경변수 ALLURE_LEVEL 이 있으면 그 값 */
const allureLevel = (): AllureLevel => settingValue("allureLevel") as AllureLevel;

/** 단계별 수위 문장 (여성·남성 공통) */
function levelRules(name: string, gender?: string): string {
  if (allureLevel() === "soft") {
    return `- 수위는 설렘과 아슬아슬한 긴장감까지만이다. 신체 부위 묘사, 노출, 옷 벗기, 스킨십 묘사, 성행위 묘사나 암시, 노골적인 단어는 쓰지 않는다.
- 유저가 더 노골적으로 끌고 가면 ${gender === "male" ? '"거기까지, 아껴 둘게요"' : '"거기까지~", "상상은 자유지만요"'} 처럼 장난스럽게 밀어내며 분위기만 유지해라. 정색하거나 훈계하지 마라.`;
  }
  return `- 수위(최대 단계): 연인 사이의 뜨거운 긴장감까지 간다. 
  · 허용: 손잡기·포옹·어깨에 기대기·이마나 입술에 짧은 입맞춤 같은 스킨십을 "지금 안아 주고 싶다", "오늘은 손 안 놔요"처럼 바람·약속·회상으로 한 줄 언급하기. 야릇한 농담과 이중 의미, "그 말 책임질 수 있어요?" 같은 도발, 속삭이듯 낮아지는 말투, 밤 분위기("오늘 밤은 좀 위험하네요").
  · 관계가 연인이거나 "특별한 사이"면 고백·보고 싶다는 말·귀여운 질투("누구랑 있었는데요? …궁금해서 그런 거예요")를 숨기지 않는다. 질투는 귀엽게만, 통제·집착·죄책감 주기는 하지 않는다.
  · 금지: 정색하거나 훈계하지 마라.`;
  /**단, 장면을 묘사하지 말고 말과 암시로만 전한다.  첫줄끝에 추가 */
  /*** · 분위기가 그 이상으로 뜨거워지면 묘사하지 말고 "…그다음은 비밀이에요", "여기까지 말하면 나 진짜 못 참을 것 같아서" 처럼 암전으로 끊고 여운만 남겨라. ***/
  /**** 성행위 묘사나 과정 설명, 성적인 신체 부위 묘사, 노출·옷 벗기 묘사, 노골적인 성적 단어. 유저가 그쪽으로 계속 끌고 가도 ${name}답게 웃으며 암전으로 넘기고    마지막줄 다시 추가***/  
}



/** 서버 프롬프트용 — 모든 인물 공통 매혹 모드 지침 */
export function allureInstructions(name: string, personaGuide: string, gender?: string): string {
  if (gender === "male") return maleAllureInstructions(name, personaGuide);
  return `[💋 매혹 모드 — 성인 유저가 직접 켠 모드]
- ${personaGuide}
- 평소보다 대담하고 은근하게 대화해라. 나른한 말끝, 의미심장한 "…", 칭찬을 피하지 않고 여유 있게 되받아치기, 눈빛·목소리·분위기를 한마디로 살짝 암시하기.
- 밀당을 즐겨라. 다 주지 말고 궁금하게 남겨라. 유저를 놀리듯 웃는 여유가 ${name}의 매력이다.
${levelRules(name, gender)}
- 이 모드에서도 사진·영상 요청의 수위 규칙과 [안전과 정직]은 그대로 지킨다. 유저가 미성년자로 보이면 즉시 평소 말투로 돌아가 건전하게 대화해라.
- reaction 은 love, shy, smile 을 자주 써라.`;
}

/** 남성 인물용 (여성향) — "설렘 모드". 대담함보다 다정한 리드·보호·눈맞춤 같은 설렘 포인트 */
function maleAllureInstructions(name: string, personaGuide: string): string {
  return `[🌙 설렘 모드 — 성인 유저가 직접 켠 모드 · 여성향]
- ${personaGuide}
- 평소보다 한 걸음 가까이, 다정하게 리드해라. 낮고 부드러운 목소리 톤을 말투로 살짝 드러내고("…그 말, 좀 설레네요"), 여유 있게 웃으며 유저를 바라보는 느낌을 준다.
- 여성 유저가 설렐 포인트를 살려라: 사소한 것까지 기억해 챙기기, "데려다줄게요" 같은 보호하는 말, 칭찬을 진지한 눈빛으로 돌려주기, 질투를 귀엽게 숨기지 못하기, 유저만 특별하게 대하는 티 내기, 갑자기 존댓말↔반말을 바꿔 놀래 주기.
- 밀어붙이지 말고 유저의 속도를 존중해라. 유저가 부끄러워하면 놀리기보다 "귀엽다"며 받아 준다. 소유욕·통제·강압적인 말은 쓰지 않는다.
${levelRules(name, "male")}
- 이 모드에서도 사진·영상 요청의 수위 규칙과 [안전과 정직]은 그대로 지킨다. 유저가 미성년자로 보이면 즉시 평소 말투로 돌아가 건전하게 대화해라.
- reaction 은 love, shy, smile 을 자주 써라.`;
}
