/**
 * 페르소나 공개 타입 (클라이언트·서버 공용, 데이터 없음).
 * 실제 데이터는 personas/<id>.json 에 있고, 서버(lib/personas/server.ts)가 읽어서
 * 화면에 필요한 공개 필드만 이 형태로 브라우저에 넘긴다. (프롬프트는 넘기지 않음)
 */
import type { TouchReactionId } from "@/config/reactions";
import type { AlbumItem } from "@/config/media";

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
  /** (자동) 💋 매혹 모드 영상 — clips/allure/ 폴더. 이름 앞에 "allure_" 가 붙는다 (예: allure_gaze) */
  allureClips: Record<string, string>;
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
  /** 🔑 치트룸 (치트 코드를 친 운영자에게만 목록에 보인다) */
  cheatRoom?: boolean;
  accent: string;
  assets: PersonaAssets;
  /** 미리 찍어 둔 사진·영상 */
  album: AlbumItem[];
  /** 화면 터치 반응 한마디 (인물별 덮어쓰기, 없으면 config/reactions.ts 기본값) */
  touchLines?: Partial<Record<TouchReactionId, string[]>>;
  /** 보이스톡 기본 목소리 이름 (personas/<id>.json voice.name, 없으면 성별 기본값) */
  voiceName: string;
  /** 💋 매혹 모드를 켤 수 있는 인물 */
  allure?: boolean;
  /** 매혹 모드 버튼·안내 이름 (남성 인물은 기본 "🌙 설렘 모드") */
  allureUi?: { emoji: string; label: string };
  /** 프로필 화면용 공개 정보 */
  /** 서사 (배경은 공개, 장은 호감도 min 이상에서 열린다) */
  story?: { background: string; chapters: { min: number; title: string; text: string }[] };
  details: { likes: string[]; dislikes: string[]; lifestyle: string };
  /** 인물 성향 중 화면에서 쓰는 것 (나머지는 서버 프롬프트에만) */
  traits: {
    gift: { name: string; emoji: string };
    reactionBias: Partial<Record<string, number>>;
    stageUpLines: string[];
  };
}
