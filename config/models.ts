/**
 * 🧪 주인님 모드 모델 목록 — 🛠 상태판 › 모델 탭에 나오는 선택지 (CMS 에서는 이 표를 DB 로 옮기면 된다)
 * ─────────────────────────────────────────────────────────────────────────────
 *  ▸ 새 모델을 목록에 넣으려면 아래 MODEL_CHOICES 에 한 줄 추가 → git push. (인증 키는 프로바이더별 환경변수)
 *  ▸ 목록에 없는 모델은 🛠 › 모델 › "직접 입력"에 프로바이더와 모델 ID 를 넣으면 된다 (저장 없이 즉시 적용).
 *  ▸ 서비스(일반 유저) 모델은 여기가 아니라 config/ai.ts · 환경변수 AI_MODEL 등이 정한다. 이 목록은 주인님 모드 전용 테스트용.
 *
 *  프로바이더 키: bedrock=AWS_BEDROCK_API_KEY · google=GOOGLE_GENERATIVE_AI_API_KEY · xai=XAI_API_KEY
 *  (키가 없는 프로바이더의 모델은 목록에 흐리게 표시되고 고르면 호출 시 오류 메시지가 나온다)
 */
export type ChoiceProvider = "bedrock" | "google" | "xai";

export interface ModelChoice {
  /** 목록 안에서 겹치지 않는 이름 */
  key: string;
  label: string;
  provider: ChoiceProvider;
  /** 프로바이더에 보내는 모델 ID */
  modelId: string;
  /** 한 줄 메모 (속도·가격·특징) */
  note: string;
}

export const MODEL_CHOICES: readonly ModelChoice[] = [
  { key: "grok-4.7", label: "Grok 4.7", provider: "xai", modelId: "grok-4.7", note: "xAI 최신 플래그십(2026-09). 컨텍스트 500k · $2/$6 · 기본 추론 높음이라 답이 느릴 수 있음" },
  { key: "sonnet-5", label: "Claude Sonnet 5", provider: "bedrock", modelId: "global.anthropic.claude-sonnet-5", note: "서비스 메인 모델" },
  { key: "sonnet-5-5", label: "Claude Sonnet 5.5", provider: "bedrock", modelId: "global.anthropic.claude-sonnet-5-5", note: "생각 기능을 끌 수 없어 조금 느림" },
  { key: "opus-5", label: "Claude Opus 5", provider: "bedrock", modelId: "global.anthropic.claude-opus-5", note: "가장 똑똑, 비쌈" },
  { key: "haiku-4-5", label: "Claude Haiku 4.5", provider: "bedrock", modelId: "global.anthropic.claude-haiku-4-5-20251001-v1:0", note: "가벼운 대화용 · 빠름" },
  { key: "mistral-large", label: "Mistral Large", provider: "bedrock", modelId: "mistral.mistral-large-2407-v1:0", note: "수위 규칙이 느슨한 편 (성인 모델 후보)" },
  { key: "nova-2-lite", label: "Amazon Nova 2 Lite", provider: "bedrock", modelId: "global.amazon.nova-2-lite-v1:0", note: "저렴 · 기억 정리용" },
  { key: "gemini-3-8-flash", label: "Gemini 3.8 Flash", provider: "google", modelId: "gemini-3.8-flash", note: "빠르고 똑똑" },
  { key: "gemini-3-1-pro", label: "Gemini 3.1 Pro (미리보기)", provider: "google", modelId: "gemini-3.1-pro-preview", note: "가장 똑똑하지만 느리고 비쌈" },
  { key: "gemini-3-5-flash-lite", label: "Gemini 3.5 Flash Lite", provider: "google", modelId: "gemini-3.5-flash-lite", note: "가장 저렴" },
];

export const CHOICE_PROVIDERS: readonly ChoiceProvider[] = ["bedrock", "google", "xai"];
