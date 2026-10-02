# 실사 영상 아바타 가이드 (Flow / Veo)

3D 모델 대신, **내가 만든 캐릭터 이미지로 만든 짧은 영상 클립**을 상태별로 바꿔 재생합니다.
(`NEXT_PUBLIC_AVATAR_MODE` 기본값이 `video`. `3d`로 바꾸면 GLB 모델 모드로 돌아갑니다.)

## 동작 방식

- `idle.mp4`가 항상 루프 재생됩니다.
- 채팅 응답이 오면 `animation` / `emotion`에 맞는 클립이 **한 번** 위에 겹쳐 재생되고, 끝나면 idle로 돌아옵니다.
- 없는 클립은 자동으로 건너뜁니다. `idle`도 없으면 정지 이미지(`portrait.png`)에 미세한 호흡 모션만 줍니다.

| API 응답 | 재생 클립 |
| --- | --- |
| `animation: nod` | `nod` |
| `animation: shake` | `shake` |
| `animation: jump` | `surprised` (emotion이 `happy`면 `happy`) |
| `animation: idle` + emotion | `happy` / `sad` / `angry` / `surprised` (neutral이면 없음) |

## 필요한 클립 (`public/avatar/clips/`)

`idle`, `nod`, `shake`, `surprised`, `happy`, `sad`, `angry` — 각각 `.mp4` (H.264, 무음).
**현재 들어 있는 `idle/nod/shake/surprised`는 이미지를 확대·이동시킨 개발용 임시 클립입니다.** 표정이 바뀌지 않으니 실제 클립으로 같은 파일명으로 덮어쓰세요.
(임시 클립 재생성: `npm run gen:clips`, ffmpeg 필요)

## Flow(Veo)로 만들 때

Veo 3.1 API 문서 기준 사양입니다. Flow 화면의 메뉴 이름은 다를 수 있습니다.

- 비율 `16:9` / `9:16`, 길이 4·6·8초, 24fps, 720p 기본(1080p는 8초만)
- 시작 이미지(image-to-video), **첫/마지막 프레임 지정**, 참조 이미지(최대 3장) 지원. 첫/마지막 프레임과 참조 이미지는 8초 길이에서만 가능
- 오디오가 항상 생성되므로 후처리에서 제거

**권장 절차**

1. 왼쪽 패널이 세로에 가까우므로 **9:16(또는 4:5)** 로 만드세요. 현재 이미지(772×416 가로형)는 해상도가 낮아 확대하면 흐려집니다. 같은 캐릭터를 세로 구도·고해상도로 다시 뽑아 시작 이미지로 쓰는 것이 좋습니다.
2. **모든 클립에 같은 시작 이미지**를 쓰고, idle은 **첫 프레임 = 마지막 프레임**을 같은 이미지로 지정하면 이음새 없는 루프가 됩니다.
3. 이벤트 클립은 "마지막에 시작 자세로 돌아온다"고 프롬프트에 명시하세요. 그래야 idle로 복귀할 때 튀지 않습니다.

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
| angry | Her smile turns into an annoyed frown with furrowed brows and a short irritated glance, then she returns to the exact starting pose. |

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
| `NEXT_PUBLIC_AVATAR_CLIPS_BASE` | `/avatar/clips` | 클립 폴더 (외부 스토리지 URL 가능, CORS 필요) |
| `NEXT_PUBLIC_AVATAR_CLIP_EXT` | `mp4` | 클립 확장자 |
| `NEXT_PUBLIC_AVATAR_POSTER_URL` | `/avatar/portrait.png` | 정지 이미지 폴백 |
| `NEXT_PUBLIC_AVATAR_OBJECT_POSITION` | `64% 30%` | 얼굴이 잘리지 않게 하는 기준점 |

값은 빌드 시점에 반영되므로 변경 후 재배포하세요.

## 한계

- 미리 만든 클립을 고르는 방식이라 **대사에 맞춘 입모양(립싱크)과 음성은 없습니다.** 응답 텍스트는 채팅창에만 표시됩니다.
- 클립에 없는 동작(걷기, 임의의 몸짓 등)은 표현할 수 없습니다.
- 립싱크와 음성까지 원하면 실시간 AI 아바타 서비스(스트리밍 토킹헤드)나 TTS 연동이 별도로 필요합니다.
