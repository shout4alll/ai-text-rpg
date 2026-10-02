/**
 * 페르소나 공개 타입 (클라이언트·서버 공용, 데이터 없음).
 * 실제 데이터는 personas/<id>.json 에 있고, 서버(lib/personas/server.ts)가 읽어서
 * 화면에 필요한 공개 필드만 이 형태로 브라우저에 넘긴다. (프롬프트는 넘기지 않음)
 */
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
}
