import { z } from "zod";
import { AVATAR_REACTION_IDS, TOUCH_REACTION_IDS } from "@/config/reactions";

/**
 * personas/<id>.json 파일 형식.
 * 필드 설명은 personas/README.md 참고. 형식이 틀리면 빌드/서버 시작 시 어느 파일·필드가 틀렸는지 에러로 알려준다.
 */
export const personaFileSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9_-]+$/, "id 는 영문 소문자·숫자·_·- 만 사용 (이미지 폴더 이름과 같아야 함)"),
  name: z.string().min(1),
  gender: z.enum(["female", "male"]),
  age: z.number().int().min(1).max(120),
  occupation: z.string().min(1),
  /** 메신저 상태메시지 */
  status: z.string().min(1),
  /** 이 인물이 사는 곳의 시간대 (IANA, 예: Asia/Seoul, America/New_York) */
  timezone: z
    .string()
    .default("Asia/Seoul")
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("ko-KR", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "timezone 은 IANA 시간대 이름이어야 함 (예: Asia/Seoul)"),
  description: z.string().min(1),
  tags: z.array(z.string()).max(6),
  /** romance: 연인까지 발전 가능 / friendship: 친구로만 (호감도 단계 이름도 친구용) */
  relationshipType: z.enum(["romance", "friendship"]).default("romance"),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "accent 는 #RRGGBB 형식"),
  greeting: z.string().min(1),
  /**
   * (선택) 이 인물만의 호감도 난이도 — config/balance.json affection 값에 곱해진다.
   *  gainMultiplier 2 = 두 배 빨리 오름 / lossMultiplier 0.5 = 상처를 절반만 받음 / start = 첫 대화 시작 호감도
   */
  balance: z
    .object({
      gainMultiplier: z.number().min(0).max(5).optional(),
      lossMultiplier: z.number().min(0).max(5).optional(),
      start: z.number().int().min(0).max(100).optional(),
    })
    .optional(),
  /** 🔑 치트룸: 목록에 안 보이고(치트 코드로 입장), 서버도 운영자 인증 없이는 응답하지 않는다. 운영자 프롬프트(제한 해제)가 기본 */
  cheatRoom: z.boolean().default(false),
  /** (치트룸) 🛠 규칙 탭 "주인님 모드 규칙"의 기본 문장 — 이 방의 제한 수위 (미성년자 관련 줄은 코드에 고정) */
  cheatRules: z.string().optional(),
  image: z.object({
    /** public/avatar/personas/<id>/ 안의 파일명 */
    portrait: z.string().min(1).default("portrait.jpg"),
    objectPosition: z.string().default("50% 30%"),
    /** 리액션 화면(세로 영상)의 기준점 */
    stagePosition: z.string().default("50% 30%"),
    /** (선택) 같은 인물의 대체 클립 폴더 URL */
    fallbackClipsDir: z.string().optional(),
    /** (선택) 같은 인물의 대체 이미지 URL */
    fallbackPoster: z.string().optional(),
  }),
  /**
   * (선택) 화면 터치 반응 한마디를 인물 말투로 덮어쓰기.
   * 예) { "shy": ["앗… 왜 그래?"], "pout": ["그만해~!"] }  — 키: config/reactions.ts 의 TOUCH_REACTIONS id
   */
  touchLines: z.partialRecord(z.enum(TOUCH_REACTION_IDS), z.array(z.string().min(1)).min(1)).optional(),
  /**
   * (선택) 앨범 — 미리 찍어 둔 사진·영상. 파일은 public/avatar/personas/<id>/ 기준 경로.
   * 유저가 사진·영상을 보여 달라고 하면 AI가 이 중 어울리는 것을 골라 보낸다. (docs/MEDIA.md)
   */
  album: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9_-]+$/, "album id 는 영문 소문자·숫자·_·-"),
        type: z.enum(["photo", "video"]),
        /** 예: "album/laugh.jpg", "clips/love.mp4" */
        file: z.string().min(1),
        /** 어떤 사진인지 한 줄 설명 (AI가 고를 때 참고) */
        desc: z.string().min(1),
      })
    )
    .default([]),
  /** (선택) 보이스톡 목소리. 없으면 성별 기본값 (docs/VOICE_TALK.md) */
  voice: z
    .object({
      /** Gemini Live 기본 제공 목소리 이름 (예: Kore, Leda, Aoede, Puck, Charon, Fenrir) */
      name: z.string().min(1).optional(),
      /** 말하는 방식 지시 (예: "차분하고 낮은 톤, 천천히") */
      style: z.string().min(1).optional(),
    })
    .optional(),
  /**
   * (선택) 인물 성향 — 대화·리액션·삐짐·선물이 인물마다 달라진다. (docs/BALANCE.md "인물별 성향")
   */
  traits: z
    .object({
      /** 좋아하는 것 (이 이야기가 나오면 호감도가 잘 오른다) */
      likes: z.array(z.string().min(1)).max(8).default([]),
      /** 싫어하는 것 (이런 말·행동엔 서운해한다) */
      dislikes: z.array(z.string().min(1)).max(8).default([]),
      /** 삐졌을 때 기분이 풀리는 말·행동 */
      soothe: z.array(z.string().min(1)).max(8).default([]),
      /** 삐졌을 때 말투 */
      sulkStyle: z.string().min(1).optional(),
      /** 달랠 때 주는 선물 (💎 차감) */
      gift: z.object({ name: z.string().min(1), emoji: z.string().min(1) }).optional(),
      /** 리액션별 영상 확률 배수 (1 = 기본, 1.5 = 더 자주, 0.5 = 덜). 예: { "laugh": 1.4, "shy": 0.6 } */
      reactionBias: z.partialRecord(z.enum(AVATAR_REACTION_IDS), z.number().min(0).max(3)).default({}),
      /** 호감도 단계가 오를 때 하는 말 (2번째 단계부터 순서대로) */
      stageUpLines: z.array(z.string().min(1)).max(6).default([]),
      /** 유저가 사진·영상을 보냈을 때의 반응 방식 */
      mediaReaction: z.string().min(1).optional(),
    })
    .optional(),
  /**
   * (선택) 💋 매혹 모드. 있으면 이 인물에게 매혹 모드 버튼이 생긴다. (docs/ALLURE_MODE.md)
   * 영상은 public/avatar/personas/<id>/clips/allure/ 에 넣으면 자동 인식.
   */
  allure: z
    .object({
      /** 이 인물이 매혹 모드에서 어떻게 달라지는지 (말투·분위기). 노골적 내용 금지 */
      prompt: z.string().min(1),
      /** 버튼·안내에 보일 이름 (없으면 여성 "매혹 모드", 남성 "설렘 모드") */
      label: z.string().min(1).max(12).optional(),
      /** 버튼 아이콘 (없으면 여성 💋, 남성 🌙) */
      emoji: z.string().min(1).max(4).optional(),
      /** 보이스톡에서 목소리 톤 (예: "낮고 나른하게, 천천히") */
      voiceStyle: z.string().min(1).optional(),
    })
    .optional(),
  /** 서사: background 는 처음부터 공개, chapters 는 호감도가 min 이상이면 열리고(프로필에 표시) 대화에도 반영된다 */
  story: z
    .object({
      background: z.string().min(1),
      chapters: z.array(z.object({ min: z.number().int().min(0).max(100), title: z.string().min(1), text: z.string().min(1) })).default([]),
    })
    .optional(),
  prompt: z.object({
    identity: z.string().min(1),
    personality: z.string().min(1),
    speech: z.string().min(1),
    chatStyle: z.string().min(1),
    /** 평소 일상 (시간대별로 무엇을 하는지) */
    lifestyle: z.string().min(1),
    /** 관계가 어떻게 발전하는지, 애정·친밀감 표현 방식 */
    relationship: z.string().min(1),
    examples: z.array(z.string()).min(1),
    temperature: z.number().min(0).max(2).optional(),
  }),
});

export type PersonaFile = z.infer<typeof personaFileSchema>;
export type PersonaPrompt = PersonaFile["prompt"];

export const sharedFileSchema = z.object({
  rules: z.array(z.string().min(1)).min(1),
});
