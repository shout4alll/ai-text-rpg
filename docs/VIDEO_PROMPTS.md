# 🎬 리액션 영상 만들기 — 최윤서(character_g) · 김도현(character_h)

**만드는 순서**
1. 시작 이미지는 `video-src/<id>/start.jpg`(720×1280, 세로)를 씁니다. 모든 클립을 같은 시작 이미지로 만들어야 전환이 매끄럽습니다.
2. 이미지 기반 비디오 · 4~6초 · 세로 9:16 으로 아래 프롬프트를 넣어 생성하고 내려받습니다.
3. 파일 이름을 표의 **파일** 이름으로 저장해 `video-src/<id>/raw/` 에 넣으면, 변환(720p·소리 음량 맞춤·idle 루프·stage.jpg)은 Claude 에게 맡기거나 `docs/REACTION_VIDEOS.md` §4 명령으로 직접 합니다.
4. 변환본은 `public/avatar/personas/<id>/clips/` (유료는 `clips/premium/`, 매혹은 `clips/allure/`) → 재배포. 코드 수정은 필요 없습니다.

공통 끝 문구 (옷·얼굴이 바뀌지 않게): `Same person, same outfit and same setting as the reference image. Natural, realistic, subtle movement. Camera stays still.`
매혹·설렘 클립에는 추가로: `Fully clothed in the same outfit, tasteful and elegant.`

---

## 최윤서 (character_g) — 7종 + 매혹 3종

시작 이미지: `video-src/character_g/start.jpg` (사무실 책상, 네이비 재킷)

| # | 파일 | 장면 | 프롬프트 |
| --- | --- | --- | --- |
| 1 | `idle.mp4` | 대기 (루프) | She sits calmly at her desk, breathing softly, with a relaxed confident smile, blinking naturally and looking at the camera. |
| 2 | `shy.mp4` | 부끄러움 | She looks at the camera, then glances down with an unexpectedly bashful smile, tucks her hair behind her ear, and looks back up with a small embarrassed laugh. |
| 3 | `laugh.mp4` | 웃음 | She laughs openly and warmly, leaning back slightly in her chair, eyes crinkling, then smiles at the camera. |
| 4 | `love.mp4` | 설렘 | She rests her chin on her hand and gazes at the camera with warm, affectionate eyes and a slow, knowing smile. |
| 5 | `pout.mp4` | 토라짐 | She folds her arms, raises one eyebrow and gives a mock-stern, playfully sulky look, then glances away. |
| 6 | `turn_away.mp4` | 등 돌림 | She sighs quietly, turns her chair and shoulders away from the camera and looks out the window. The last frame shows her turned away. |
| 7 | `premium/kiss.mp4` | 뽀뽀 (유료) | She smiles confidently, touches her fingertips to her lips and blows a kiss toward the camera, then gives a playful wink. |
| + | `allure/gaze.mp4` | 매혹: 그윽한 눈빛 | She slowly leans forward over the desk toward the camera, tilts her head and gives a slow, confident, alluring smile with half-lidded eyes. |
| + | `allure/wine.mp4` | 매혹: 와인 | She lifts a glass of red wine, takes a slow sip while holding eye contact with the camera, then smiles with a teasing look. |
| + | `allure/hair.mp4` | 매혹: 머리 넘기기 | She slowly runs her fingers through her hair, glances away, then looks back at the camera with a knowing, inviting gaze. |

## 김도현 (character_h) — 7종 + 설렘 3종

시작 이미지: `video-src/character_h/start.jpg` (거실, 회색 가디건 · 전신). 얼굴 표정이 잘 보이게 하려면 프롬프트 앞에 `Medium shot, the camera slowly pushes in to waist-up.` 를 붙여도 됩니다(모든 클립에 똑같이).

| # | 파일 | 장면 | 프롬프트 |
| --- | --- | --- | --- |
| 1 | `idle.mp4` | 대기 (루프) | He stands relaxed in the living room with one hand in his pocket, breathing softly, smiling gently at the camera. |
| 2 | `shy.mp4` | 부끄러움 | He looks at the camera, then glances down with a bashful smile, rubs the back of his neck, and looks back up shyly. |
| 3 | `laugh.mp4` | 웃음 | He laughs warmly with a genuine eye smile, head tilting back slightly, then smiles at the camera. |
| 4 | `love.mp4` | 설렘 | He gazes at the camera with soft, affectionate eyes and a slow warm smile, as if looking at someone he adores. |
| 5 | `pout.mp4` | 토라짐 | He puts on a playful sulky face, looks away with a small frown, then sneaks a glance back at the camera. |
| 6 | `turn_away.mp4` | 등 돌림 | He turns his head and shoulders away from the camera with a quiet, hurt expression. The last frame shows him turned away. |
| 7 | `premium/kiss.mp4` | 뽀뽀 (유료) | He smiles softly, closes his eyes and blows a gentle kiss toward the camera, then smiles shyly. |
| + | `allure/gaze.mp4` | 설렘: 눈맞춤 | He slowly walks a step toward the camera with a calm, confident and tender gaze, a slight smile at the corner of his lips. |
| + | `allure/sleeve.mp4` | 설렘: 소매 걷기 | He casually rolls up his cardigan sleeve while looking at the camera, then gives a relaxed, warm half-smile. |
| + | `allure/hair.mp4` | 설렘: 머리 넘기기 | He sweeps his hair back with one hand, looks down, then looks up at the camera with a soft, low laugh. |

---

## 윤지아 (character_b) — 추가 12종 (기존: idle·shy·laugh·love·pout·turn_away·touch_joy·allure gaze/hair/lip)

시작 이미지: `public/avatar/personas/character_b/stage.jpg` (또는 `video-src/character_b/start.jpg` 로 복사). 모든 프롬프트 끝에 공통 끝 문구 + `Fully clothed in the same outfit, tasteful and elegant.`

| # | 파일 | 장면 | 프롬프트 |
| --- | --- | --- | --- |
| 1 | `surprise.mp4` | 깜짝 | Her eyes widen in surprise, she covers her mouth with one hand, then breaks into a delighted laugh. |
| 2 | `tease.mp4` | 놀리기 | She tilts her head, raises one eyebrow with a dry, teasing smirk, and points a finger at the camera as if saying "gotcha". |
| 3 | `wink.mp4` | 윙크 | She gives a slow confident wink with a sly smile, then looks away and smiles to herself. |
| 4 | `angry.mp4` | 발끈 | She frowns, puffs her cheeks in mock anger, crosses her arms and shakes her head, then fails to hold back a smile. |
| 5 | `teary.mp4` | 울컥 | Her eyes grow glossy and moist, she presses her lips together, blinks slowly, then smiles through it softly. |
| 6 | `hug.mp4` | 안아주기 | She opens both arms toward the camera with a warm inviting smile, as if offering a hug. |
| 7 | `whisper.mp4` | 속삭임 | She leans close to the camera, cups a hand beside her mouth and whispers a secret with a playful glint in her eyes. |
| 8 | `premium/kiss.mp4` | 뽀뽀 (유료) | She smiles softly, touches her fingertips to her lips and blows a kiss toward the camera, then gives a shy wink. |
| 9 | `allure/shoulder.mp4` | 매혹: 어깨너머 | She slowly looks back over her shoulder at the camera with a languid, inviting smile and half-lidded eyes. |
| 10 | `allure/wine.mp4` | 매혹: 와인 | She swirls a glass of red wine, takes a slow sip while holding eye contact, then smiles with a teasing look. |
| 11 | `allure/lean.mp4` | 매혹: 다가옴 | She leans in slowly toward the camera, chin resting on her hand, gazing with a soft, knowing, slightly daring smile. |
| 12 | `allure/stretch.mp4` | 매혹: 나른한 기지개 | She stretches lazily with her arms above her head, relaxes, and gives the camera a sleepy, warm, alluring smile. |

## 한소율 (character_c) — 추가 12종 (기존: idle·shy·laugh·love·pout·turn_away·premium kiss)

시작 이미지: `public/avatar/personas/character_c/stage.jpg`. 프롬프트 끝에 공통 끝 문구 + `Fully clothed in the same outfit, tasteful and elegant.`

| # | 파일 | 장면 | 프롬프트 |
| --- | --- | --- | --- |
| 1 | `surprise.mp4` | 깜짝 | Her eyes go wide, she gasps and clasps both hands to her cheeks, then bursts into an excited laugh. |
| 2 | `tease.mp4` | 놀리기 | She sticks out her tongue slightly with a cheeky grin and flicks a playful finger toward the camera. |
| 3 | `wink.mp4` | 윙크 | She winks with a bright playful smile and makes a small finger heart. |
| 4 | `angry.mp4` | 발끈 | She puffs her cheeks, stamps lightly and frowns in an adorable mock-angry way, then cracks a smile. |
| 5 | `teary.mp4` | 울컥 | Her eyes well up, she wipes the corner of an eye with a finger and smiles through the tears. |
| 6 | `hug.mp4` | 안아주기 | She opens both arms wide toward the camera with a big warm smile, as if asking for a hug. |
| 7 | `whisper.mp4` | 속삭임 | She leans toward the camera, covers her mouth with one hand and whispers a secret, eyes sparkling. |
| 8 | `cheer.mp4` | 응원 | She pumps both fists with an encouraging bright smile, bouncing slightly. |
| 9 | `allure/gaze.mp4` | 매혹: 그윽한 눈빛 | She slowly leans toward the camera, tilts her head and gives a slow, bold, alluring smile with half-lidded eyes. |
| 10 | `allure/hair.mp4` | 매혹: 머리 넘기기 | She runs her fingers slowly through her hair, glances away, then looks back with a daring, inviting gaze. |
| 11 | `allure/lip.mp4` | 매혹: 입술 | She lightly bites her lower lip with a mischievous smile, then breaks into a soft laugh. |
| 12 | `allure/shoulder.mp4` | 매혹: 어깨너머 | She looks back over her shoulder at the camera with a slow, confident, sultry smile. |

- 크레딧: Stardream 2.5 이미지→비디오 1건당 812 (⚡). 한 번에 몇 건 만들 수 있는지는 충전 후 알려 주세요.

---

- 영상이 없는 리액션은 움직임·이모지로 자동 대체되므로, 일부만 먼저 넣어도 됩니다 (우선순위: idle → shy·laugh·love·pout → turn_away → kiss → 매혹).
- 생성 도구의 워터마크가 있으면 상용 전에 워터마크 없는 플랜으로 다시 뽑는 걸 권장합니다.
- `video-src/` 는 원본 보관용입니다(앱에 포함되지 않음).
