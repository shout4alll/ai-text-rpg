/**
 * 🎛 운영 설정 한곳 정리 (라이브 대비 · 나중에 CMS 편집 화면의 원본)
 * ─────────────────────────────────────────────────────────────────────────────
 *  ▸ 서버 스위치(SERVER_SETTINGS): 값 우선순위  [CMS 덮어쓰기(예정)] > 환경변수 > 아래 기본값
 *      라이브에서 바꾸는 법: Vercel › Settings › Environment Variables 에 env 이름=값 → Redeploy
 *      코드 기본값을 바꾸려면 이 파일의 default / devDefault 를 고치고 git push
 *  ▸ 앱 스위치(APP_SETTINGS): 앱 화면 쪽 설정. 각 항목의 file 을 고치고 배포 (APK 는 다시 빌드)
 *
 *  🛠 확인: 주인님 모드에서 화면 왼쪽 위 🛠 버튼 → 모든 값과 출처(환경변수/기본값)가 보인다.
 *
 *  CMS 를 만들 때: 이 목록(type·options·min·max·label·desc)으로 편집 폼을 자동 생성하고,
 *  저장된 값은 resolveSetting() 의 overrides 자리에 넣으면 된다. (DB → overrides 맵)
 *  비밀 값(API 키)은 여기에 두지 않는다 — SECRET_ENV 에 이름만.
 */
import { TYPO, TYPING } from "@/config/typing";
import { GEM_TEST_TOPUP, GEM_PACKS } from "@/config/gems";
import { RETURN_CHANCE } from "@/config/returnNudge";
import { DEFAULT_NOTIFY_PLAN } from "@/config/notifications";
import { BALANCE } from "@/config/balance";

export type SettingType = "enum" | "number" | "string";

export interface SettingDef {
  key: string;
  /** 화면에 보일 이름 */
  label: string;
  group: "모델" | "수위·모드" | "이용 권한" | "보이스톡";
  type: SettingType;
  options?: readonly string[];
  min?: number;
  max?: number;
  /** 배포(production) 기본값 */
  default: string;
  /** 개발 서버(npm run dev) 기본값 — 없으면 default */
  devDefault?: string;
  /** 환경변수 이름 */
  env: string;
  /** 이 값을 실제로 쓰는 코드 */
  usedIn: string;
  desc: string;
}

/* ─────────────────────────────── 서버 스위치 ─────────────────────────────── */
export const SERVER_SETTINGS = [
  {
    key: "allureLevel", label: "매혹 모드 수위", group: "수위·모드", type: "enum", options: ["soft", "max"],
    default: "max", env: "ALLURE_LEVEL", usedIn: "config/allure.ts levelRules()",
    desc: "soft=설렘·밀당·눈빛까지 / max=스킨십 한 줄 언급·야릇한 농담·고백·질투, 더 가면 암전",
  },
  {
    key: "matureModel", label: "성인(매혹 모드) 전용 모델", group: "모델", type: "string",
    default: "", env: "AI_MODEL_MATURE", usedIn: "config/ai.ts resolveModel('mature')",
    desc: "비우면 메인 모델. 매혹·설렘 모드를 켠 대화방의 텍스트 톡에만 쓰인다. 다른 프로바이더는 앞에 붙임: xai:grok-4.7 · google:gemini-3.8-flash",
  },
  {
    key: "historySanitize", label: "성인 대화 구간 정화 (다른 모델 전달용)", group: "수위·모드", type: "enum", options: ["on", "off"],
    default: "on", env: "HISTORY_SANITIZE", usedIn: "lib/historySanitizer.ts · app/api/chat/route.ts",
    desc: "on=성인 전용 모델이 따로 있을 때, 매혹 모드 대화는 화면·저장에는 그대로 두고 다른 모델(Claude 등)에게는 원문 대신 '친밀한 대화를 나눴다' 요약만 전달 / off=원문 그대로 전달",
  },
  {
    key: "stickyRouting", label: "회상 대화 연속 라우팅 (지연 복귀)", group: "수위·모드", type: "enum", options: ["on", "off"],
    default: "on", env: "STICKY_ROUTING", usedIn: "lib/historySanitizer.ts stickyMature()",
    desc: "on=매혹 모드를 끈 직후에도 '아까 어땠어?' 같은 회상 말이면 몇 턴 동안 성인 전용 모델로 계속 답함 / off=끄면 바로 메인 모델",
  },
  {
    key: "premiumAccess", label: "유료 영상·매혹 모드 잠금", group: "이용 권한", type: "enum", options: ["open", "paid"],
    default: "paid", devDefault: "open", env: "PREMIUM_ACCESS", usedIn: "lib/entitlements.ts",
    desc: "open=누구나 / paid=멤버십 필요 (결제 연동 전에는 테스트 구독으로만)",
  },
  {
    key: "mediaAccess", label: "실시간 사진 (서버 잠금)", group: "이용 권한", type: "enum", options: ["open", "paid", "off"],
    default: "open", env: "MEDIA_ACCESS", usedIn: "lib/entitlements.ts checkMediaAccess()",
    desc: "open=앱의 💎 차감만으로 사용 / paid=서버에서 따로 잠금(VOICE_DEV_PASS) / off=끄기",
  },
  {
    key: "voiceAccess", label: "보이스톡 권한", group: "보이스톡", type: "enum", options: ["open", "paid", "off"],
    default: "paid", devDefault: "open", env: "VOICE_ACCESS", usedIn: "lib/voice/access.ts",
    desc: "open=누구나 / paid=이용권(VOICE_DEV_PASS) 필요 / off=끄기",
  },
  {
    key: "voiceMaxMinutes", label: "보이스톡 1회 최대(분)", group: "보이스톡", type: "number", min: 1, max: 10,
    default: "10", env: "VOICE_MAX_MINUTES", usedIn: "lib/voice/access.ts voiceMaxSeconds()",
    desc: "통화 한 번의 최대 길이. Live API 한도 때문에 최대 10",
  },
  {
    key: "voiceModel", label: "보이스톡 모델", group: "보이스톡", type: "string",
    default: "gemini-3.8-live", env: "GEMINI_LIVE_MODEL", usedIn: "app/api/voice/session/route.ts",
    desc: "더 깊게 생각하게 하려면 gemini-3.8-live-extended-thinking",
  },
  {
    key: "routing", label: "가벼운 대화 자동 라우팅", group: "모델", type: "enum", options: ["on", "off"],
    default: "on", env: "AI_ROUTING", usedIn: "lib/modelRouter.ts routeTier()",
    desc: "on=인사·맞장구는 가벼운 모델로(비용 절약) / off=항상 메인 모델",
  },
] as const satisfies readonly SettingDef[];

export type ServerSettingKey = (typeof SERVER_SETTINGS)[number]["key"];

/** 비밀 환경변수 — 값은 절대 화면에 내보내지 않고 "있음/없음"만 */
export const SECRET_ENV = ["AWS_BEDROCK_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "XAI_API_KEY", "VOICE_DEV_PASS", "OWNER_CHEAT_PHRASE"] as const;

/** 모델 관련 환경변수 (값을 보여 줘도 되는 것) */
export const MODEL_ENV = ["AI_PROVIDER", "AI_MODEL", "AI_MODEL_LIGHT", "AI_CHEAP_MODEL", "BEDROCK_REGION", "XAI_BASE_URL", "GEMINI_IMAGE_MODEL", "GEMINI_TTS_MODEL"] as const;

/**
 * CMS 덮어쓰기 자리. 나중에 DB 에서 읽은 값을 여기에 채운다 (지금은 비어 있음).
 * 예) setSettingOverrides({ allureLevel: "soft" })
 */
let overrides: Partial<Record<ServerSettingKey, string>> = {};
export function setSettingOverrides(o: Partial<Record<ServerSettingKey, string>>) {
  overrides = { ...o };
}

export type SettingSource = "cms" | "env" | "default";

/** 서버 스위치의 현재 값과 출처 (형식이 틀린 값은 무시하고 기본값) */
export function resolveSetting(key: ServerSettingKey): { value: string; source: SettingSource } {
  const def = SERVER_SETTINGS.find((s) => s.key === key) as SettingDef;
  const valid = (v: string | undefined): v is string => {
    if (v === undefined || v === "") return false;
    if (def.type === "enum") return (def.options ?? []).includes(v);
    if (def.type === "number") {
      const n = Number(v);
      return Number.isFinite(n) && (def.min === undefined || n >= def.min) && (def.max === undefined || n <= def.max);
    }
    return true;
  };
  const o = overrides[key]?.trim();
  if (valid(o)) return { value: o, source: "cms" };
  const e = typeof process !== "undefined" ? process.env[def.env]?.trim() : undefined;
  if (valid(e)) return { value: e, source: "env" };
  const isDev = typeof process !== "undefined" && process.env.NODE_ENV !== "production";
  return { value: isDev && def.devDefault !== undefined ? def.devDefault : def.default, source: "default" };
}

export const settingValue = (key: ServerSettingKey) => resolveSetting(key).value;

/* ─────────────────────────────── 앱 스위치 (읽기 전용 표시용) ─────────────────────────────── */
export interface AppSettingView {
  label: string;
  value: string;
  file: string;
}

/** 앱 쪽 설정의 현재 값 — 고치려면 file 을 수정하고 배포 */
export function appSettings(): AppSettingView[] {
  return [
    { label: "오타 연출", value: TYPO.enabled ? `켜짐 · ${Math.round(TYPO.chance * 100)}% · 정정 ${Math.round(TYPO.fixChance * 100)}%` : "꺼짐", file: "config/typing.ts TYPO" },
    { label: "타이핑 속도", value: `${TYPING.baseMs}ms + 글자당 ${TYPING.perCharMs}ms (최대 ${TYPING.maxMs}ms)`, file: "config/typing.ts TYPING" },
    { label: "보석 테스트 충전", value: GEM_TEST_TOPUP ? "켜짐 (무료)" : "꺼짐 (실제 결제)", file: "config/gems.ts GEM_TEST_TOPUP" },
    { label: "충전 상품", value: GEM_PACKS.map((p) => `💎${p.gems}`).join(" · "), file: "config/gems.ts GEM_PACKS" },
    { label: "시작 보석", value: `💎${BALANCE.cash.demoStart}`, file: "config/balance.json cash.demoStart" },
    { label: "재입장 선톡 확률", value: RETURN_CHANCE.map((b) => `${b.minGapMin >= 60 ? `${b.minGapMin / 60}h` : `${b.minGapMin}m`}:${Math.round(b.chance * 100)}%`).join(" "), file: "config/returnNudge.ts" },
    { label: "선톡 알림", value: `${DEFAULT_NOTIFY_PLAN.window.start}~${DEFAULT_NOTIFY_PLAN.window.end} · 하루 ${DEFAULT_NOTIFY_PLAN.perDay.min}~${DEFAULT_NOTIFY_PLAN.perDay.max}번(끼니·일과·잠) · 닫고 ${DEFAULT_NOTIFY_PLAN.minLeadMin}분 뒤부터`, file: "config/notifications.ts" },
  ];
}
