/**
 * 🧭 3단계 모델 라우팅 표 — 일반 대화방에서 "이번 턴을 어느 모델이 답할지" 정한다 (lib/smartRouter.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *  1단계 (비용 0원) 규칙·키워드
 *     · 성인 확인 유저 + 아래 EXPLICIT_PATTERNS 에 걸리는 말 → 분석 없이 바로 성인 모델(AI_MODEL_MATURE · Grok)
 *     · 인사·맞장구(balance.json routing.lightPatterns) → 가벼운 모델 · 고민 키워드(mainKeywords) → 감정 모델
 *  2단계 (1회 0.1원 미만) 초경량 분류 모델(ROUTER_MODEL · Nova Micro)에게 마지막 말만 주고 번호 하나만 받는다
 *  3단계 아래 ROUTE_CATEGORIES 의 tiers 순서로 답할 모델을 부른다 (실패하면 다음 → 우회 목록)
 *
 *  ✏️ 분류를 늘리려면 ROUTE_CATEGORIES 에 한 줄 추가 (번호 n 은 1부터 겹치지 않게) → 분류 지시문이 자동으로 바뀐다.
 *     tiers 에는 역할 이름(light·chat·knowledge·mature·cheap) 또는 "프로바이더:모델ID" 를 바로 넣을 수 있다.
 *     예) { n: 4, id: "coding", label: "코딩", desc: "프로그래밍·코드 질문", tiers: ["openai:gpt-5", "chat"] }
 *  켜고 끄기: config/settings.ts smartRouting (env SMART_ROUTING=off 면 예전 규칙 라우팅만)
 */
export interface RouteCategory {
  n: number;
  id: string;
  label: string;
  /** 분류 모델에게 보여 줄 설명 */
  desc: string;
  /** 답할 모델 순서 (역할 이름 또는 "프로바이더:모델ID") */
  tiers: string[];
}

export const ROUTE_CATEGORIES: readonly RouteCategory[] = [
  { n: 1, id: "daily", label: "일상·농담", desc: "인사, 근황, 잡담, 농담, 가벼운 리액션", tiers: ["light", "cheap", "chat"] },
  { n: 2, id: "emotion", label: "감정·상담·연애", desc: "고민, 속마음, 위로가 필요한 말, 연애·관계 이야기, 진지한 대화", tiers: ["chat"] },
  { n: 3, id: "knowledge", label: "전문지식·정보", desc: "과학, 역사, 건강, 취미, 뉴스, 사실 확인처럼 정확한 정보가 필요한 질문", tiers: ["knowledge", "chat"] },
];

/** 1단계: 이런 감정 단어가 있으면 분류 없이 바로 "감정·상담" (비용 0) */
export const EMOTION_PATTERN = "힘들|힘드|슬퍼|슬프|우울|외로|고민|불안|무서|짜증|화나|화가|울고|울었|눈물|헤어지|헤어졌|보고\\s*싶|사랑해|좋아해|미안해|죽고\\s*싶|지쳤|지친다|속상";

/** 분류를 못 했을 때 쓰는 분류 */
export const DEFAULT_CATEGORY = "emotion";

/**
 * 1단계 직행 키워드 (성인 확인 유저만) — 욕설·신체 부위·직설적인 성적 표현.
 * 정규식 문자열. 대소문자 무시. ✏️ 운영하며 늘리거나 줄이면 된다.
 */
export const EXPLICIT_PATTERNS: readonly string[] = [
  "씨발|시발|ㅅㅂ|병신|ㅂㅅ|좆|존나|개새",
  "가슴|엉덩이|허벅지|젖|유두|성기|거기\\s*만져",
  "섹스|sex|야한\\s*거|벗어|벗겨|알몸|나체|키스\\s*해|잠자리|침대에서|흥분돼|섹시",
];

/**
 * 🔓 단계별 개방 (일반 대화방 · 매혹 모드가 아닐 때 · 성인 확인 유저)
 *  · 초반 체험: 성인 모델이 아직 trialTurns 번 미만으로 답했으면, 대화마다 trialChance 확률로 성인 모델이 답한다
 *    (수위 규칙은 일반 정책 그대로 — 모델의 자유로운 말맛만 체험)
 *  · 관계 단계(알아가는 중 → 특별한 사이)가 오를수록 chanceByStage 확률로 성인 모델이 답한다
 *  · 마지막 단계에서 내용에 따른 자유로운 수위는 매혹 모드에서만 (balance.json allureRouting)
 */
export const FREEDOM = {
  trialTurns: 3,
  trialChance: 0.35,
  chanceByStage: [0, 0.1, 0.22, 0.4],
} as const;

/** 2단계 분류 모델에게 주는 지시문 (자동 생성) */
export function classifierPrompt(): string {
  return `너는 메신저 대화 분류기다. 유저의 마지막 말이 아래 중 무엇인지 번호 하나만 출력해라. 다른 글자는 쓰지 마라.
${ROUTE_CATEGORIES.map((c) => `${c.n}. ${c.label}: ${c.desc}`).join("\n")}`;
}

/**
 * 매혹 모드가 아닌 일반 대화를 성인 모델(Grok)로 넘길지 (2026-10-14: 끔).
 *  false → 분위기 라우팅·직설 키워드·단계별 개방·회상 연속 라우팅이 모두 꺼지고, 일반 대화는 분석 등급(L·M·P·T)으로만 정해진다.
 *  매혹 모드 안에서의 성인 모델 배분(balance.json allureRouting)과 인물 설정 modelRoute:"mature", 치트룸은 그대로.
 */
export const MATURE_OUTSIDE_ALLURE = false;

/** 매혹 모드에서 성인 모델(Grok)로 답하기 시작하는 호감도 (이 미만은 일반 대화처럼 등급 라우팅 L·M·P·T) */
export const ALLURE_MATURE_MIN_AFFECTION = 70;
