# 🔧 Vercel 환경변수 ↔ 로컬 (.env.local) 대응표

Vercel 화면에는 변수 **이름만** 보이고 값은 가려져 있어서(🔒), 값은 이 문서에 적지 않았습니다.
로컬에서 같은 환경으로 돌리려면 프로젝트 루트에 `.env.local` 파일을 만들고 아래 이름을 한 줄씩 `이름=값` 으로 적으세요. `.env.local` 은 git 에 올라가지 않습니다.
비밀 값(API 키)은 이 문서·코드·채팅에 붙여 넣지 마세요.

| 변수 | 비밀? | 지금 Vercel 에 있음 | 값을 안 넣으면(코드 기본값) | 설명 |
| --- | :-: | :-: | --- | --- |
| `AI_PROVIDER` | | ✅ | `bedrock` (`config/ai.ts` ACTIVE_PROVIDER) | `bedrock` 또는 `google` |
| `AWS_BEDROCK_API_KEY` | 🔒 | ✅ | 없음(필수) | Bedrock 호출 키 |
| `BEDROCK_REGION` | | ✅ | `us-east-1` | Bedrock 리전 |
| `GOOGLE_GENERATIVE_AI_API_KEY` | 🔒 | ✅ | 없음(필수) | Gemini 키 (보이스톡·이미지·google 프로바이더) |
| `AI_MODEL_MATURE` | | ✅ (방금 추가) | 메인 모델 | 매혹·설렘 모드 대화에만 쓰는 모델 |
| `PREMIUM_ACCESS` | | ✅ | 배포 환경은 `paid` | `open` 이면 유료 영상·매혹 모드 잠금 해제 |
| `VOICE_ACCESS` | | ✅ | `lib/voice/access.ts` 참고 | 보이스톡 이용 권한 |
| `VOICE_MAX_MINUTES` | | ✅ | `lib/voice/access.ts` 참고 | 보이스톡 최대 분 |
| `HISTORY_SANITIZE` | | | `on` | 성인 전용 모델이 따로 있을 때, 매혹 모드 대화를 다른 모델에게는 요약만 전달 (`on`/`off`) |
| `STICKY_ROUTING` | | | `on` | 매혹 모드를 끈 직후 "아까 어땠어?" 같은 회상은 몇 턴 더 성인 모델로 (`on`/`off`) |
| `AI_FALLBACK_MODELS` | | ✅ | 비움=기본 순서 | 우회 모델 목록(쉼표 구분, `provider:모델`). 기본: Sonnet 5.5 → Haiku → GPT(Bedrock gpt-oss) → GPT(OpenAI) → Gemini → Nova. 성공률 높은 모델이 자동으로 앞으로. `off`=우회 없음 |
| `SERVICE_FALLBACK` | | ✅ | on | on=일반 대화방에서 모델 실패 시 손님에게 오류를 숨기고 다른 모델로 이어서 답함 / off=끔 |
| `OPENAI_API_KEY` | 🔒 | | 없음 | OpenAI 직접 호출(`openai:gpt-5`)용. 없으면 해당 모델은 건너뜀 |
| `XAI_API_KEY` | 🔒 | | 없음 | xAI(Grok) 키 — console.x.ai 에서 발급. 🛠 모델 탭의 Grok 테스트·`AI_MODEL_MATURE=xai:grok-4.7` 에 필요 |
| `XAI_BASE_URL` | | | `https://api.x.ai/v1` | (선택) Grok 주소. 미국 리전 `https://us.api.x.ai/v1` |
| `GEMINI_LIVE_MODEL` | | ✅ | `gemini-3.8-live` | 보이스톡 모델 |

Vercel 에 **없는** 변수는 모두 코드 기본값이 쓰입니다. 대화 모델은 `AI_MODEL` 이 없으니 `config/ai.ts` 의 값,
즉 메인 `global.anthropic.claude-sonnet-5`, 가벼운 대화 `global.anthropic.claude-haiku-4-5-20251001-v1:0`, 기억 정리 `global.amazon.nova-2-lite-v1:0` 입니다.

## 로컬 `.env.local` 예시 (값은 직접 채우세요)
```
AI_PROVIDER=bedrock
BEDROCK_REGION=<Vercel 값과 동일>
AWS_BEDROCK_API_KEY=<비밀>
GOOGLE_GENERATIVE_AI_API_KEY=<비밀>
AI_MODEL_MATURE=<모델 ID>
PREMIUM_ACCESS=<Vercel 값과 동일>
VOICE_ACCESS=<Vercel 값과 동일>
VOICE_MAX_MINUTES=<Vercel 값과 동일>
GEMINI_LIVE_MODEL=<Vercel 값과 동일>
```
값 확인: Vercel 변수 오른쪽 `⋯` › Edit 에서 눈 아이콘으로 볼 수 있습니다 (비밀 값은 보이지 않을 수 있음).
Vercel CLI 가 있으면 `vercel env pull .env.local` 한 번으로 로컬 파일이 만들어집니다.
