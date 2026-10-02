# 멀티 페르소나 시스템

## 캐릭터 (모두 가상 인물, 판타지 방탈출 TRPG의 GM 역할)

| id | 이름 | 나이·직업 | 말투 | 난이도 |
| --- | --- | --- | --- | --- |
| `character_a` | 서하린 | 29 · 배우(연예인) | 존댓말 | 쉬움 |
| `character_b` | 윤지아 | 33 · 주부(전직 사서) | 반말 | 어려움 |
| `character_c` | 한소율 | 27 · 직장인(게임 기획자) | 친근한 반말 | 보통 |
| `character_d` | 정다온 | 22 · 대학생(방탈출 동아리 회장) | 해요체 | 보통 |

모든 캐릭터에 공통 규칙(`PERSONA_COMMON_RULES`)이 붙습니다.
- 직업은 말투와 비유에 자연스럽게 묻어나는 정도로만 씁니다.
- 고정관념에 기대는 농담은 하지 않습니다.
- 실존 인물·회사·작품 이름은 언급하지 않습니다.

## 구조

| 파일 | 역할 |
| --- | --- |
| `config/personas.ts` | **공개** 메타데이터: id, 이름, 칭호, 설명, 태그, 첫 인사말, 강조색, 이미지·클립 경로 (브라우저에 포함됨) |
| `config/personaPrompts.ts` | **서버 전용** 프롬프트(+ 공통 규칙): 정체, 성격, 말투, 진행 성향, 말투 예시, temperature (`import "server-only"` 로 브라우저 번들 포함 차단) |
| `app/api/chat/route.ts` | 요청의 `personaId` 검증 → 해당 캐릭터 프롬프트 + 공통 규칙으로 시스템 프롬프트 구성 |
| `components/PersonaSelector.tsx` | 첫 방문 시 전체 화면 선택창 / 진행 중엔 "캐릭터 변경" 모달 |
| `components/PersonaPortrait.tsx` | 정지 이미지 + 폴백(이미지 → 같은 인물 대체 이미지 → 텍스트 카드) |
| `components/VideoAvatar.tsx` | 캐릭터별 클립 재생 + 폴백 |

- 선택한 캐릭터는 브라우저 `localStorage`(`ai-rpg.personaId`)에 저장되어 새로고침해도 유지됩니다.
- 캐릭터를 바꾸면 대화와 HP가 초기화되고 그 캐릭터의 인사말로 새로 시작합니다.
- 인사말은 화면에만 표시하고 API 히스토리에는 넣지 않습니다. 대신 서버 프롬프트에 "이 대사로 시작했다"고 넣어 이야기가 이어집니다.
- 알 수 없는 `personaId`는 400, 생략하면 기본 캐릭터(`character_a`)입니다.

## 자원 폴더

```
public/avatar/personas/
  character_a/  portrait.webp   clips/idle.mp4, nod.mp4, shake.mp4, surprised.mp4, happy.mp4, sad.mp4, angry.mp4
  character_b/  portrait.webp   clips/...
  character_c/  portrait.jpg    clips/...
  character_d/  portrait.jpg    clips/...
```

## 폴백 순서 (파일이 없거나 로딩 중일 때)

1. **클립:** `clips/` → `fallbackClipsDir`(지정한 경우) → 없음
2. **이벤트 클립이 없을 때:** 화면 전체에 가벼운 CSS 리액션(끄덕임, 도리도리, 놀람 등)
3. **idle 클립이 없을 때:** 정지 이미지 + 미세한 호흡 모션
4. **정지 이미지:** `poster` → `fallbackPoster` → 텍스트 카드(이니셜, 이름, "이미지 준비 중")

> ⚠️ `fallbackClipsDir` / `fallbackPoster`에는 **반드시 같은 인물의 자원만** 지정하세요. 다른 인물을 지정하면 선택한 캐릭터와 다른 얼굴이 재생됩니다.
> 현재 `character_a`만 기존 `/avatar/clips`(같은 노을 배경 캐릭터로 만든 임시 클립)를 폴백으로 씁니다.

## 캐릭터 추가하기

1. `config/personas.ts`의 `PERSONA_IDS`에 id 추가 → `PERSONAS`에 메타데이터 추가
2. `config/personaPrompts.ts`에 같은 id로 프롬프트 추가 (빠뜨리면 타입 에러로 알려줌)
3. `public/avatar/personas/<id>/`에 portrait 이미지와 `clips/` 배치
4. `objectPosition`으로 얼굴이 왼쪽 패널 중앙에 오도록 조정 (예: `"55% 30%"`)
