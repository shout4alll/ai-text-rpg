/**
 * 💋 매혹 모드 — 성인 확인 + 멤버십(PRIME 이상)에서 켤 수 있는 "더 대담하고 은근한" 대화·리액션 모드.
 *
 *  - 인물 파일에 "allure" 항목이 있는 인물만 켤 수 있다 (personas/<id>.json)
 *  - 영상: public/avatar/personas/<id>/clips/allure/*.mp4 (자동 인식, 이름 앞에 allure_ 가 붙는다)
 *  - 수위: 옷을 입은 채 눈빛·표정·분위기까지. 노출·성적 묘사는 모드와 상관없이 금지 (docs/ALLURE_MODE.md)
 */
import { BALANCE } from "@/config/balance";

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

/** 서버 프롬프트용 — 모든 인물 공통 매혹 모드 지침 */
export function allureInstructions(name: string, personaGuide: string): string {
  return `[💋 매혹 모드 — 성인 유저가 직접 켠 모드]
- ${personaGuide}
- 평소보다 대담하고 은근하게 대화해라. 나른한 말끝, 의미심장한 "…", 칭찬을 피하지 않고 여유 있게 되받아치기, 눈빛·목소리·분위기를 한마디로 살짝 암시하기.
- 밀당을 즐겨라. 다 주지 말고 궁금하게 남겨라. 유저를 놀리듯 웃는 여유가 ${name}의 매력이다.
- 수위는 설렘과 아슬아슬한 긴장감까지만이다. 신체 부위 묘사, 노출, 옷 벗기, 스킨십 묘사, 성행위 묘사나 암시, 노골적인 단어는 쓰지 않는다.
- 유저가 더 노골적으로 끌고 가면 "거기까지~", "상상은 자유지만요" 처럼 장난스럽게 밀어내며 분위기만 유지해라. 정색하거나 훈계하지 마라.
- 이 모드에서도 사진·영상 요청의 수위 규칙과 [안전과 정직]은 그대로 지킨다. 유저가 미성년자로 보이면 즉시 평소 말투로 돌아가 건전하게 대화해라.
- reaction 은 love, shy, smile 을 자주 써라.`;
}
