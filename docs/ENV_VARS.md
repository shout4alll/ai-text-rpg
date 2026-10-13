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
| `AI_MODEL_MATURE` | | ✅ | mantle:xai.grok-4.3 | 매혹·설렘 모드 대화에만 쓰는 모델 |
| `PREMIUM_ACCESS` | | ✅ | 배포 환경은 `paid` | `open` 이면 유료 영상·매혹 모드 잠금 해제 |
| `VOICE_ACCESS` | | ✅ | `lib/voice/access.ts` 참고 | 보이스톡 이용 권한 |
| `VOICE_MAX_MINUTES` | | ✅ | `lib/voice/access.ts` 참고 | 보이스톡 최대 분 |
| `HISTORY_SANITIZE` | | | `on` | 성인 전용 모델이 따로 있을 때, 매혹 모드 대화를 다른 모델에게는 요약만 전달 (`on`/`off`) |
| `STICKY_ROUTING` | | | `on` | 매혹 모드를 끈 직후 "아까 어땠어?" 같은 회상은 몇 턴 더 성인 모델로 (`on`/`off`) |
| `AI_FALLBACK_MODELS` | | ✅ | 비움=기본 순서 | 우회 모델 목록(쉼표 구분, `provider:모델`). 기본: Sonnet 5.5 → Haiku → GPT(Bedrock gpt-oss) → GPT(OpenAI) → Gemini → Nova. 성공률 높은 모델이 자동으로 앞으로. `off`=우회 없음 |
| `SERVICE_FALLBACK` | | ✅ | on | on=일반 대화방에서 모델 실패 시 손님에게 오류를 숨기고 다른 모델로 이어서 답함 / off=끔 |
| `MOOD_ROUTING` | | ✅ | on | 대화 내용별 모델 라우팅: 설렘·스킨십 말 → `AI_MODEL_MATURE`(Grok 등, 일반 방은 매혹 지원 인물+이용 권한 있을 때만) / 인사·맞장구 → `AI_MODEL_LIGHT`(Haiku, Llama 로 바꿔도 됨) / 그 외 → 메인(Sonnet). 단어 목록: config/spicy.ts moodWords |
| `BEDROCK_MANTLE_REGION` | | ✅ | us-east-1 | Grok 4.3 을 부르는 Bedrock Mantle 리전 (us-east-1 · us-east-2 · us-west-2) |
| `MANTLE_REASONING_EFFORT` | | ✅ | low | Grok 4.3 생각 정도: none(가장 빠름) · low · medium · high |
| `SMART_ROUTING` | | ✅ | on | 3단계 라우팅(규칙→의도 분류→목적지 모델, config/routing.ts). off=예전 규칙 라우팅 |
| `ROUTER_MODEL` | | ✅ | us.amazon.nova-micro-v1:0 | 2단계 의도 분류 모델 (서울 리전이면 apac.amazon.nova-micro-v1:0) |
| `AI_MODEL_KNOWLEDGE` | | ✅ | 자동 | 전문지식·정보 질문 모델. 비우면 Perplexity 키가 있으면 perplexity:sonar, 없으면 google:gemini-3.8-flash |
| `PERPLEXITY_API_KEY` | 🔒 | | 없음 | (선택) 과학·정보 질문을 Perplexity Sonar 로 |
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

## 💬 실시간 대화 모니터 공유 저장소 (선택, 2026-10-12)

| 변수 | 설명 |
|---|---|
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash Redis REST 주소·토큰 (Vercel → Storage/Marketplace → "Upstash for Redis" 연결 시 자동 추가). `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` 이름도 인식 |

없으면 서버 메모리에만 기록돼, Vercel 이 서버를 여러 대 띄울 때 🛠 💬 LIVE 창에 일부 대화만 보인다. 연결하면 모든 서버의 최근 400턴이 3일간 모인다 (`lib/liveFeed.ts`).

## 🧭 모델 등급 라우팅 (2026-10-13)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `AI_ANALYZER_MODEL` | `global.anthropic.claude-sonnet-5-5` | 매 턴 최근 대화를 읽고 등급 L·M·P·T 를 정하는 분석 모델. `off` 면 예전 규칙+초경량 분류 |
| `AI_MODEL_PLUS` | `global.anthropic.claude-sonnet-5-5` | P등급(맥락이 깊은 턴) 답장 모델 |
| `AI_MODEL_DEEP` | `global.anthropic.claude-opus-5` | T등급(고난도)·대화 꼬임 답장 모델. `off` 로 끄기 |

등급: L=가벼운 모델(하이쿠) · M=메인(`AI_MODEL`, 소넷 5) · P=`AI_MODEL_PLUS` · T=`AI_MODEL_DEEP`. 실패하면 한 단계씩 내려가 메인으로.
