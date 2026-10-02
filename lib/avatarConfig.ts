/**
 * 아바타 모델 설정.
 *
 * NEXT_PUBLIC_AVATAR_MODEL_URL : 캐릭터 GLB 경로/URL (기본: 플레이스홀더)
 * NEXT_PUBLIC_AVATAR_IDLE_URL  : (선택) idle 클립만 들어 있는 별도 GLB. Mixamo 애니메이션용.
 *
 * 값은 빌드 시점에 인라인되므로 변경 후 재배포가 필요하다.
 */
export const AVATAR_MODEL_URL =
  process.env.NEXT_PUBLIC_AVATAR_MODEL_URL || "/models/placeholder.glb";

export const AVATAR_IDLE_URL: string | undefined =
  process.env.NEXT_PUBLIC_AVATAR_IDLE_URL || undefined;

/** 모델을 이 키(m)로 자동 스케일 → 모델 원본 단위(cm/m)와 무관하게 동일하게 보인다. */
export const AVATAR_HEIGHT = 1.7;

/** 바닥 평면의 y 좌표 (AvatarScene의 바닥과 동일) */
export const FLOOR_Y = -0.7;

/* -------------------------------------------------------------------------- */
/*  영상(실사) 아바타 설정                                                       */
/* -------------------------------------------------------------------------- */

/** "video"(기본, 실사 영상 클립) | "3d"(GLB 모델) */
export const AVATAR_MODE: "video" | "3d" =
  process.env.NEXT_PUBLIC_AVATAR_MODE === "3d" ? "3d" : "video";

/** 클립 폴더 (idle / nod / shake / surprised / happy / sad / angry + 확장자) */
export const AVATAR_CLIPS_BASE =
  process.env.NEXT_PUBLIC_AVATAR_CLIPS_BASE || "/avatar/clips";
export const AVATAR_CLIP_EXT = process.env.NEXT_PUBLIC_AVATAR_CLIP_EXT || "mp4";

/** 클립이 없거나 로딩 중일 때 보여줄 정지 이미지 */
export const AVATAR_POSTER_URL =
  process.env.NEXT_PUBLIC_AVATAR_POSTER_URL || "/avatar/portrait.png";

/** object-fit: cover 시 얼굴이 잘리지 않도록 하는 기준점 */
export const AVATAR_OBJECT_POSITION =
  process.env.NEXT_PUBLIC_AVATAR_OBJECT_POSITION || "64% 30%";
