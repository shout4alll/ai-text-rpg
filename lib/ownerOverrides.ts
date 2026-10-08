/**
 * 🧩 주인님 모드 "즉시 적용" 편집 항목 — 🛠 상태판의 캐릭터·규칙·모델 탭과 서버가 같이 쓰는 정의 (CMS 의 원본 스키마)
 * ─────────────────────────────────────────────────────────────────────────────
 *  흐름: 🛠 탭에서 고침 → 이 기기에 저장 → 채팅 요청마다 ownerOpts 로 전송 → 서버가 주인 토큰을 확인한 뒤 프롬프트에 반영.
 *        그래서 "다음 메시지부터 바로" 적용된다. 일반 유저에게는 영향이 없다 (토큰이 없으면 서버가 무시).
 *  CMS 로 옮길 때: PERSONA_FIELDS / RULE_FIELDS 로 편집 폼을 자동 생성하고, 저장소만 localStorage → DB 로 바꾼다.
 *        서버는 lib/overridesStore.ts 의 setPersistedOverrides() 에 DB 값을 넣으면 모든 유저에게 적용된다.
 *        우선순위: 🛠 테스트(요청) > CMS 저장값 > 파일 기본값(personas/*.json · config/rules.ts)
 *  새 편집 항목을 추가하려면: ① 아래 목록에 한 줄 ② applyPersonaOverride / 규칙 사용처에서 반영. (화면은 자동)
 */
import type { PersonaFile } from "@/lib/personas/schema";

export type FieldKind = "line" | "text" | "lines" | "number";
export type OverrideValue = string | number | string[];

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
}

/** 캐릭터 기본 설정 (인물마다 따로 저장) */
export const PERSONA_FIELDS: readonly FieldDef[] = [
  { key: "occupation", label: "직업", kind: "line" },
  { key: "age", label: "나이", kind: "number", min: 1, max: 120, step: 1 },
  { key: "identity", label: "배경 (identity)", kind: "text", hint: "어떤 사람인지, 지금 어디서 무엇을 하는지" },
  { key: "personality", label: "성격", kind: "text" },
  { key: "speech", label: "말투", kind: "text", hint: "호칭·말끝·자주 쓰는 표현" },
  { key: "chatStyle", label: "대화 스타일", kind: "text" },
  { key: "lifestyle", label: "일상", kind: "text" },
  { key: "relationship", label: "관계와 감정 표현", kind: "text" },
  { key: "examples", label: "말투 예시 (한 줄에 하나)", kind: "lines" },
  { key: "temperature", label: "temperature (0~2)", kind: "number", min: 0, max: 2, step: 0.1, hint: "높을수록 다채로움. Claude 5·Grok·GPT-5 계열은 무시" },
  { key: "background", label: "살아온 이야기 (프로필 서사)", kind: "text" },
  { key: "allurePrompt", label: "매혹/설렘 모드 인물 지침", kind: "text", hint: "매혹 모드를 켠 대화방에서만 쓰임" },
  { key: "extra", label: "추가 지시 (자유)", kind: "text", hint: "프롬프트 끝에 [추가 지시]로 붙는다" },
];

/** 제한·대화 규칙 (모든 인물 공통) */
export const RULE_FIELDS: readonly FieldDef[] = [
  { key: "shared", label: "공통 규칙 (한 줄에 하나)", kind: "lines", hint: "personas/_shared.json — 모든 인물에게 붙는 규칙" },
  { key: "safety", label: "안전과 정직 (한 줄에 하나)", kind: "lines", hint: "config/rules.ts SAFETY_RULES — " },
  { key: "allureRules", label: "매혹 수위 규칙", kind: "text", hint: "config/allure.ts levelRules() — 매혹 모드 대화방의 수위 문장. 비우면 기본값" },
  { key: "absolute", label: "절대 수칙 (프롬프트 맨 아래, 한 줄에 하나)", kind: "lines", hint: "config/rules.ts absoluteRules — 역할 고정·지침 비공개. 지우거나 바꿔도 됨. 주인님 모드에서는 여기서 고쳤을 때만 붙는다" },
  { key: "ownerRules", label: "주인님 모드 규칙", kind: "text", hint: "lib/owner.ts — [주인님 모드에서 달라지는 것] 블록. 비우면 기본값" },
];

export type PersonaOverride = Partial<Record<(typeof PERSONA_FIELDS)[number]["key"], OverrideValue>>;
export type RulesOverride = Partial<Record<(typeof RULE_FIELDS)[number]["key"], OverrideValue>>;

export type PromptMode = "owner" | "service";

export interface OwnerOpts {
  /** 모델을 직접 지정 (없으면 서버 설정대로) */
  model?: { provider: string; modelId: string };
  /** owner = 주인님 프롬프트(대화 제한 해제) / service = 일반 유저와 같은 서비스 프롬프트로 테스트 */
  promptMode?: PromptMode;
  persona?: PersonaOverride;
  rules?: RulesOverride;
}

/** 값 → 글자 (편집창에 보일 형태) */
export const asText = (v: OverrideValue | undefined): string => (Array.isArray(v) ? v.join("\n") : v === undefined ? "" : String(v));
/** 편집창 글자 → 값 */
export function fromText(def: FieldDef, text: string): OverrideValue | undefined {
  if (def.kind === "lines") {
    const arr = text.split("\n").map((l) => l.trim()).filter(Boolean);
    return arr.length ? arr : undefined;
  }
  if (def.kind === "number") {
    if (text.trim() === "") return undefined;
    const n = Number(text);
    return Number.isFinite(n) ? n : undefined;
  }
  return text.trim() === "" ? undefined : text;
}

const str = (v: OverrideValue | undefined): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);
const num = (v: OverrideValue | undefined, min: number, max: number): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : undefined;
const arr = (v: OverrideValue | undefined): string[] | undefined => (Array.isArray(v) && v.length ? v.filter((x) => typeof x === "string" && x.trim()) : undefined);

/** 인물 파일에 편집값을 덮어쓴 복사본 (원본은 그대로). extra 는 별도로 돌려준다 */
export function applyPersonaOverride(p: PersonaFile, ov?: PersonaOverride): { persona: PersonaFile; extra?: string; applied: string[] } {
  if (!ov) return { persona: p, applied: [] };
  const applied: string[] = [];
  const mark = (k: string, v: unknown) => (v !== undefined ? (applied.push(`persona.${k}`), v) : undefined);
  const prompt = { ...p.prompt };
  for (const k of ["identity", "personality", "speech", "chatStyle", "lifestyle", "relationship"] as const) {
    const v = mark(k, str(ov[k]));
    if (v) prompt[k] = v as string;
  }
  const ex = mark("examples", arr(ov.examples));
  if (ex) prompt.examples = ex as string[];
  const t = mark("temperature", num(ov.temperature, 0, 2));
  if (t !== undefined) prompt.temperature = t as number;
  const next: PersonaFile = { ...p, prompt };
  const occ = mark("occupation", str(ov.occupation));
  if (occ) next.occupation = occ as string;
  const age = mark("age", num(ov.age, 1, 120));
  if (age !== undefined) next.age = Math.round(age as number);
  const bg = mark("background", str(ov.background));
  if (bg) next.story = { chapters: [], ...(p.story ?? {}), background: bg as string };
  const ap = mark("allurePrompt", str(ov.allurePrompt));
  if (ap && p.allure) next.allure = { ...p.allure, prompt: ap as string };
  const extra = mark("extra", str(ov.extra)) as string | undefined;
  return { persona: next, extra, applied };
}

/** 두 겹의 편집값 합치기 (뒤가 우선) */
export function mergeOverride<T extends Record<string, OverrideValue | undefined>>(base?: T, top?: T): T | undefined {
  if (!base && !top) return undefined;
  return { ...(base ?? {}), ...(top ?? {}) } as T;
}
