# 보이스톡 (AI 음성 통화) — 유료 상품용

헤더의 **📞 보이스톡** 버튼을 누르면 인물과 실시간으로 목소리로 대화합니다.
Google **Gemini Live API**를 씁니다. 사람처럼 말을 끊고 끼어들 수 있고, 한국어를 지원합니다.

> **과금 정책:** 처음 주고받기 5번은 무료이고, 그다음은 멤버십 시간 또는 캐시(💎5/분)를 씁니다. → `docs/MEMBERSHIP.md`

## 동작 방식

```
브라우저 ──(1) POST /api/voice/session──▶ 서버: 이용권 확인 → 일회용 토큰 발급
   │                                         (인물 프롬프트·목소리·자막 설정을 토큰에 잠금)
   └──(2) WebSocket 직접 연결 (토큰) ──▶ Gemini Live API
          마이크 16kHz PCM 전송 / 음성 24kHz PCM 재생 / 자막 수신
```

- **진짜 API 키는 서버에만 있습니다.** 브라우저는 1회용, 1분 안에 써야 하는 토큰만 받습니다.
- 프롬프트는 토큰에 잠겨 있어서 브라우저에서 보거나 바꿀 수 없습니다.
- 통화 중에는 인물 화면이 그대로 보입니다. 상대가 말하는 동안 말하기 모션을 보여 주고, 말 내용에 맞춰 표정 리액션을 재생합니다.
- 통화 중에도 **화면 터치**가 됩니다. 터치하면 상대에게도 알려서 목소리로 반응합니다. 너무 잦지 않게 8초에 한 번만 알립니다.
- 끊으면 통화 내용(자막)이 🎙 표시와 함께 톡 기록에 남고, "📞 보이스톡 3:12" 기록이 붙습니다. 그 뒤 텍스트 톡은 통화 내용을 이어서 기억합니다.

## 설정 (환경변수)

| 변수 | 설명 | 기본값 |
| --- | --- | --- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | **필수.** Gemini API 키 (텍스트 톡의 Google 키와 같음) | — |
| `GEMINI_LIVE_MODEL` | Live 모델 | `gemini-3.1-flash-live-preview` |
| `VOICE_ACCESS` | `open`(누구나) / `paid`(이용권 필요) / `off` | 개발 서버 `open`, 배포 `paid` |
| `VOICE_DEV_PASS` | 결제 연동 전 테스트용 암호 | — |
| `VOICE_MAX_MINUTES` | 통화 1회 최대 길이 (분, 최대 10) | `10` |

- 모델은 2026년 10월 기준 문서에 있는 `gemini-3.1-flash-live-preview`와 `gemini-3.8-live` 중에서 고르면 됩니다. 모델 이름은 자주 바뀌므로 [Live API 문서](https://ai.google.dev/gemini-api/docs/live-guide)에서 확인하세요.
- **배포 환경에서 테스트하기:** `VOICE_DEV_PASS=원하는암호`를 설정하세요. 그다음 브라우저 콘솔에서 `localStorage.setItem("ai-rpg.voicePass", "원하는암호")`를 실행하면 이용권 없이 통화할 수 있습니다.

## 비용 (참고, 2026년 10월 Google 가격표 기준)

Live 모델 유료 등급 기준으로 오디오 입력은 약 $0.005/분, 출력은 약 $0.018/분입니다. 그래서 **통화 1분에 대략 $0.02~0.03**이 듭니다. 실제 가격은 [가격표](https://ai.google.dev/gemini-api/docs/pricing)에서 확인하세요.
판매 가격을 정할 때는 이 원가에 결제 수수료와 여유분을 더하세요.

## 유료화 연결할 곳

`lib/voice/access.ts`의 `hasVoicePass()` 하나만 바꾸면 됩니다.

1. 로그인 사용자를 확인합니다.
2. 구독 상태나 남은 통화 시간(분)을 조회합니다.
3. 통과하면 `true`를 반환합니다. 남은 시간에 맞춰 `voiceMaxSeconds()`를 사용자별로 줄일 수도 있습니다.
4. 통화 시간 정산: 지금은 끊을 때 클라이언트만 통화 초를 압니다(`VoiceCallResult.seconds`). 정확히 정산하려면 종료 시 서버로 보고하는 API(예: `POST /api/voice/end`)를 추가하고, 서버에서 토큰 발급 시각과 비교해 검증하세요.

402 응답을 받으면 통화 화면에 "이용권이 필요해요" 안내가 뜹니다. 결제 화면으로 보내려면 `components/VoiceCall.tsx`의 `paywall` 부분을 바꾸세요.

## 인물별 목소리

`personas/<id>.json`에 선택 항목을 추가합니다. 없으면 여성 `Leda`, 남성 `Puck`을 씁니다.

```json
"voice": { "name": "Kore", "style": "차분하고 낮은 톤으로, 천천히 다정하게" }
```

**현재 배정** (인물 성격·나이에 맞춰 모두 다르게. `personas/<id>.json`의 `voice`)

| 인물 | 목소리 | 특징 | 말하는 방식(style) 요약 |
| --- | --- | --- | --- |
| 서하린 (29, 배우) | `Despina` | Smooth | 부드럽고 다정, 웃음 섞인 해요체 |
| 윤지아 (33, 주부) | `Kore` | Firm | 담담·건조, 툭 던지는 위트 |
| 한소율 (27, 게임 기획자) | `Autonoe` | Bright | 밝고 장난기, 리액션 큼 |
| 정다온 (22, 대학생) | `Leda` | Youthful | 발랄, 빠른 템포 |
| 박준호 (34, 치킨집 사장) | `Achird` | Friendly | 시원시원·호탕 |
| 이수정 (45, 서점 주인) | `Sulafat` | Warm | 차분·따뜻, 천천히 |
| 최윤서 (47, IT 임원) | `Gacrux` | Mature | 또렷·성숙, 간결 |
| 김도현 (29, 인테리어 디자이너) | `Algieba` | Smooth | 부드럽고 다정, 천천히 |
| 다니엘 브룩스 (37, 호텔 컨시어지) | `Iapetus` | Clear | 유쾌·정중, 살짝 외국인 억양 |
| 루카스 마르탱 (31, 사진작가) | `Zubenelgenubi` | Casual | 가볍고 빠름, 살짝 외국인 억양 |
| 강민재 (26, 기타리스트) | `Enceladus` | Breathy | 낮고 숨결 섞인, 조용히 |

- 목소리(`name`)는 음색을 정하고, `style`은 말 빠르기·톤·감정을 지시합니다. 같은 목소리도 `style`에 따라 꽤 달라집니다.
- 바꾸고 싶으면 [Google 음성 목록](https://ai.google.dev/gemini-api/docs/speech-generation)의 30개 목소리를 AI Studio에서 들어 보고 이름만 바꾸면 됩니다. 재배포하면 적용됩니다.

## 알려진 제한

- Live API 세션은 약 10분 한도라서 통화 1회는 최대 10분입니다. 시간이 다 되면 자동으로 끊깁니다(1분 전 안내). 더 길게 하려면 세션 재개(session resumption)를 구현해야 합니다.
- 스피커로 들으면 상대 목소리가 마이크로 다시 들어가 대화가 끊길 수 있습니다. 브라우저 에코 제거를 켜 두었지만, 이어폰을 권장하는 안내를 띄웁니다.
- 마이크는 HTTPS(또는 localhost)에서만 동작합니다.
- 표정 리액션은 음성 모델이 따로 주지 않아서, 상대가 한 말의 키워드로 추정합니다(`guessReaction`).

## 파일

| 파일 | 역할 |
| --- | --- |
| `app/api/voice/session/route.ts` | 이용권 확인 + 일회용 토큰 발급 |
| `lib/voice/access.ts` | 이용권/모드/최대 시간 (★ 결제 연동 지점) |
| `lib/voice/instructions.ts` | 보이스톡용 인물 프롬프트, 목소리 선택 |
| `components/VoiceCall.tsx` | 통화 화면, 마이크/스피커, 자막, 터치 알림 |
