/**
 * 🧪 주인님 모드 모델 목록 — 🛠 상태판 › 모델 탭에 나오는 선택지 (CMS 에서는 이 표를 DB 로 옮기면 된다)
 * ─────────────────────────────────────────────────────────────────────────────
 *  ▸ 새 모델을 목록에 넣으려면 아래 MODEL_CHOICES 에 한 줄 추가 → git push. (인증 키는 프로바이더별 환경변수)
 *  ▸ 목록에 없는 모델은 🛠 › 모델 › "직접 입력"에 프로바이더와 모델 ID 를 넣으면 된다 (저장 없이 즉시 적용).
 *  ▸ 서비스(일반 유저) 모델은 여기가 아니라 config/ai.ts · 환경변수 AI_MODEL 등이 정한다. 이 목록은 주인님 모드 전용 테스트용.
 *
 *  Llama(Meta)는 Bedrock 에서 부르므로 bedrock 키·리전을 쓴다 (us. 프로파일은 미국 리전 us-east-1/us-west-2 에서만 호출 가능).
 *  프로바이더 키: bedrock=AWS_BEDROCK_API_KEY · google=GOOGLE_GENERATIVE_AI_API_KEY · xai=XAI_API_KEY
 *  (키가 없는 프로바이더의 모델은 목록에 흐리게 표시되고 고르면 호출 시 오류 메시지가 나온다)
 */
export type ChoiceProvider = "bedrock" | "google" | "xai" | "openai" | "mantle";

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
  { key: "grok-4.3-mantle", label: "Grok 4.3 (Bedrock · 빠름)", provider: "mantle", modelId: "xai.grok-4.3", note: "✅ 성인 모델 기본값 · Bedrock 키로 호출(Mantle 주소, 미국 리전) · $1.25/$2.50 · 추론 low(MANTLE_REASONING_EFFORT 로 none 까지)" },
  { key: "grok-4.7-bedrock", label: "Grok 4.7 (Bedrock · 이전)", provider: "bedrock", modelId: "global.xai.grok-4.7", note: "Bedrock 로 호출 — AWS_BEDROCK_API_KEY 만 있으면 됨(XAI 키 불필요). 어느 리전에서든 global 프로파일로 호출. 추론 기본값 높음 → 느릴 수 있음" },
  { key: "grok-4.7", label: "Grok 4.7 (xAI 직접)", provider: "xai", modelId: "grok-4.7", note: "xAI 최신 플래그십(2026-09). 컨텍스트 500k · $2/$6 · 기본 추론 높음이라 답이 느릴 수 있음" },
  { key: "sonnet-5", label: "Claude Sonnet 5", provider: "bedrock", modelId: "global.anthropic.claude-sonnet-5", note: "서비스 메인 모델" },
  { key: "sonnet-5-5", label: "Claude Sonnet 5.5", provider: "bedrock", modelId: "global.anthropic.claude-sonnet-5-5", note: "생각 기능을 끌 수 없어 조금 느림" },
  { key: "opus-5", label: "Claude Opus 5", provider: "bedrock", modelId: "global.anthropic.claude-opus-5", note: "가장 똑똑, 비쌈" },
  { key: "haiku-4-5", label: "Claude Haiku 4.5", provider: "bedrock", modelId: "global.anthropic.claude-haiku-4-5-20251001-v1:0", note: "가벼운 대화용 · 빠름" },
  { key: "mistral-large", label: "Mistral Large", provider: "bedrock", modelId: "mistral.mistral-large-2407-v1:0", note: "⚠️ 이 ID(2407)는 단종·리전 제한으로 \"model identifier is invalid\" 가 날 수 있음 — Bedrock 콘솔에 보이는 최신 Mistral ID 를 \"직접 입력\"으로 시험" },
  { key: "llama4-maverick", label: "Meta Llama 4 Maverick", provider: "bedrock", modelId: "us.meta.llama4-maverick-17b-instruct-v1:0", note: "Meta 최신급 · 수위 규칙이 느슨한 편(성인 모델 후보) · 미국 리전 프로파일(us.)" },
  { key: "llama4-scout", label: "Meta Llama 4 Scout", provider: "bedrock", modelId: "us.meta.llama4-scout-17b-instruct-v1:0", note: "Llama 4 경량 · 빠르고 저렴 (가벼운 대화 후보)" },
  { key: "llama3-3-70b", label: "Meta Llama 3.3 70B", provider: "bedrock", modelId: "us.meta.llama3-3-70b-instruct-v1:0", note: "안정적인 70B · 한국어 보통" },
  { key: "llama3-1-405b", label: "Meta Llama 3.1 405B", provider: "bedrock", modelId: "meta.llama3-1-405b-instruct-v1:0", note: "가장 큼 · 일부 리전(us-west-2)만, 느리고 비쌈" },
  { key: "gpt-oss-120b", label: "GPT (gpt-oss 120B · Bedrock)", provider: "bedrock", modelId: "openai.gpt-oss-120b-1:0", note: "OpenAI 오픈웨이트 · Bedrock 키만으로 호출 (우회 모델 기본값)" },
  { key: "gpt-5", label: "GPT-5 (OpenAI 직접)", provider: "openai", modelId: "gpt-5", note: "OPENAI_API_KEY 필요 · 모델 ID 는 직접 입력으로 바꿔 시험" },
  { key: "nova-2-lite", label: "Amazon Nova 2 Lite", provider: "bedrock", modelId: "global.amazon.nova-2-lite-v1:0", note: "저렴 · 기억 정리용" },
  { key: "gemini-3-8-flash", label: "Gemini 3.8 Flash", provider: "google", modelId: "gemini-3.8-flash", note: "빠르고 똑똑" },
  { key: "gemini-3-1-pro", label: "Gemini 3.1 Pro (미리보기)", provider: "google", modelId: "gemini-3.1-pro-preview", note: "가장 똑똑하지만 느리고 비쌈" },
  { key: "gemini-3-5-flash-lite", label: "Gemini 3.5 Flash Lite", provider: "google", modelId: "gemini-3.5-flash-lite", note: "가장 저렴" },
];

export const CHOICE_PROVIDERS: readonly ChoiceProvider[] = ["bedrock", "mantle", "google", "xai", "openai"];
