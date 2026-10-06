/**
 * 페르소나 공개 타입 (클라이언트·서버 공용, 데이터 없음).
 * 실제 데이터는 personas/<id>.json 에 있고, 서버(lib/personas/server.ts)가 읽어서
 * 화면에 필요한 공개 필드만 이 형태로 브라우저에 넘긴다. (프롬프트는 넘기지 않음)
 */
import type { TouchReactionId } from "@/config/reactions";

export type PersonaId = string;

export interface PersonaAssets {
  /** 정지 이미지 URL */
  poster: string;
  /**
   * 실제로 존재하는 영상 클립 (이름 → URL). 빌드 시 clips 폴더를 스캔해 자동으로 채운다.
   * 이름은 config/reactions.ts 의 리액션 id 또는 clips 대체 이름 (idle, nod, shy, love ...)
   */
  clips: Record<string, string>;
  /** object-fit: cover 기준점 (CSS object-position) */
  objectPosition: string;
  /**
   * (자동) 리액션 화면 전용 정지 이미지 — public/avatar/personas/<id>/stage.jpg 가 있으면 사용.
   * 영상 첫 장면과 같은 구도의 이미지를 넣으면 영상 전환이 자연스럽다.
   */
  stagePoster?: string;
  /** 리액션 화면(영상·stage 이미지)의 기준점 */
  stagePosition: string;
  /** (자동) 유료 리액션 영상 — clips/premium/ 폴더. 이용권이 있을 때만 재생 */
  premiumClips: Record<string, string>;
  /** (선택) 같은 인물의 대체 이미지 */
  fallbackPoster?: string;
}

export interface Persona {
  id: PersonaId;
  name: string;
  /** 메신저 상태메시지 */
  status: string;
  profile: { age: number; occupation: string; gender: "female" | "male" };
  description: string;
  tags: string[];
  relationshipType: "romance" | "friendship";
  /** 첫 메시지 (LLM 호출 없이 바로 표시) */
  greeting: string;
  accent: string;
  assets: PersonaAssets;
  /** 화면 터치 반응 한마디 (인물별 덮어쓰기, 없으면 config/reactions.ts 기본값) */
  touchLines?: Partial<Record<TouchReactionId, string[]>>;
}
