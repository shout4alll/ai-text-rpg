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
- **최신 Claude 모델:** `us.anthropic...`처럼 접두어가 붙은 **교차 리전 추론 프로파일 ID**로 호출해야 하는 경우가 많습니다. `config/ai.ts`의 주석 예시를 참고하세요.
- **리전:** Vercel은 `AWS_REGION`을 함수가 실행되는 리전 값으로 자동 주입할 수 있습니다. 그래서 `BEDROCK_REGION`을 먼저 읽습니다. Vercel에서는 `BEDROCK_REGION=us-east-1`을 명시하세요.
- **인증:** 기본은 Bedrock API 키(`AWS_BEDROCK_API_KEY`)입니다. IAM 액세스 키를 쓰려면 `BEDROCK_USE_IAM=true`를 함께 설정해야 합니다. 플랫폼이 자동으로 넣은 AWS 값으로 잘못 서명하는 것을 막기 위해서입니다.
- **JSON 응답 강제:** SDK가 Bedrock에서는 스키마를 "강제 도구 호출(json 도구)"로 보내 응답 형식을 맞춥니다. 모델이 도구 호출을 지원해야 합니다(Nova, Claude 지원).
