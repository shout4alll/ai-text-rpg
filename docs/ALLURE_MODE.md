# 💋 매혹 모드

인물이 **조금 더 대담하고 은근하게** 대화하는 모드입니다. 전용 리액션 영상(그윽한 눈빛, 입술 깨물며 웃기, 머리 넘기며 바라보기 등)도 함께 나옵니다.
현재 **서하린(character_a)**, **윤지아(character_b)** 에 적용되어 있습니다.

## 수위 원칙 (모드와 상관없이 고정)

| 허용 | 금지 |
| --- | --- |
| 설렘, 밀당, 은근한 농담, 나른한 말투, 눈빛·분위기 암시 | 노출, 옷 벗기, 신체 부위 묘사, 스킨십·성행위 묘사나 암시, 노골적인 단어 |
| 옷을 입은 채 눈빛·표정·제스처로 분위기를 내는 영상 | 노출이 있는 영상·사진 (앱에 넣지 않음) |

- 유저가 더 노골적으로 끌고 가면 인물이 장난스럽게 밀어내며 분위기만 유지합니다.
- 사진·영상 요청의 수위 규칙(성적인 사진 거절)과 안전 규칙은 이 모드에서도 그대로입니다.
- 유저가 미성년자로 보이면 즉시 평소 말투로 돌아갑니다.

## 켜는 조건

1. 인물 파일에 `allure` 항목이 있어야 합니다.
2. **멤버십 PRIME 이상** (또는 환경변수 `PREMIUM_ACCESS=open`). 아니면 멤버십 안내가 뜹니다.
3. 처음 한 번 **만 19세 이상 확인**. 기기에 기억합니다.

리액션 화면 오른쪽 위 🔊 아래의 **💋 버튼**으로 켜고 끕니다. 인물마다 따로 기억합니다.
켜면 매혹 영상 하나가 바로 재생되고, 화면 가장자리에 붉은 빛이 돕니다.

## 동작

| 어디에 | 무엇이 달라지나 |
| --- | --- |
| 텍스트 톡 | `/api/chat` 에 `allure: true` → 프롬프트에 매혹 모드 지침 추가 (`config/allure.ts` 의 `allureInstructions`) |
| 보이스톡 | 통화를 걸 때 켜져 있으면 목소리 톤(`allure.voiceStyle`)과 말투가 바뀜 |
| 리액션 영상 | 설렘·부끄러움·미소 순간에 50%, 마음 리액션엔 80%, 머리 쓰다듬기·볼 터치 첫 터치에 45% 확률로 매혹 영상. 매혹 영상 사이 25초, 같은 영상은 90초 간격 (`ALLURE_TUNING`) |

## 인물에 추가하기

1. `personas/<id>.json` 에 추가:

```json
"allure": {
  "prompt": "이 인물이 매혹 모드에서 어떻게 달라지는지 (말투·분위기). 노골적 내용은 쓰지 않는다.",
  "voiceStyle": "보이스톡 목소리 톤 (예: 낮고 나른하게, 천천히)"
}
```

2. 영상은 `public/avatar/personas/<id>/clips/allure/` 에 mp4로 넣습니다. 파일 이름은 자유이고(예: `gaze.mp4`), 빌드 때 자동으로 인식합니다. 영상이 없어도 말투 모드는 동작합니다.
3. 변환은 일반 리액션 영상과 같은 명령을 씁니다 (`docs/REACTION_VIDEOS.md`).

**영상 프롬프트 예시 (SeaArt 이미지 기반 비디오, 4초)**: 프롬프트 끝에 항상 `Fully clothed in the same outfit, tasteful and elegant` 를 붙여 옷차림이 바뀌지 않게 합니다.

- 다가오며 그윽한 눈빛: `She slowly leans toward the camera, tilts her head and gives a slow, confident, alluring smile with half-lidded eyes…`
- 입술 깨물며 장난: `She playfully bites her lower lip, raises one eyebrow with a teasing smirk…`
- 머리 넘기며 바라보기: `She slowly runs her fingers through her hair, glances away, then looks back at the camera over her shoulder with a knowing gaze…`

## 서비스 전 할 일

- **성인 인증:** 지금은 "만 19세 이상" 버튼(자기 확인)입니다. 실제 서비스에서는 본인인증(휴대폰·PASS 등)으로 바꾸고, 로그인 사용자 기준으로 서버에서 확인하세요.
- **서버 확인:** 지금은 브라우저가 보내는 `allure` 값을 그대로 씁니다(멤버십이 아직 기기 저장 테스트라서). 결제 연동 후에는 `/api/chat`, `/api/voice/session` 에서 사용자 구독·성인 인증을 확인한 뒤에만 반영하세요.
- **영상 보호:** `clips/allure/` 도 지금은 `public/` 이라 주소를 알면 받을 수 있습니다. 유료 영상과 같이 비공개 저장소 + 서명 URL 로 옮기세요.
- 앱 마켓 심사(연령 등급)와 운영 정책도 함께 확인하세요.

## 파일

| 파일 | 역할 |
| --- | --- |
| `config/allure.ts` | 빈도·확률, 저장 키, 공통 프롬프트 지침 |
| `components/AllureGateModal.tsx` | 첫 사용 안내 + 성인 확인 |
| `lib/reactionDirector.ts` | 매혹 영상 연출 (`pickAllure`, `allureIntro`) |
| `components/ChatApp.tsx` | 💋 버튼, 켜기/끄기, 요청에 `allure` 전달 |
| `app/api/chat/route.ts`, `lib/voice/instructions.ts` | 프롬프트 반영 |
