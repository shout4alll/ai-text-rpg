# 📦 콘텐츠 업데이트 이원화 — 인물·리소스는 앱 재빌드 없이

앱(APK)은 **화면(코드)** 만 담고, **인물 데이터와 리소스는 서버에서 받습니다.** 그래서 인물을 추가하거나 영상·사진을 바꾸는 일은 서버 배포만으로 끝나고, 이미 설치된 앱도 다음 실행부터 반영됩니다. CMS나 다른 에이전트는 아래 두 곳만 다루면 됩니다.

| 무엇 | 어디 | 비고 |
| --- | --- | --- |
| 인물 데이터 (이름·소개·말투·프롬프트·밸런스·선물 취향) | `personas/<id>.json` | 파일만 추가하면 자동 인식 (`personas/index.ts` 등록 불필요) |
| 리소스 (사진·영상·앨범) | `public/avatar/personas/<id>/` | `portrait.jpg`, `stage.jpg`, `clips/*.mp4`, `clips/premium/`, `clips/allure/`, `album/` |

## 인물 추가 순서

1. `personas/<id>.json` 작성 (파일 이름 = id). 형식은 `lib/personas/schema.ts`, 예시는 기존 파일.
   - `order`: 목록 순서(작을수록 앞). 없으면 기존 인물 뒤.
   - `hidden: true`: 파일은 두고 목록에서만 숨김.
2. `public/avatar/personas/<id>/` 에 리소스 넣기 (`docs/REACTION_VIDEOS.md`, `docs/VIDEO_PROMPTS.md`).
3. `git push` → Vercel 배포. 끝.

## 동작 방식

- 서버: `lib/personas/server.ts` 가 `personas/` 폴더를 직접 읽어 검증합니다 (형식이 틀리면 배포 단계에서 어느 파일·항목이 틀렸는지 알려 줌).
- 앱: 시작할 때 `GET /api/personas?abs=1` 로 최신 목록을 받고, 리소스 주소도 서버 주소로 받습니다. 받은 목록은 기기에 저장해 두었다가 다음 실행에 먼저 보여 줍니다 (오프라인이면 마지막 목록 → 앱에 들어 있는 목록 순).
- 웹: 같은 API 로 최신 목록을 받습니다.

## 앱 재빌드가 필요한 경우 (코드)

화면 구성·기능 추가(버튼, 새 화면, 알림 방식 등)는 앱 코드라 `npm run mobile:build` 후 APK 재설치가 필요합니다. 서버 쪽 로직(대화 프롬프트, 모델 라우팅, 밸런스 중 서버 계산 부분)은 배포만으로 반영됩니다.
