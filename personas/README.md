# 페르소나 파일 가이드

**캐릭터 1명 = JSON 파일 1개**입니다. 캐릭터의 이름, 상태메시지, 첫 메시지, 성격, 말투, 일상, 관계 발전 방식, 이미지 설정이 모두 `personas/<id>.json` 한 파일에 들어 있습니다.
코드를 몰라도 이 파일만 고치면 캐릭터가 바뀝니다.

- 이 폴더는 `public/`이 아니라서 브라우저에서 열 수 없습니다. 프롬프트(성격·말투 지시)는 서버에서만 읽힙니다.
- 형식이 틀리면 `npm run build` 또는 `npm run dev`를 실행할 때 **어느 파일의 어느 필드가 틀렸는지** 에러로 알려줍니다.

## 자주 하는 작업

| 하고 싶은 것 | 방법 |
| --- | --- |
| 캐릭터 내용 수정 | 해당 `<id>.json`만 수정 |
| 캐릭터 추가 | ① `_template` 참고해 `<새id>.json` 생성 ② `public/avatar/personas/<새id>/portrait.jpg` 넣기 ③ `index.ts`에 import 한 줄 + 목록 한 줄 추가 |
| 캐릭터 숨기기 | `index.ts` 목록에서 그 줄을 주석 처리 |
| 순서 바꾸기 | `index.ts` 목록 순서 변경 (첫 번째가 기본 캐릭터) |
| 모든 캐릭터 공통 규칙 수정 | `_shared.json`의 `rules` 수정 |

## 필드 설명

| 필드 | 화면 표시 | 설명 |
| --- | --- | --- |
| `id` | | 영문 소문자·숫자·`_`·`-`. **파일 이름과 같아야 함**, 이미지 폴더 이름과도 같아야 함 |
| `name` | ✔ | 이름 |
| `gender` | 필터 | `"female"` 또는 `"male"` |
| `age`, `occupation` | ✔ | 나이(숫자), 직업 |
| `status` | ✔ | 메신저 상태메시지 (예: "오늘도 바삭하게, 마음은 따뜻하게") |
| `timezone` | | (선택) 이 인물이 사는 곳의 시간대. 기본 `Asia/Seoul`, 뉴욕이면 `America/New_York`. AI가 현지 시각에 맞게 말함 |
| `description` | ✔ | 선택 카드 설명 |
| `tags` | ✔ | 선택 카드 태그 (최대 6개) |
| `accent` | ✔ | 강조색 `#RRGGBB` |
| `greeting` | ✔ | 대화방을 처음 열면 상대가 먼저 보내는 첫 메시지. 시간대와 상관없이 어울리는 문장 권장 |
| `image.portrait` | ✔ | `public/avatar/personas/<id>/` 안의 이미지 파일명 (기본 `portrait.jpg`) |
| `image.objectPosition` | ✔ | 얼굴이 화면 중앙에 오도록 하는 기준점 (예: `"55% 30%"`, 앞 숫자가 가로 위치) |
| `image.fallbackClipsDir` / `fallbackPoster` | | (선택) **같은 인물의** 대체 클립 폴더·이미지 |
| `prompt.identity` | | 배경: 어떤 사람인지 |
| `prompt.personality` | | 성격 |
| `prompt.speech` | | 말투 규칙 (처음 말투와 친해진 뒤 말투를 함께 적으면 좋음) |
| `prompt.chatStyle` | | 대화할 때의 태도·습관 |
| `prompt.lifestyle` | | 평소 일상 (시간대별로 무엇을 하는지, 바쁜 시간 등) |
| `prompt.relationship` | | **관계가 어떻게 발전하는지와 애정 표현 방식.** 연애로 발전하지 않게 하려면 여기에 적기 (예: "기혼이므로 연애 감정으로 발전하지 않는다") |
| `prompt.examples` | | 말투 예시 1개 이상 (`유저: "…" → 답장` 형식 권장. AI가 그대로 베끼지 않도록 지시됨) |
| `prompt.temperature` | | (선택) 응답 다양성 0~2. 기본 1.0, 차분한 캐릭터는 0.75~0.85 |

## _template (새 캐릭터 복사용)

```json
{
  "id": "character_new",
  "name": "이름",
  "gender": "female",
  "age": 30,
  "occupation": "직업",
  "status": "상태메시지",
  "timezone": "Asia/Seoul",
  "description": "선택 카드에 보일 2문장 소개",
  "tags": ["직업", "말투", "분위기"],
  "accent": "#38bdf8",
  "greeting": "대화방을 열면 먼저 보내는 첫 메시지",
  "image": { "portrait": "portrait.jpg", "objectPosition": "50% 30%" },
  "prompt": {
    "identity": "어떤 사람인지 (가상 인물)",
    "personality": "성격",
    "speech": "말투",
    "chatStyle": "대화 습관",
    "lifestyle": "평소 일상 (출근, 바쁜 시간, 쉬는 날)",
    "relationship": "관계가 깊어지는 방식, 애정 표현 방식 (연애 가능 여부 포함)",
    "examples": ["유저: \"…\" → 답장 예시"],
    "temperature": 0.9
  }
}
```

> 실존 인물, 실제 회사, 작품, 브랜드는 넣지 마세요. 공통 규칙(`_shared.json`)에서도 언급을 막고 있습니다.
