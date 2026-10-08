# AI 프로바이더 / 모델 바꾸기

모든 설정은 **`config/ai.ts` 한 파일**에 있습니다. (서버 전용)

| 하고 싶은 것 | 방법 |
| --- | --- |
| 프로바이더 바꾸기 | `ACTIVE_PROVIDER` 값을 수정 (또는 환경변수 `AI_PROVIDER`) |
| 모델 바꾸기 | 해당 프로바이더 블록의 `model:` 줄 중 하나만 주석 해제 (또는 `AI_MODEL`) |
| OpenAI / Anthropic 직접 API 쓰기 | 파일 상단 import 줄 + `PROVIDERS` 안의 블록 주석 해제 → API 키 추가 |

우선순위: 환경변수(`AI_PROVIDER`, `AI_MODEL`) > `config/ai.ts`

## 현재 상태

| 프로바이더 | 상태 | 기본 모델 | 필요한 환경변수 |
| --- | --- | --- | --- |
| Amazon Bedrock | **활성** | `amazon.nova-lite-v1:0` | `AWS_BEDROCK_API_KEY`, `BEDROCK_REGION`(권장) |
| Google Gemini | 대기 (`AI_PROVIDER=google`로 즉시 전환) | `gemini-flash-latest` | `GOOGLE_GENERATIVE_AI_API_KEY` |
| OpenAI | 주석 처리 | `gpt-4o-mini` | `OPENAI_API_KEY` |
| Anthropic | 주석 처리 | `claude-haiku-4-5` | `ANTHROPIC_API_KEY` |

## Bedrock 주의사항

- **모델 액세스:** AWS 콘솔 → Bedrock → Model access에서 쓰려는 모델을 계정에 활성화해야 합니다.
- **Claude 3.5 Sonnet v1 (`anthropic.claude-3-5-sonnet-20240620-v1:0`):** 현재 AWS 리전별 가용 모델 목록에서 빠져 있어 단종된 것으로 보입니다. 그래서 기본값을 Nova Lite로 두었습니다.
- **최신 Claude 모델:** 접두어가 붙은 **교차 리전 추론 프로파일 ID**로 호출합니다. 기본값은 `global.` (어느 리전에서나 호출 가능). `us.` 는 미국 리전, `apac.` 는 아시아 리전에서만 되며, 리전과 맞지 않으면 `config/ai.ts` 가 자동으로 `global.` 로 바꿉니다.
- **이 계정에서 쓸 수 있는 주요 모델 (서울 리전 목록, 2026-10):**
  - 메인 후보: `global.anthropic.claude-sonnet-5` (기본), `global.anthropic.claude-sonnet-5-5`, `global.anthropic.claude-opus-5`, `global.anthropic.claude-sonnet-4-6`
  - 가벼운 대화: `global.anthropic.claude-haiku-4-5-20251001-v1:0` (기본 · Anthropic 사용 사례 양식 제출 필요), `global.amazon.nova-2-lite-v1:0`, `apac.amazon.nova-micro-v1:0`
  - 기억 정리: `global.amazon.nova-2-lite-v1:0` (기본)
  - 그 밖에 OpenAI GPT·xAI Grok·Kimi·GLM 도 목록에 있지만 이 앱에서는 테스트하지 않았습니다.
- **리전:** Vercel은 `AWS_REGION`을 함수가 실행되는 리전 값으로 자동 주입할 수 있습니다. 그래서 `BEDROCK_REGION`을 먼저 읽습니다. Vercel에서는 `BEDROCK_REGION=us-east-1`을 명시하세요.
- **인증:** 기본은 Bedrock API 키(`AWS_BEDROCK_API_KEY`)입니다. IAM 액세스 키를 쓰려면 `BEDROCK_USE_IAM=true`를 함께 설정해야 합니다. 플랫폼이 자동으로 넣은 AWS 값으로 잘못 서명하는 것을 막기 위해서입니다.
- **JSON 응답 강제:** SDK가 Bedrock에서는 스키마를 "강제 도구 호출(json 도구)"로 보내 응답 형식을 맞춥니다. 모델이 도구 호출을 지원해야 합니다(Nova, Claude 지원).

## Meta Llama (Bedrock)

Llama 는 별도 키 없이 **Bedrock 모델 ID** 로 쓴다. 역할(파트)별 환경변수에 그대로 넣으면 된다.

| 파트 | 환경변수 | Llama 예시 |
| --- | --- | --- |
| 메인 대화 | `AI_MODEL` | `us.meta.llama4-maverick-17b-instruct-v1:0` |
| 가벼운 대화 | `AI_MODEL_LIGHT` | `us.meta.llama4-scout-17b-instruct-v1:0` |
| 기억 정리 | `AI_CHEAP_MODEL` | `us.meta.llama4-scout-17b-instruct-v1:0` |
| 성인 모델(매혹 모드) | `AI_MODEL_MATURE` | `us.meta.llama4-maverick-17b-instruct-v1:0` |
| 🛠 테스트 | 🛠 › 모델 탭 목록에 4종 추가됨 | Maverick · Scout · 3.3 70B · 3.1 405B |

- Llama 는 **미국 리전 프로파일(`us.`)** 이다. `BEDROCK_REGION=us-east-1`(또는 us-west-2) 이어야 호출된다. 서울 리전에서는 호출되지 않는다.
- Bedrock 콘솔 › Model access 에서 Meta 모델을 먼저 활성화해야 한다.
- 답장 형식(JSON)은 도구 호출로 받는다. 도구 호출을 지원하지 않는 작은 모델(예: 1B·3B·8B)은 쓰지 말 것.
- 모델 ID 는 AWS 가 바꿀 수 있다 → 안 되면 🛠 › 모델 › "직접 입력"에 콘솔에 보이는 ID 를 넣어 시험한다.

## Grok 도 Bedrock 으로 (xAI 키 불필요)

Grok 4.7 은 Bedrock 에서도 제공된다 (AWS 문서 확인: 모델 ID `xai.grok-4.7`, 호출은 교차 리전 프로파일 `global.xai.grok-4.7` 또는 `us.xai.grok-4.7`, Converse 지원).
Llama 와 똑같이 **Bedrock 모델 ID** 로 쓰면 되므로 `XAI_API_KEY` 가 필요 없고 `AWS_BEDROCK_API_KEY` 만 있으면 된다.

| 파트 | 환경변수 | 값 |
| --- | --- | --- |
| 성인 모델 | `AI_MODEL_MATURE` | `global.xai.grok-4.7` |
| 메인 | `AI_MODEL` | `global.xai.grok-4.7` |
| 🛠 테스트 | 🛠 › 모델 탭 | "Grok 4.7 (Bedrock)" |

- `global.` 프로파일은 서울 등 어느 리전에서든 호출된다 (`us.` 는 미국 리전만 — 서울이면 앱이 자동으로 `global.` 로 바꿈).
- Bedrock 콘솔 › Model access 에서 xAI 모델 접근을 먼저 활성화해야 한다.
- 문서상 서버측 도구는 미지원이고 클라이언트 함수 호출 지원 여부는 명시돼 있지 않다. 이 앱은 답장 형식을 도구 호출로 받으므로, 🛠 › 모델에서 "Grok 4.7 (Bedrock)" 로 먼저 한 번 시험해 오류가 없는지 확인할 것.
- 기존 "Grok 4.7 (xAI 직접)" 은 `XAI_API_KEY` 로 api.x.ai 를 직접 부르는 방식이다. Bedrock 만 쓸 거면 필요 없다.


## Grok 4.3 (Bedrock Mantle) — 성인 모델 기본값 (2026-10)

Grok 4.3 은 Bedrock 의 일반 주소(Converse)가 아니라 **Mantle(OpenAI 호환) 주소**에서만 호출됩니다. 코드의 `mantle` 프로바이더가 처리합니다.

| 환경변수 | 값 | 설명 |
| --- | --- | --- |
| `AI_MODEL_MATURE` | `mantle:xai.grok-4.3` | 기본값이라 비워 둬도 됨 (`xai.grok-4.3` 만 써도 자동으로 mantle) |
| `AWS_BEDROCK_API_KEY` | 기존 키 그대로 | 장기 Bedrock API 키여야 함 (단기 키는 발급 리전에서만 동작) |
| `BEDROCK_MANTLE_REGION` | `us-east-1` (기본) | Grok 4.3 은 us-east-1 · us-east-2 · us-west-2 만 |
| `MANTLE_REASONING_EFFORT` | `low` (기본) | `none` 이면 가장 빠름 |

- 가격: 입력 $1.25 / 출력 $2.50 (100만 토큰, Standard) — Grok 4.7($2/$6)보다 저렴하고, 생각 정도를 낮춰 빠름.
- AWS 콘솔 → Bedrock(us-east-1) → Model access 에서 xAI Grok 4.3 이 활성화돼 있어야 합니다.
- 🛠 › 모델 › "Grok 4.3 (Bedrock · 빠름)" 으로 바로 시험할 수 있습니다. 예전 Grok 4.7 은 "이전" 표시로 남겨 두었습니다.
