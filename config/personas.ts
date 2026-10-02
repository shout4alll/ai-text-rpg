/**
 * 페르소나 공개 메타데이터 (클라이언트·서버 공용).
 *
 * - 여기에는 화면에 보여도 되는 정보만 둔다. (이름, 소개, 인사말, 자원 경로)
 * - 시스템 프롬프트(성격·말투·진행 규칙)는 서버 전용 파일 `config/personaPrompts.ts` 에 있다.
 *   → 프롬프트가 브라우저 JS 번들에 포함되지 않는다.
 *
 * 새 캐릭터 추가 방법
 *   1) PERSONA_IDS 에 id 추가
 *   2) 아래 PERSONAS 에 메타데이터 추가
 *   3) config/personaPrompts.ts 에 프롬프트 추가 (빠뜨리면 타입 에러로 알려줌)
 *   4) public/avatar/personas/<id>/ 에 portrait 이미지와 clips/*.mp4 배치
 */

export const PERSONA_IDS = ["character_a", "character_b", "character_c", "character_d"] as const;
export type PersonaId = (typeof PERSONA_IDS)[number];

export const DEFAULT_PERSONA_ID: PersonaId = "character_a";

export interface PersonaAssets {
  /** 정지 이미지 (클립이 없거나 로딩 중일 때 표시) */
  poster: string;
  /** 영상 클립 폴더. 파일명: idle / nod / shake / surprised / happy / sad / angry + 확장자 */
  clipsDir: string;
  /** object-fit: cover 시 얼굴이 잘리지 않도록 하는 기준점 (CSS object-position) */
  objectPosition: string;
  /**
   * (선택) 클립이 없을 때 대신 쓸 폴더.
   * ⚠️ 반드시 "같은 인물"의 클립만 지정할 것. 다른 인물 클립을 지정하면 선택한 캐릭터와 얼굴이 달라진다.
   */
  fallbackClipsDir?: string;
  /** (선택) 정지 이미지가 없을 때 대신 쓸 이미지. 마찬가지로 같은 인물만. */
  fallbackPoster?: string;
}

export interface Persona {
  id: PersonaId;
  /** 캐릭터 이름 */
  name: string;
  /** 한 줄 칭호 */
  title: string;
  /** 선택 화면 설명 */
  description: string;
  /** 선택 화면 태그 (말투 / 난이도 등) */
  tags: string[];
  /** 선택 직후 LLM 호출 없이 바로 보여주는 첫 대사. 서버 프롬프트에도 들어가 대화가 이어진다. */
  greeting: string;
  /** UI 강조색 (hex) */
  accent: string;
  assets: PersonaAssets;
}

const base = (id: PersonaId) => `/avatar/personas/${id}`;

export const PERSONAS: Record<PersonaId, Persona> = {
  character_a: {
    id: "character_a",
    name: "서하린",
    title: "노을빛 탑의 안내자",
    description: "다정하고 밝은 가이드. 막히면 먼저 힌트를 건네고, 실패해도 다독여 줘요.",
    tags: ["존댓말", "힌트 넉넉", "난이도 쉬움"],
    greeting:
      "안녕하세요, 저는 서하린이에요. 정신이 드셨어요? 여긴 오래된 탑 꼭대기 방이에요. 문은 잠겨 있고, 창밖으로 노을이 번지고 있어요. 우리, 같이 나가 봐요. 먼저 뭘 살펴볼까요?",
    accent: "#f59e0b",
    assets: {
      poster: `${base("character_a")}/portrait.webp`,
      clipsDir: `${base("character_a")}/clips`,
      objectPosition: "60% 35%",
      // 기존 /avatar/clips 는 이 캐릭터(노을 배경) 이미지로 만든 클립 → 같은 인물이므로 폴백으로 사용
      fallbackClipsDir: "/avatar/clips",
      fallbackPoster: "/avatar/portrait.png",
    },
  },
  character_b: {
    id: "character_b",
    name: "윤지아",
    title: "무심한 탑의 기록관",
    description: "말수 적고 시크한 기록관. 힌트에는 인색하고 판정은 엄격하지만, 은근히 챙겨 줘요.",
    tags: ["반말", "힌트 인색", "난이도 어려움"],
    greeting:
      "…깼네. 윤지아. 이 탑의 기록관이야. 문은 잠겼고 열쇠는 없어. 내가 대신 열어줄 생각도 없고. 알아서 찾아봐. 지켜보고는 있을게.",
    accent: "#94a3b8",
    assets: {
      poster: `${base("character_b")}/portrait.webp`,
      clipsDir: `${base("character_b")}/clips`,
      objectPosition: "52% 30%",
    },
  },
  character_c: {
    id: "character_c",
    name: "한소율",
    title: "엉뚱한 몽상가 마법사",
    description: "장난기 가득한 마법사. 황당한 행동일수록 좋아하고, 기발한 해법을 인정해 줘요.",
    tags: ["친근한 반말", "유머 많음", "난이도 보통"],
    greeting:
      "오, 일어났다! 나 한소율! 여기 좀 봐, 방이 통째로 뒤집혀 있어. 침대가 천장에 붙어 있다니까? 탈출하려면… 음, 일단 저 수상한 찻주전자한테 말 걸어볼래?",
    accent: "#a78bfa",
    assets: {
      poster: `${base("character_c")}/portrait.jpg`,
      clipsDir: `${base("character_c")}/clips`,
      objectPosition: "54% 30%",
    },
  },
  character_d: {
    id: "character_d",
    name: "정다온",
    title: "열정 만렙 추리 덕후",
    description: "단서만 보면 눈이 반짝이는 수다쟁이 탐정. 논리 퍼즐 중심이고, 단서를 정리해 줘요.",
    tags: ["해요체", "추리 중심", "난이도 보통"],
    greeting:
      "드디어 깨셨네요! 저 정다온이에요. 잠깐만요, 벌써 단서를 세 개나 찾았거든요! 벽의 숫자, 멈춘 시계, 반쯤 찢긴 쪽지. 이거 분명 다 연결돼 있어요. 어디부터 볼까요?",
    accent: "#34d399",
    assets: {
      poster: `${base("character_d")}/portrait.jpg`,
      clipsDir: `${base("character_d")}/clips`,
      objectPosition: "57% 38%",
    },
  },
};

export const PERSONA_LIST: Persona[] = PERSONA_IDS.map((id) => PERSONAS[id]);

export function isPersonaId(value: unknown): value is PersonaId {
  return typeof value === "string" && (PERSONA_IDS as readonly string[]).includes(value);
}

export function getPersona(id: PersonaId): Persona {
  return PERSONAS[id];
}
