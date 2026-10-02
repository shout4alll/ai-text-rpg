# 실사형 아바타 교체 가이드

현재 `public/models/placeholder.glb`(idle 클립이 들어간 블록형 휴머노이드)가 기본값입니다.
실제 캐릭터 GLB를 준비해서 아래 순서로 교체하세요.

## 1. 모델 준비 (소싱 시 주의)

- **Ready Player Me는 2026-01-31에 서비스가 종료**되어 새 아바타를 만들 수 없습니다. (이전에 내려받은 GLB 파일은 그대로 사용 가능)
- 실사형 GLB를 얻을 수 있는 경로: MetaPerson, Avaturn(웹 SDK, 유료 플랜 있음), Sketchfab 등의 CC/상용 라이선스 모델, Mixamo 캐릭터, 직접 제작(Blender, Character Creator 등).
- **라이선스 확인은 필수입니다.** 예를 들어 Mixamo 에셋은 상업 이용은 가능하지만 **원본 파일을 단독 에셋으로 재배포할 수 없습니다.** 공개 GitHub 저장소에 원본 GLB를 그대로 올리면 위반일 수 있으니, 비공개 저장소를 쓰거나 파일을 별도 스토리지(Vercel Blob, R2, S3 등)에 두고 URL만 환경변수로 지정하세요.

## 2. 모델 요구사항

| 항목 | 요구사항 |
| --- | --- |
| 포맷 | `.glb` (glTF 2.0 binary) |
| 방향 | 정면이 +Z (대부분의 내보내기 기본값) |
| 본 이름 | 머리 본 이름이 `Head`로 끝나야 고개 동작(nod/shake)이 머리에 적용됨 (`Head`, `mixamorigHead` 등). 없으면 몸 전체로 대체 |
| idle 클립 | 클립 이름에 `idle`이 들어 있으면 그것을, 없으면 첫 번째 클립을 재생 |
| 표정(선택) | ARKit 블렌드셰이프(`mouthSmileLeft`, `browInnerUp`, `jawOpen` 등)가 있으면 emotion에 따라 자동 반영 |
| 용량 | 10MB 이하 권장 |

모델 크기는 자동으로 키 1.7m 기준으로 맞춰지고 발바닥이 바닥에 정렬됩니다. (cm/m 단위 차이를 신경 쓰지 않아도 됨)

## 3. 최적화 (권장)

```bash
npx @gltf-transform/cli optimize avatar.glb avatar.min.glb --compress meshopt --texture-compress webp
```

`meshopt` 압축은 `drei`의 `useGLTF`가 추가 설정 없이 디코딩합니다. (Draco는 디코더 파일을 CDN에서 받으므로 오프라인/사내망에서는 `useGLTF.setDecoderPath`로 자체 호스팅 필요)

## 4. 적용

**A. 같은 저장소에 파일로 넣는 경우 (비공개 저장소 권장)**

1. 파일을 `public/models/avatar.glb`로 복사
2. `.env.local` (Vercel은 Environment Variables)에 `NEXT_PUBLIC_AVATAR_MODEL_URL=/models/avatar.glb`
3. 재배포 (이 값은 **빌드 시점에 인라인**되므로 변경 후 반드시 재배포)

**B. 외부 스토리지를 쓰는 경우**

`NEXT_PUBLIC_AVATAR_MODEL_URL=https://.../avatar.glb` (CORS 허용 필요)

## 5. idle 애니메이션이 모델에 없는 경우 (Mixamo 등)

1. Mixamo에서 idle 애니메이션을 "Without Skin"으로 받아 GLB로 변환
2. `NEXT_PUBLIC_AVATAR_IDLE_URL`에 해당 GLB 경로 지정

클립의 `mixamorig` 접두어는 자동 제거되고, 리그마다 단위가 달라 모델이 날아가는 문제를 막기 위해 `position`/`scale` 트랙은 제외됩니다. 따라서 모델 쪽 본 이름이 접두어 없는 `Hips`, `Spine`... 형태여야 합니다. (Mixamo 캐릭터를 그대로 쓰는 경우에는 모델 자체에 클립을 넣는 편이 간단합니다)

## 6. 문제 해결

- 모델이 안 뜨고 **큐브가 보임**: 모델 로드 실패 폴백입니다. 브라우저 콘솔의 `[Avatar] model load failed` 로그와 URL/CORS를 확인하세요.
- 모델이 **너무 작거나 크게** 보임: 자동 스케일이 키를 기준으로 하므로, 모델에 큰 배경 메쉬나 소품이 포함되어 있지 않은지 확인하세요.
- **움직이지 않음**: 콘솔에서 GLB에 `animations`가 있는지 확인하세요. (https://gltf.report 등에서 클립 목록 확인 가능)
