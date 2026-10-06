import { z } from "zod";
import { TOUCH_REACTION_IDS } from "@/config/reactions";

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
  /** (선택) 보이스톡 목소리. 없으면 성별 기본값 (docs/VOICE_TALK.md) */
  voice: z
    .object({
      /** Gemini Live 기본 제공 목소리 이름 (예: Kore, Leda, Aoede, Puck, Charon, Fenrir) */
      name: z.string().min(1).optional(),
      /** 말하는 방식 지시 (예: "차분하고 낮은 톤, 천천히") */
      style: z.string().min(1).optional(),
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
