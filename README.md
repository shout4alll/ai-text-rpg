# AI Text RPG

Next.js 14 (App Router) + Tailwind CSS + React Three Fiber 로 만든 AI 텍스트 RPG 프로토타입.
좌측에 3D 아바타(Box 플레이스홀더), 우측에 채팅 UI가 있으며, `/api/chat` 은 LLM(OpenAI/Anthropic)이 TRPG 게임 마스터로 응답합니다.

## 실행

```bash
npm install
npm run dev   # http://localhost:3000
```

## 구조

```
app/
  api/chat/route.ts   # LLM 게임 마스터 API (Vercel AI SDK)
  layout.tsx
  page.tsx            # 화면 분할, input/HP/emotion/animation 상태 관리
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
config/personas.ts    # 캐릭터 공개 메타데이터 (이름, 인사말, 자원 경로)
config/personaPrompts.ts # 캐릭터별 시스템 프롬프트 (서버 전용)
lib/avatarConfig.ts   # 모델 URL / 키 / 바닥 높이 설정
lib/avatarMotion.ts   # jump/nod/shake 모션 샘플링
scripts/              # 플레이스홀더 GLB 생성기 (npm run gen:placeholder)
docs/AI_PROVIDERS.md  # 프로바이더·모델 전환 방법, Bedrock 주의사항
docs/PERSONAS.md      # 멀티 페르소나 구조 / 캐릭터 추가 / 폴백 규칙
docs/VIDEO_AVATAR.md  # 실사 영상 아바타 / AI 영상 도구로 클립 제작하는 가이드
docs/AVATAR_SETUP.md  # (3d 모드) GLB 모델 교체 가이드
public/avatar/personas/  # 캐릭터별 이미지 + clips/
public/avatar/clips/     # character_a 폴백용 임시 클립
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
  "messages": [{ "role": "user" | "assistant", "content": "..." }],
  "hp": 80,
  "maxHp": 100
}
```

응답 (Vercel AI SDK `generateText` + `Output.object` 로 스키마 강제):

```json
{ "text": "...", "emotion": "surprised", "animation": "jump", "hp_change": -10 }
```

- `animation`: `idle | jump | nod | shake`
- `emotion`: `neutral | happy | sad | angry | surprised` (LLM은 기쁨/슬픔/놀람/분노/평온으로 출력, 서버에서 변환)
- `hp_change`: 정수, -30 ~ +20 으로 서버에서 보정
- 최근 20개 메시지만 컨텍스트로 사용하고, 메시지당 1000자로 제한합니다.
