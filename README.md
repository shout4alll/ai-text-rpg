# AI Text RPG

Next.js 14 (App Router) + Tailwind CSS + React Three Fiber 로 만든 AI 텍스트 RPG 프로토타입.
좌측에 3D 아바타(Box 플레이스홀더), 우측에 채팅 UI가 있으며, `/api/chat` 은 현재 **하드코딩된 Mock 응답**을 반환합니다.

## 실행

```bash
npm install
npm run dev   # http://localhost:3000
```

## 구조

```
app/
  api/chat/route.ts   # Mock 채팅 API (POST)
  layout.tsx
  page.tsx            # 화면 분할, input/HP/emotion/animation 상태 관리
  globals.css
components/
  Avatar.tsx          # Box 아바타 + jump / nod 애니메이션 (useFrame)
  AvatarScene.tsx     # <Canvas>, 조명, 바닥
  ChatPanel.tsx       # 채팅 로그 + 입력 폼
types/game.ts         # ChatResponse 등 공용 타입
```

## API

`POST /api/chat` — body: `{ "message": string }`

```json
{ "text": "앗, 몬스터가 나타났어요!", "emotion": "surprised", "animation": "jump", "hp_change": -10 }
```

- `animation`: `idle | jump | nod`
- `emotion`: `neutral | happy | sad | angry | surprised` (아바타 색상에 반영)

## 실제 LLM 연결하기

`app/api/chat/route.ts` 의 `TODO` 위치에서 `message` 를 모델에 전달하고, 응답을 `ChatResponse` 스키마로 검증해 반환하세요.
API 키는 `.env.local` 에 두면 됩니다 (`.gitignore` 처리됨).
