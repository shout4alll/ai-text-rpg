# 멀티 페르소나 시스템

> 캐릭터 내용 수정, 추가, 숨기기는 **`personas/README.md`** 를 보세요. 캐릭터 1명이 JSON 파일 1개입니다.

## 콘셉트

게임이 아닌, **지나가다 우연히 마주친 사람과 나누는 영화 같은 대화**입니다.
- 11명 모두 현실 세계의 평범한 가상 인물입니다.
- 각자의 장면(비 오는 골목, 서점, 뉴욕 루프탑 등)에서 유저를 처음 만나며 대화가 시작됩니다.
- 처음엔 낯선 사람 사이의 거리를 두고, 대화하면서 가까워집니다.

| id | 이름 | 나이·직업 | 만남 |
| --- | --- | --- | --- |
| `character_a` | 서하린 | 29 · 배우 | 노을 지는 강변에서 사진을 부탁 |
| `character_b` | 윤지아 | 33 · 주부(전직 사서) | 중고거래로 추리소설 전집 문의 |
| `character_c` | 한소율 | 27 · 게임 기획자 | 잘못 보낸 메시지 |
| `character_d` | 정다온 | 22 · 대학생 | 도서관에 두고 간 노트를 찾아 줌 |
| `character_e` | 박준호 | 34 · 치킨집 사장 | 비 오는 골목에서 우산을 씌워 줌 |
| `character_f` | 이수정 | 45 · 독립서점 주인 | 비를 피해 들어간 서점 |
| `character_g` | 최윤서 | 47 · IT 기업 임원 | 회의실을 잘못 찾아 들어감 |
| `character_h` | 김도현 | 29 · 인테리어 디자이너 | 공사 소음으로 올라간 위층 집 |
| `character_i` | 다니엘 브룩스 | 37 · 뉴욕 호텔 컨시어지 | 뉴욕 루프탑 바 옆자리 |
| `character_j` | 루카스 마르탱 | 31 · 여행 사진작가 | 비 오는 도쿄에서 길을 물어 옴 |
| `character_k` | 강민재 | 26 · 인디밴드 기타리스트 | 비 오는 밤 창가 자리를 나눠 줌 |

## 구조

| 파일 | 역할 |
| --- | --- |
| `personas/<id>.json` | 캐릭터 1명의 모든 데이터 (공개 정보 + 프롬프트) |
| `personas/_shared.json` | 모든 캐릭터 공통 규칙 (우연한 첫 만남, 현실 세계, 고정관념·실존 인물 금지 등) |
| `personas/index.ts` | 등록 목록 (순서 = 선택 화면 순서, 첫 번째 = 기본) |
| `lib/personas/server.ts` | **서버 전용** 로더: 파일 검증, 공개 정보와 프롬프트 분리 |
| `app/page.tsx` | 서버 컴포넌트: 공개 정보만 브라우저로 전달 |
| `app/api/chat/route.ts` | `personaId` 검증 → 캐릭터 프롬프트 + 공통 규칙 + 대화 원칙·안전 규칙으로 시스템 프롬프트 구성 |
| `components/PersonaSelector.tsx` | 첫 방문 선택 화면 / "다른 사람" 모달 (전체·여성·남성 필터) |

- 마지막으로 대화한 사람은 브라우저에 저장됩니다(`localStorage`). 상대를 바꾸면 대화가 처음부터 시작됩니다.
- 첫 메시지(greeting)는 화면에만 표시하고 API 히스토리에서는 뺍니다. 대신 서버 프롬프트에 넣어 대화가 이어지게 합니다.
- 알 수 없는 `personaId`는 400을 반환하고, 생략하면 기본 캐릭터로 처리합니다.

## 자원 폴더

```
public/avatar/personas/
  character_a/  portrait.webp   clips/idle.mp4, nod.mp4, shake.mp4, surprised.mp4, happy.mp4, sad.mp4, angry.mp4
  character_b/  portrait.webp   clips/...
  character_c/  portrait.jpg    clips/...
  character_d/  portrait.jpg    clips/...
  character_e ~ character_k/  portrait.jpg    clips/...
```

## 폴백 순서 (파일이 없거나 로딩 중일 때)

1. **클립:** `clips/` → `fallbackClipsDir`(지정한 경우) → 없음
2. **이벤트 클립이 없을 때:** 화면 전체에 가벼운 CSS 리액션(끄덕임, 도리도리, 놀람 등)
3. **idle 클립이 없을 때:** 정지 이미지 + 미세한 호흡 모션
4. **정지 이미지:** `poster` → `fallbackPoster` → 텍스트 카드(이니셜, 이름, "이미지 준비 중")

> ⚠️ `fallbackClipsDir` / `fallbackPoster`에는 **반드시 같은 인물의 자원만** 지정하세요. 다른 인물을 지정하면 선택한 캐릭터와 다른 얼굴이 재생됩니다.
> 현재 `character_a`만 기존 `/avatar/clips`(같은 노을 배경 캐릭터로 만든 임시 클립)를 폴백으로 씁니다.

## 캐릭터 추가하기

`personas/README.md`의 "캐릭터 추가" 절차를 따르세요.
