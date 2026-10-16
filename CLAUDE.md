# CLAUDE.md — 위드(WitH) 작업 가이드

메신저형 AI 페르소나 채팅 앱. Next.js 14 (App Router) + Tailwind + Vercel AI SDK, 앱은 Capacitor(안드로이드), 서버는 Vercel(추후 자체 클라우드 서버로 이전 예정).
이 파일은 새 세션이 바로 이어서 일할 수 있게 지금까지의 설계·규칙·미검증 항목을 모은 것이다. 세부 내용은 `docs/*.md` 참고.

## 작업 원칙 (사용자 선호)
- 답변은 **한국어, 간결하게**. 설계·정책은 사용자가 정한다. 큰 새 작업(예: 서버 푸시 FCM)은 **먼저 확인받고** 시작한다.
- 결제·구매는 하지 않는다. `.env.local` 등 비밀 값은 **출력하지 않는다**(키 이름만 확인).
- 환경변수 값은 따옴표 없이 쓴다 (예: `AI_MODEL_LIGHT=global.anthropic.claude-haiku-5-5`).
- 포트 정리는 `fuser -k PORT/tcp`. 앱 빌드 중에는 `npm run dev`를 꺼 둔다.
- 사용자 PC 경로는 `D:\ai-text-rpg`. 파일을 덮어쓰기 전에 현재 내용과 비교한다.

## 명령어
```bash
npm install
npm run dev            # http://localhost:3000
npx tsc --noEmit       # 타입 검사 (.next/types 가 오래돼 오류나면 .next/types/app/zz-* 같은 삭제된 페이지 흔적 제거)
npm run build
npm run mobile:build   # 앱용 정적 화면 → out/ → android/ 복사 (docs/MOBILE_APP.md)
npm run android:open
```
- 서버 코드 변경: `git push` → Vercel 재배포. 화면·앱 코드 변경: `npm run mobile:build` + APK 재설치.
- `scripts/build-mobile.mjs` 는 빌드 동안만 `app/api` 등을 `.mobile-stash` 로 옮긴다. 중단되면 폴더가 옮겨진 채 남을 수 있으니 확인.

## 구조 요약
- `app/api/chat/route.ts` — 대화 API 전체 흐름(풀 응답 → 라우팅 → 모델 호출 → 후처리). 가장 크고 중요한 파일.
- `config/` — 설정. `balance.json`(호감도·삐짐·라우팅 밸런스), `settings.ts`(환경변수·CMS 설정 정의, 우선순위: CMS 덮어쓰기 > Vercel env > 코드 기본값), `ai.ts`(프로바이더·모델 역할), `prices.ts`(가격, 모니터 비용 계산용 추정치).
- `lib/` — `smartRouter.ts`(분석 라우터), `modelRouter.ts`(규칙 라우팅·폴백), `continuity.ts`(맥락 의존도), `opusQuota.ts`, `liveFeed.ts`, `kv.ts`(Upstash REST), `salvageReply.ts`(깨진 JSON 복구), `repeatGuard.ts`, `backup.ts`, `push/nudge.ts`.
- `lib/historyWindow.ts` — 대화 간격(30분↑ 끊김)에 따라 앞 대화 참조 범위 조절: 끊김 12시간 미만은 최근 1~5턴, 이상은 무시, 유저가 어제·며칠 전을 떠올리면 최근 10턴 재참조. 수치·말 목록은 `balance.json cost.gap`, 적용은 `app/api/chat/route.ts`(recentFull→recent).
- `personas/*.json` + `_shared.json` — 캐릭터 정의. `config/personaPrompts.ts` — 프롬프트 조립.
- `components/ChatApp.tsx`(메인 앱), `ChatPanel.tsx`, `DevPanel.tsx`(🛠 주인님 패널·📡실시간), `LiveChatMonitor.tsx`(💬 LIVE), `LobbyNotes.tsx`(메인 쪽지).
- `android/` — Capacitor 안드로이드. `FileSaverPlugin.java`(백업을 다운로드 폴더에 저장), `MainActivity.java`에서 super.onCreate 전에 등록.

## 모델 라우팅 (2026-10-13 확정 설계)
순서: 풀 응답(고정 문구) → 맥락 의존도(`contextDependency`, 규칙 점수 0~1) → 규칙 분기(성인/매혹→Grok) → **분석 모델(Haiku 5.5)이 L/M/P/T 등급 판정** → 등급별 모델 → 실패 시 우회 목록.

| 등급 | 의미 | 모델 순서 |
|---|---|---|
| L | 뻔한 인사·맞장구 | `light`(Haiku 5.5) → Haiku 4.5 → chat |
| M | 일반 대화 | `chat`(Sonnet 5, 메인) |
| P | 맥락이 깊은 턴 | `plus`(Sonnet 5.5) → chat |
| T | 최고난도·대화 꼬임 | `deep`(Opus 5) → plus → chat |

- 안전장치: 분석 모델 혼자 L로 내리지 못한다(맥락 규칙도 low일 때만). 분석 실패 시 M. 되묻기·거듭된 요청은 분석 없이 바로 deep.
- **Opus는 하루 12회 한도**(`balance.json routing.opusDailyLimit`, `lib/opusQuota.ts`). 초과하면 plus로.
- **Grok(`AI_MODEL_MATURE`, `mantle:xai.grok-4.3`)은 매혹 모드가 켜져 있고 호감도 70 이상일 때만**(`config/routing.ts ALLURE_MATURE_MIN_AFFECTION`). 호감도 70 미만 매혹 모드·일반 대화는 L·M·P·T 등급 라우팅. 일반 대화의 분위기/키워드/단계별 Grok 전환은 꺼 둠(`MATURE_OUTSIDE_ALLURE=false`). 인물 설정 `modelRoute:"mature"`(윤서)와 치트룸은 예외. Llama는 **비상 폴백 전용**(`DEFAULT_FALLBACK_MODELS` 맨 끝).
- 주인님 모드(🔑 치트 코드)는 **라우팅을 건너뛰고 항상 메인(chat)**. 🛠 패널에서 모델을 직접 고르면 `forced`(라우팅 전부 우회). 실제 서비스 라우팅을 보려면 🛠 → 모델 선택 **자동**, 프롬프트 **서비스**.
- 관련 파일: `app/api/chat/route.ts`(분기 조립), `lib/smartRouter.ts`(`ANALYZE_SYSTEM`, `GRADE_TIERS`), `config/ai.ts`, `config/settings.ts`.
- ⚠️ `config/routing.ts` 머리 주석에 예전 구조(Nova Micro 분류)가 남아 있다. 정리 대상.

## 환경변수 핵심 (전체는 `docs/ENV_VARS.md`)
- 필수: `AI_PROVIDER=bedrock`, `AWS_BEDROCK_API_KEY`(🔒), `BEDROCK_REGION`, `GOOGLE_GENERATIVE_AI_API_KEY`(🔒).
- 등급 라우팅: `AI_MODEL_LIGHT`, `AI_ANALYZER_MODEL`(둘 다 `global.anthropic.claude-haiku-5-5`), `AI_MODEL_PLUS`(Sonnet 5.5), `AI_MODEL_DEEP`(Opus 5, `off`로 끄기). `AI_MODEL`(메인)은 **일부러 비워 둠**(코드 기본 Sonnet 5).
- 성인: `AI_MODEL_MATURE`, `MANTLE_REASONING_EFFORT`(한 줄에 주석을 붙이지 말 것), `ALLURE_LEVEL`.
- 공유 저장소(선택): `KV_REST_API_URL`/`KV_REST_API_TOKEN`(또는 `UPSTASH_REDIS_REST_*`). 없으면 메모리(서버 여러 대면 LIVE 일부만 보이고 Opus 한도도 서버별).
- 접근 권한: `PREMIUM_ACCESS`, `VOICE_ACCESS`, `VOICE_MAX_MINUTES`, `OWNER_CHEAT_PHRASE`(🔒).

## 모니터링
- 🛠 DevPanel → 📡실시간 탭, 💬 LIVE 창(이동·크기·닫기 가능). 메인 화면에서도 주인님 코드 입력 후 도구 버튼 표시.
- 매 턴 적용 모델·경로(`rule`/`분석 …ms`/`forced`/`pool`)·맥락 점수·비용(Sonnet 5 고정 대비 %)이 표시된다. 비용 수치는 `config/prices.ts` 추정치.
- `GET /api/owner/ctxlog` — 맥락 분류 로그(CSV)로 튜닝용 라벨 수집.

## 알려진 함정
- `server-only` import 때문에 라우팅 모듈을 tsx로 단독 테스트하면 실패 → 해당 import를 제거한 복사본으로 테스트.
- `balance.json`은 `json.dump`로 다시 쓰면 포맷이 바뀐다 → 텍스트 삽입으로 수정. 스키마는 `config/balanceSchema.ts`와 맞춰야 한다.
- 모델의 JSON 응답이 깨져 말풍선에 원문이 뜨던 버그 → `lib/salvageReply.ts`(`repairReply`, `proseToBubbles`)로 복구. 응답 파싱을 건드리면 이 경로를 같이 확인.
- 모델 ID는 시간이 지나며 바뀐다(Haiku 5.5는 2026-10-07 출시). 접근 권한·리전은 Bedrock 콘솔에서 확인.

## 아직 검증되지 않은 것 (PC에서 우선 확인할 것)
1. 실제 Bedrock 호출: Haiku 5.5(`global.anthropic.claude-haiku-5-5`), Opus 5, Sonnet 5.5, Grok 4.3(Mantle) 접근·ID. 개발 중 클라우드 환경에서는 Bedrock에 접속할 수 없어 가짜 서버로만 테스트했다.
2. 서비스 모드에서 인사/맥락 질문/성인 대화가 의도한 모델로 가는지(LIVE 경로 표시로 확인).
3. 안드로이드 실기기: 백업이 다운로드 폴더에 저장되는지, 앱 재진입 시 메인 화면 시작, 선톡 푸시.
4. 메인 쪽지(맥락형 선톡)의 문장 품질, 💡 추천 답장 품질.
5. 실제 절감률: 설계 추정 약 28%(20~35%). LIVE 비용 누계를 며칠 모아서 확인.

## 남은 일 / 보류
- 서버 푸시(FCM): Firebase 프로젝트, `google-services.json`, 토큰 저장소, 서버 발송, 스케줄러 필요. **시작 전 확인받기.**
- 자체 클라우드 서버 이전(예정): 환경변수 이전(시크릿 관리), Bedrock 인증을 IAM 역할로, Redis 어댑터(일반 Redis), 스케줄러, 앱 서버 주소(`NEXT_PUBLIC_API_BASE`/도메인 고정) 변경 후 앱 재빌드.
- Upstash Redis를 Vercel에 연결(LIVE 전체 대화 수집, Opus 한도 공유).
- 문서 정리: `docs/BALANCE.md`(프로젝트 문서의 사본은 오래됨), `config/routing.ts` 주석.
- SeaArt 영상 생성(크레딧 충전 후), Gemini 키/계정 정리, Bedrock 이미지·영상 이전.
