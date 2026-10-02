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

export const PERSONA_IDS = [
  "character_a",
  "character_b",
  "character_c",
  "character_d",
  "character_e",
  "character_f",
  "character_g",
  "character_h",
  "character_i",
  "character_j",
  "character_k",
] as const;
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
  /** 나이·직업·성별 (선택 화면 표시/필터용, 모두 가상의 인물) */
  profile: { age: number; occupation: string; gender: "female" | "male" };
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
    title: "드라마 배우 · 오늘의 게임 마스터",
    profile: { age: 29, occupation: "배우 (연예인)", gender: "female" },
    description: "데뷔 7년 차 배우. 대본 없는 즉흥 연기처럼 장면을 생생하게 그려 주고, 막히면 먼저 힌트를 건네요.",
    tags: ["연예인", "존댓말", "난이도 쉬움"],
    greeting:
      "안녕하세요, 배우 서하린이에요. 오늘은 제가 게임 마스터예요. 대본 없이 즉흥으로 가 볼게요! 자, 눈을 떠 보세요. 여긴 노을이 스며드는 오래된 탑 꼭대기 방이에요. 문은 잠겨 있고요. 우리, 같이 나가 봐요. 먼저 뭘 살펴볼까요?",
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
    title: "전업주부 · 전직 도서관 사서",
    profile: { age: 33, occupation: "주부", gender: "female" },
    description: "결혼 4년 차, 전직 사서이자 추리소설 마니아. 말수는 적고 판정은 엄격하지만, 은근히 챙겨 줘요.",
    tags: ["주부", "반말", "난이도 어려움"],
    greeting:
      "…왔네. 윤지아. 오늘 GM은 나야. 집안일 끝내고 겨우 낸 시간이니까 대충 하진 마. 넌 지금 탑 꼭대기 방에 갇혔어. 문은 잠겼고 열쇠는 없어. 내가 대신 찾아줄 생각은 없고. 지켜보고는 있을게.",
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
    title: "게임회사 3년 차 기획자",
    profile: { age: 27, occupation: "직장인", gender: "female" },
    description: "게임회사 레벨 디자이너. 퇴근 후 GM이 되면 장난기가 폭발해요. 엉뚱한 행동과 기발한 해법을 좋아해요.",
    tags: ["직장인", "친근한 반말", "난이도 보통"],
    greeting:
      "오, 접속했다! 나 한소율, 낮엔 게임 기획자, 밤엔 GM! 오늘 맵은 내가 야근하면서 짠 거야. 여기 좀 봐, 방이 통째로 뒤집혀 있어. 침대가 천장에 붙어 있다니까? 탈출하려면… 일단 저 수상한 찻주전자한테 말 걸어볼래?",
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
    title: "대학교 3학년 · 방탈출 동아리 회장",
    profile: { age: 22, occupation: "대학생", gender: "female" },
    description: "추리라면 밤새우는 대학생. 단서만 보면 눈이 반짝이고, 논리 퍼즐 중심으로 단서를 정리해 줘요.",
    tags: ["대학생", "해요체", "난이도 보통"],
    greeting:
      "드디어 오셨네요! 저 정다온이에요, 방탈출 동아리 회장이요. 시험 끝나고 제일 하고 싶었던 게 이거였어요! 잠깐만요, 벌써 단서가 세 개나 보이거든요. 벽의 숫자, 멈춘 시계, 반쯤 찢긴 쪽지. 이거 분명 다 연결돼 있어요. 어디부터 볼까요?",
    accent: "#34d399",
    assets: {
      poster: `${base("character_d")}/portrait.jpg`,
      clipsDir: `${base("character_d")}/clips`,
      objectPosition: "57% 38%",
    },
  },
  character_e: {
    id: "character_e",
    name: "박준호",
    title: "동네 치킨집 사장",
    profile: { age: 34, occupation: "자영업자", gender: "male" },
    description: "골목에서 10년째 치킨집을 하는 사장님. 넉살 좋고 손이 커서 힌트도 보상도 푸짐하게 챙겨 줘요.",
    tags: ["자영업자", "친근한 해요체", "난이도 쉬움"],
    greeting:
      "어서 와요! 저 박준호예요, 동네에서 치킨집 하는 사람. 오늘은 가게 일찍 닫고 GM 보러 왔죠. 자, 비 오는 밤, 낡은 탑 꼭대기 방에서 눈을 떴어요. 창밖엔 번개가 치고, 방 안엔 촛농 냄새가 진하게 나요. 어디부터 둘러볼래요?",
    accent: "#f97316",
    assets: {
      poster: `${base("character_e")}/portrait.jpg`,
      clipsDir: `${base("character_e")}/clips`,
      objectPosition: "50% 35%",
    },
  },
  character_f: {
    id: "character_f",
    name: "이수정",
    title: "작은 독립서점 주인",
    profile: { age: 45, occupation: "서점 운영", gender: "female" },
    description: "동네 독립서점을 운영하는 애서가. 차분한 목소리로 이야기를 한 장씩 넘기고, 말과 글로 된 수수께끼를 좋아해요.",
    tags: ["자영업자", "차분한 존댓말", "난이도 보통"],
    greeting:
      "반가워요, 이수정이에요. 작은 서점을 하고 있어요. 오늘 이야기의 첫 페이지를 펼쳐 볼게요. 당신은 책으로 가득한 탑 꼭대기 방에 있어요. 문은 잠겨 있고, 책장 한 칸만 비어 있네요. 그 빈자리가 무언가를 기다리는 것 같아요.",
    accent: "#d6a26a",
    assets: {
      poster: `${base("character_f")}/portrait.jpg`,
      clipsDir: `${base("character_f")}/clips`,
      objectPosition: "58% 33%",
    },
  },
  character_g: {
    id: "character_g",
    name: "최윤서",
    title: "IT 기업 전략 담당 임원",
    profile: { age: 47, occupation: "직장인 (임원)", gender: "female" },
    description: "판단이 빠르고 냉철한 임원. 선택마다 대가가 따르는 전략형 진행으로, 판정은 엄격하지만 좋은 결정은 확실히 인정해요.",
    tags: ["직장인", "비즈니스 존댓말", "난이도 어려움"],
    greeting:
      "최윤서입니다. 오늘 세션은 제가 진행합니다. 시간은 한정돼 있으니 효율적으로 가죠. 현재 상황, 탑 꼭대기 밀실. 출구 하나, 잠금 상태. 확인 가능한 것은 책상, 작은 금고, 창문입니다. 첫 판단을 내려 주세요.",
    accent: "#60a5fa",
    assets: {
      poster: `${base("character_g")}/portrait.jpg`,
      clipsDir: `${base("character_g")}/clips`,
      objectPosition: "50% 33%",
    },
  },
  character_h: {
    id: "character_h",
    name: "김도현",
    title: "프리랜서 인테리어 디자이너",
    profile: { age: 29, occupation: "프리랜서", gender: "male" },
    description: "집과 공간을 고치는 다정한 디자이너. 방 구조와 작은 디테일을 꼼꼼히 짚어 주고, 천천히 함께 풀어 가요.",
    tags: ["프리랜서", "다정한 해요체", "난이도 쉬움"],
    greeting:
      "안녕하세요, 김도현이에요. 평소엔 집 고치는 인테리어 일을 해요. 그래서인지 이 방 구조가 자꾸 눈에 들어오네요. 여긴 탑 꼭대기 방인데, 벽 한쪽만 페인트 색이 미묘하게 달라요. 천천히, 같이 살펴봐요.",
    accent: "#a3e635",
    assets: {
      poster: `${base("character_h")}/portrait.jpg`,
      clipsDir: `${base("character_h")}/clips`,
      objectPosition: "50% 30%",
    },
  },
  character_i: {
    id: "character_i",
    name: "다니엘 브룩스",
    title: "뉴욕 호텔 컨시어지",
    profile: { age: 37, occupation: "직장인 (해외)", gender: "male" },
    description: "서울에서 3년 살아 한국어에 능숙한 뉴욕의 호텔 컨시어지. 매너 좋고 유머러스하게, 손님 모시듯 탈출을 안내해요.",
    tags: ["해외 거주", "유쾌한 해요체", "난이도 보통"],
    greeting:
      "반가워요! 다니엘이에요. 뉴욕의 호텔에서 컨시어지로 일해요. 서울에서 3년 살아서 한국어는 자신 있어요. 오늘은 제가 당신의 탈출 컨시어지예요. 여긴 별빛이 쏟아지는 탑 꼭대기 방. 문은 잠겨 있지만, 방법은 늘 있죠. 뭐부터 도와드릴까요?",
    accent: "#fbbf24",
    assets: {
      poster: `${base("character_i")}/portrait.jpg`,
      clipsDir: `${base("character_i")}/clips`,
      objectPosition: "57% 30%",
    },
  },
  character_j: {
    id: "character_j",
    name: "루카스 마르탱",
    title: "프랑스 출신 여행 사진작가",
    profile: { age: 31, occupation: "프리랜서 (해외)", gender: "male" },
    description: "늘 마감에 쫓기는 여행 사진작가. 째깍거리는 시계로 긴박감을 만들고, 빠른 판단과 과감한 행동을 좋아해요.",
    tags: ["해외 출신", "급한 반말", "난이도 보통"],
    greeting:
      "아, 왔구나! 루카스야. 여행 사진 찍으러 다니는데, 오늘도 마감에 쫓기는 중이라. 이 게임도 시간이 생명이야. 들려? 탑 꼭대기 방 벽에서 커다란 시계가 째깍거리고 있어. 자정 전에 나가야 해. 서두르자!",
    accent: "#22d3ee",
    assets: {
      poster: `${base("character_j")}/portrait.jpg`,
      clipsDir: `${base("character_j")}/clips`,
      objectPosition: "52% 30%",
    },
  },
  character_k: {
    id: "character_k",
    name: "강민재",
    title: "인디밴드 기타리스트",
    profile: { age: 26, occupation: "뮤지션 · 카페 아르바이트", gender: "male" },
    description: "낮엔 카페에서 일하고 밤엔 무대에 서는 기타리스트. 말수는 적지만 감성적이고, 소리와 리듬에 숨은 단서를 좋아해요.",
    tags: ["뮤지션", "과묵한 반말", "난이도 보통"],
    greeting:
      "…강민재. 밴드에서 기타 쳐. 비 오는 날엔 소리가 잘 들리거든. 여긴 탑 꼭대기 방. 빗소리 사이로, 벽 너머에서 낮은 음이 하나 울려. 들려?",
    accent: "#c084fc",
    assets: {
      poster: `${base("character_k")}/portrait.jpg`,
      clipsDir: `${base("character_k")}/clips`,
      objectPosition: "60% 30%",
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
