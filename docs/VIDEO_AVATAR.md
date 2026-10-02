# 실사 영상 아바타 가이드 (AI 영상 생성 도구 공통)

3D 모델 대신, **내가 만든 캐릭터 이미지로 만든 짧은 영상 클립**을 상태별로 바꿔 재생합니다.
(`NEXT_PUBLIC_AVATAR_MODE` 기본값이 `video`. `3d`로 바꾸면 GLB 모델 모드로 돌아갑니다.)

## 동작 방식

- `idle` 영상이 항상 반복 재생됩니다. 없으면 정지 이미지에 미세한 호흡 모션만 줍니다.
- 답장이 오면 AI가 고른 **화면 리액션**(15종)에 맞는 영상을 한 번 재생하고 `idle`로 돌아옵니다.
- 영상이 없는 리액션은 화면 움직임과 효과(하트, 💢 등)로 대신합니다.
- **영상은 자동 인식됩니다.** 빌드할 때 `public/avatar/personas/<id>/clips/`를 스캔해서 실제로 있는 파일만 씁니다. 그래서 없는 파일을 요청하는 404가 생기지 않습니다.
- 리액션 목록과 영상 이름 규칙은 **`docs/REACTIONS.md`** 를 보세요.

## 필요한 클립 (`public/avatar/personas/<캐릭터id>/clips/`)

파일 이름은 리액션 id입니다: `idle`, `smile`, `laugh`, `nod`, `shake`, `shy`, `love`, `pout`, `surprised`, `sad`, `touched`, `thinking`, `excited`, `comfort`, `sleepy` (+ 확장자).
예전 이름인 `happy`, `angry`도 대체 순서에 포함되어 있어 그대로 쓸 수 있습니다.

## 영상 생성 도구는 아무거나 괜찮습니다

코드는 **mp4 파일만 있으면** 되므로 도구는 상관없습니다. (Flow/Veo, Kling, Runway, Luma, Hailuo, Seedance, Pika 등) 도구마다 기능과 요금이 자주 바뀌어서, 순위 대신 **고를 때 확인할 기준**을 적습니다.

| 기준 | 이유 |
| --- | --- |
| 이미지 → 영상(image-to-video) | 내 캐릭터 사진을 그대로 시작 프레임으로 써야 얼굴이 유지됨 |
| 세로(9:16) 출력 | 왼쪽 패널이 세로에 가까움. 가로만 되면 얼굴 중심으로 잘라 써야 해서 해상도 손해 |
| 카메라 고정(no camera move) 지시가 잘 먹는지 | 클립마다 구도가 달라지면 전환 때 튐 |
| 시작/끝 프레임 지정 | idle 이음새 없는 루프에 가장 쉬운 방법 (없으면 아래 핑퐁 루프 사용) |
| 얼굴 일관성 | 클립마다 얼굴이 조금씩 변하면 전환 때 다른 사람처럼 보임. 같은 시작 이미지로 여러 번 뽑아 가장 닮은 것 선택 |
| 720p 이상, 3~8초 | 클립당 용량과 화질의 균형 |
| 상업적 이용 / 워터마크 | 무료 플랜은 워터마크가 붙거나 상업 이용이 제한될 수 있으니 각 서비스 약관 확인 |

참고로 Google Veo 3.1 API 문서에는 비율 `16:9`/`9:16`, 길이 4·6·8초, 시작 이미지, 첫/마지막 프레임 지정, 참조 이미지(최대 3장)가 명시되어 있습니다. (첫/마지막 프레임·참조 이미지는 8초에서만 가능, 오디오는 항상 생성되므로 후처리에서 제거)

**권장 절차 (도구 공통)**

1. 먼저 **캐릭터 사진을 9:16(또는 4:5) 고해상도**로 만드세요. 현재 이미지(772×416 가로형)는 확대하면 흐려집니다. 같은 캐릭터를 세로 구도로 다시 뽑아 이 이미지를 모든 클립의 시작 프레임으로 씁니다.
2. 클립마다 **같은 시작 이미지**를 쓰고, 아래 프롬프트로 하나씩 생성합니다.
3. 이벤트 클립은 "마지막에 시작 자세로 돌아온다"고 프롬프트에 명시하세요. 그래야 idle로 복귀할 때 튀지 않습니다.
4. **idle 루프:** 도구가 끝 프레임 지정을 지원하면 첫 프레임 = 마지막 프레임으로 같은 이미지를 지정하세요. 지원하지 않으면 정방향 + 역방향을 이어 붙이는 핑퐁 루프를 쓰면 됩니다.

```bash
ffmpeg -i idle_raw.mp4 -filter_complex "[0:v]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[v]" -map "[v]" -an -c:v libx264 -pix_fmt yuv420p idle_loop.mp4
```

**공통 프롬프트 머리말**

> Static locked-off camera, no zoom, no pan, no cuts. Keep the exact same framing, background, lighting, outfit and face as the first frame. No text, no subtitles, no speech.

**클립별 프롬프트 (머리말 뒤에 붙임)**

| 클립 | 프롬프트 |
| --- | --- |
| idle | The woman stays naturally in place with subtle breathing, soft natural blinks, a gentle smile, and hair moving slightly in the breeze. She ends in exactly the starting pose so the clip loops seamlessly. |
| nod | She nods her head gently twice in agreement while smiling, then returns to the exact starting pose. |
| shake | She slowly shakes her head side to side twice with a slightly apologetic smile, then returns to the exact starting pose. |
| surprised | Her eyes widen and eyebrows rise in sudden surprise, mouth slightly open, leaning back a little, then she relaxes back to the exact starting pose. |
| happy | She bursts into a warm laugh, eyes crinkling with joy, then settles back to the exact starting pose. |
| sad | Her smile fades into a sad, downcast expression with lowered eyes, then she slowly returns to the exact starting pose. |
| angry / pout | Her smile turns into a cute, pouty sulk with a slight frown, then she returns to the exact starting pose. |
| smile | She smiles softly and warmly at the camera, then returns to the exact starting pose. |
| laugh | She laughs out loud naturally, shoulders shaking a little, then settles back to the exact starting pose. |
| shy | She looks down shyly with a bashful smile, tucking her hair behind her ear, then returns to the exact starting pose. |
| love | Her eyes soften and she smiles tenderly, a little flustered with affection, then returns to the exact starting pose. |
| touched | Her eyes glisten as she is moved, hand on her chest, then she returns to the exact starting pose. |
| thinking | She tilts her head and looks up thoughtfully, then returns to the exact starting pose. |
| excited | She lights up and does a small excited cheer, then returns to the exact starting pose. |
| comfort | She gives a gentle, reassuring nod with a warm look, then returns to the exact starting pose. |
| sleepy | She yawns softly and rubs her eyes, then returns to the exact starting pose. |

## 후처리 (무음 + 용량 축소)

```bash
# 이벤트 클립: 앞 2.5초만, 무음, 720폭
ffmpeg -i nod_raw.mp4 -t 2.5 -an -vf scale=720:-2 -c:v libx264 -crf 23 -pix_fmt yuv420p -movflags +faststart nod.mp4

# idle: 전체 길이 유지
ffmpeg -i idle_raw.mp4 -an -vf scale=720:-2 -c:v libx264 -crf 23 -pix_fmt yuv420p -movflags +faststart idle.mp4
```

클립당 1~3MB 안팎을 권장합니다. 클립은 모두 미리 로드되므로 총량이 너무 크면 첫 화면이 느려집니다.

## 환경변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `NEXT_PUBLIC_AVATAR_MODE` | `video` | `video` 또는 `3d` |
| `NEXT_PUBLIC_AVATAR_CLIP_EXT` | `mp4` | 클립 확장자 |

값은 빌드 시점에 반영되므로 변경 후 재배포하세요.

## 한계

- 미리 만든 클립을 고르는 방식이라 **대사에 맞춘 입모양(립싱크)과 음성은 없습니다.** 응답 텍스트는 채팅창에만 표시됩니다.
- 클립에 없는 동작(걷기, 임의의 몸짓 등)은 표현할 수 없습니다.
- 립싱크와 음성까지 원하면 실시간 AI 아바타 서비스(스트리밍 토킹헤드)나 TTS 연동이 별도로 필요합니다.
