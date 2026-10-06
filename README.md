# 메신저형 AI 페르소나 채팅

정해진 인물들과 메신저로 대화하며 교감하고 관계를 키워 가는 AI 채팅 앱입니다. 화면 속 인물을 **터치하면 부끄러워하거나 앙탈을 부리며 반응**하고, **📞 보이스톡**으로 목소리 대화도 할 수 있습니다(유료 기능). Next.js 14 (App Router) + Tailwind + Vercel AI SDK로 만들었습니다.
좌측에는 답장에 맞춰 반응하는 인물 사진·영상, 우측에는 메신저가 있고, 캐릭터는 `personas/*.json` 파일로 관리합니다.

## 실행

```bash
npm install
npm run dev   # http://localhost:3000
```

## 구조

```
app/
  api/chat/route.ts   # 캐릭터 대화 API (Vercel AI SDK)
  layout.tsx
  page.tsx            # 서버 컴포넌트: 페르소나 파일을 읽어 공개 정보만 ChatApp에 전달
  globals.css
components/
  PersonaSelector.tsx # 캐릭터 선택 화면 / 교체 모달
  PersonaPortrait.tsx # 캐릭터 이미지 + 폴백
  AvatarStage.tsx     # NEXT_PUBLIC_AVATAR_MODE 에 따라 video / 3d 선택
  VideoAvatar.tsx     # 실사 영상 클립 아바타 (idle 루프 + 이벤트 클립)
  Avatar.tsx          # (3d 모드) GLB 캐릭터 로드, idle 루프, jump/nod/shake, 감정 블렌드셰이프
  AvatarBoundary.tsx  # 모델 로드 실패 시 폴백 처리
  CubeAvatar.tsx      # 폴백용 큐브 아바타
  AvatarScene.tsx     # <Canvas>, 조명, 바닥
config/ai.ts          # AI 프로바이더/모델 설정 (서버 전용)
personas/             # ★ 캐릭터 파일 (1명 = JSON 1개) + _shared.json 공통 규칙 + README
lib/personas/         # 페르소나 파일 검증·로더 (서버 전용)
config/reactions.ts   # ★ 리액션·마음 리액션·호감도 단계 목록
lib/avatarConfig.ts   # 모델 URL / 키 / 바닥 높이 설정
lib/avatarMotion.ts   # jump/nod/shake 모션 샘플링
scripts/              # 플레이스홀더 GLB 생성기 (npm run gen:placeholder)
docs/AI_PROVIDERS.md  # 프로바이더·모델 전환 방법, Bedrock 주의사항
docs/REACTIONS.md     # 화면 리액션 15종, 마음 리액션 10종, 호감도, 영상 추가 방법
docs/PERSONAS.md      # 멀티 페르소나 구조 / 캐릭터 추가 / 폴백 규칙
docs/VIDEO_AVATAR.md  # 실사 영상 아바타 / AI 영상 도구로 클립 제작하는 가이드
docs/VOICE_TALK.md    # 보이스톡(AI 음성 통화, Gemini Live) 설정·유료화·비용
docs/REACTION_VIDEOS.md  # ★ 리액션 영상 연출 규칙·무료/유료·캐릭터별 영상 추가 방법
docs/MEDIA.md         # ★ 사진·영상 보내기 (앨범 무료 / 실시간 사진 유료·캐시)
docs/MEMBERSHIP.md    # ★ 유료 정책: 보이스톡 무료 체험 5번 → 캐시/멤버십(BEST·PRIME·VIP)
config/plans.ts       # 가격·체험 횟수·멤버십 단계별 혜택 (숫자는 여기서만)
lib/membership.ts     # 멤버십 상태·월 사용량 (결제 연동 전 테스트 저장소)
components/PlansModal.tsx  # 멤버십·캐시 안내 모달
app/api/media/photo/route.ts  # 유료 실시간 사진 생성 (인물 사진 기준)
config/media.ts       # 사진 비용·테스트 캐시
components/MediaPurchaseModal.tsx  # 유료 사진 확인 모달
lib/reactionDirector.ts  # 영상을 언제 틀지 정하는 연출 담당 (빈도 조절: DIRECTOR_TUNING)
lib/entitlements.ts   # 유료 리액션 영상 이용 권한 (PREMIUM_ACCESS)
app/api/voice/session/route.ts  # 보이스톡 일회용 토큰 발급
lib/voice/            # 보이스톡 이용권 체크(★ 결제 연동 지점)·음성 프롬프트
components/VoiceCall.tsx  # 보이스톡 통화 화면
docs/AVATAR_SETUP.md  # (3d 모드) GLB 모델 교체 가이드
public/avatar/personas/  # 캐릭터별 이미지 + clips/
public/avatar/clips/     # character_a 폴백용 임시 클립
  ChatApp.tsx         # 화면 분할, 대화 상태 관리
  ChatPanel.tsx       # 채팅 로그 + 입력 폼
types/game.ts         # ChatResponse 등 공용 타입
```

## 환경 변수 / AI 모델

AI 프로바이더와 모델은 `config/ai.ts`에서 관리합니다. 현재 **Amazon Bedrock(Nova Lite)이 활성**이고, Google은 대기, OpenAI·Anthropic은 주석 처리돼 있습니다. 자세한 내용은 `docs/AI_PROVIDERS.md`를 보세요.

`.env.example`을 `.env.local`로 복사해서 키를 채우세요. (Vercel에서는 Project Settings → Environment Variables)

## API

`POST /api/chat`

```json
{
  "personaId": "character_a",
  "messages": [{ "role": "user" | "assistant", "kind": "text" | "reaction" | "return", "content": "...", "at": 1730000000000 }],
  "timeZone": "Asia/Seoul",
  "affection": 24
}
```

응답 (Vercel AI SDK `generateText` + `Output.object` 로 스키마 강제):

```json
{ "messages": ["말풍선1", "말풍선2"], "reaction": "laugh", "tapback": "love", "affectionDelta": 2, "emotion": "happy", "animation": "jump" }
```

- `animation`: `idle | jump | nod | shake`
- `emotion`: `neutral | happy | sad | angry | surprised` (LLM은 기쁨/슬픔/놀람/분노/평온으로 출력, 서버에서 변환)
- 최근 40개 메시지만 컨텍스트로 사용하고, 메시지당 1000자로 제한합니다.
