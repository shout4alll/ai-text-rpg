import "server-only";
import { settingValue } from "@/config/settings";
import type { LanguageModel } from "ai";

/** generateText 에 함께 넘길 프로바이더 옵션 (모델마다 다름) */
export type ProviderOptions = Record<string, Record<string, unknown>>;

/* ========================================================================== */
/*  AI 프로바이더 / 모델 설정 — 모델을 바꿀 때는 이 파일만 수정하면 된다.          */
/* ========================================================================== */
/*
 *  ▶ 프로바이더 바꾸기
 *      아래 ACTIVE_PROVIDER 값을 바꾼다. (또는 .env 의 AI_PROVIDER 로 덮어쓰기)
 *
 *  ▶ 모델 바꾸기
 *      각 프로바이더 블록의 `model:` 줄 중 하나만 주석 해제한다. (또는 .env 의 AI_MODEL)
 *
 *  ▶ 주석 처리된 프로바이더(OpenAI, Anthropic 직접 API) 쓰기
 *      1) 맨 아래 import 줄 주석 해제
 *      2) PROVIDERS 안의 해당 블록 주석 해제
 *      3) 해당 API 키를 .env.local / Vercel 환경변수에 추가
 *      (패키지는 이미 설치되어 있다: @ai-sdk/openai, @ai-sdk/anthropic)
 *
 *  우선순위: 환경변수(AI_PROVIDER, AI_MODEL) > 이 파일의 값
 */

import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai"; // xAI(Grok)는 OpenAI 호환 API 라 이 패키지로 연결한다
// import { createAnthropic } from "@ai-sdk/anthropic"; // Anthropic 직접 API 사용 시 주석 해제

/** ✅ 현재 사용 중인 프로바이더 */
export const ACTIVE_PROVIDER: ProviderId = "bedrock";

interface ProviderEntry {
  /** 화면/로그 표시용 이름 */
  label: string;
  /** 이 프로바이더에서 사용할 모델 ID */
  model: string;
  /** 모델 인스턴스 생성 */
  create: (modelId: string) => LanguageModel;
  /** 💰 하이브리드 라우팅: 가벼운 대화(인사·맞장구·짧은 말)용 모델 (없으면 model) */
  lightModel?: string;
  /** 💰 기억 요약 같은 보조 작업에 쓸 가장 저렴한 모델 (없으면 lightModel) */
  cheapModel?: string;
  /** (선택) 모델별 추가 옵션 — 예: Claude 의 생각(thinking) 끄기 */
  options?: (modelId: string) => ProviderOptions | undefined;
}

/**
 * Bedrock 의 Claude 모델 옵션.
 *  - Claude Sonnet 5 계열은 "생각(adaptive thinking)"이 기본으로 켜져 있어 답장이 느리고 비싸다.
 *    메신저 답장에는 필요 없으므로 끈다. (5.5 처럼 끌 수 없는 모델은 가장 낮은 단계로)
 *  - 답장 형식(JSON)은 도구 호출 방식으로 받는다 (Sonnet 5 는 Bedrock 네이티브 structured output 미지원).
 */
const bedrockRegion = () => process.env.BEDROCK_REGION?.trim() || process.env.AWS_REGION?.trim() || "us-east-1";

/**
 * 리전과 맞지 않는 교차 리전 접두사를 바로잡는다.
 *  예) 서울 리전인데 "us.anthropic…" → "global.anthropic…" (us. 프로파일은 미국 리전에서만 호출 가능)
 */
export function fixBedrockModelId(modelId: string, region = bedrockRegion()): string {
  const m = /^(us|eu|apac|jp|au|ca)\.(.+)$/.exec(modelId);
  if (!m) return modelId;
  const [, geo, rest] = m;
  // Meta Llama 는 global. 프로파일이 없다 — 바꾸지 않고 그대로 두면 리전 불일치 시 Bedrock 이 정확한 오류를 알려 준다
  if (rest.startsWith("meta.")) return modelId;
  const ok =
    (geo === "us" && region.startsWith("us-")) ||
    (geo === "eu" && region.startsWith("eu-")) ||
    (geo === "apac" && region.startsWith("ap-")) ||
    (geo === "jp" && region === "ap-northeast-1") ||
    (geo === "au" && region.startsWith("ap-southeast-")) ||
    (geo === "ca" && region.startsWith("ca-"));
  return ok ? modelId : `global.${rest}`;
}

/**
 * Bedrock 프롬프트 캐시(cachePoint)를 지원하는 모델인가.
 * Claude·Nova 만 지원한다. Llama·Grok·Mistral 등에 cachePoint 를 보내면
 * "You invoked an unsupported model or your request did not allow prompt caching" 오류가 나므로 빼고 보낸다.
 */
export function supportsBedrockCache(modelId: string): boolean {
  return /anthropic\.claude|amazon\.nova/.test(modelId);
}

/**
 * 구조화 답장을 "글로 쓴 JSON"으로 받아야 하는 모델 (Bedrock 의 Claude·Nova 외 모델).
 * Bedrock 의 toolChoice(도구 강제)는 일부 모델만 지원 — Llama 는 "doesn't support toolConfig.toolChoice.any" 오류,
 * Grok 은 도구를 무시하고 글로 답해 "could not parse the response" 오류가 난다.
 */
export function usesTextJson(provider: string, modelId: string): boolean {
  return provider === "bedrock" && !/anthropic\.claude|amazon\.nova/.test(modelId);
}

export function bedrockClaudeOptions(modelId: string): ProviderOptions | undefined {
  // Claude 가 아닌 모델(Nova·Llama·Mistral 등)도 구조화 답장은 도구 방식으로 (가장 널리 지원)
  // Nova 는 도구 강제를 지원 → 도구 방식. Llama·Grok·gpt-oss 등은 toolChoice 를 거부하거나 무시하므로 글(JSON) 방식(usesTextJson)
  if (!/anthropic\.claude/.test(modelId)) return /amazon\.nova/.test(modelId) ? { bedrock: { structuredOutputMode: "jsonTool" } } : undefined;
  const cannotDisableThinking = /claude-(sonnet|opus)-5-5|claude-fable-5-1/.test(modelId);
  return {
    bedrock: cannotDisableThinking
      ? { reasoningConfig: { type: "adaptive", maxReasoningEffort: "low" } }
      : { additionalModelRequestFields: { thinking: { type: "disabled" } }, structuredOutputMode: "jsonTool" },
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  🛡 Bedrock 요청 점검 — guardrail(가드레일) 파라미터를 절대 넣지 않는다              */
/*   · 요청은 "순수 모델 ID"로만 간다: guardrailIdentifier / guardrailConfig /        */
/*     X-Amzn-Bedrock-GuardrailIdentifier 헤더를 코드에서 설정하지 않는다.            */
/*   · 아래 guardFetch 가 나가는 모든 Bedrock 요청을 검사해, 혹시 guardrail 이 섞여     */
/*     있으면 전송 전에 막고 오류를 낸다 (코드 변경 실수 방지). 요약은 마지막 요청으로 기록. */
/*   · 🛠 상태판 › 점검 탭에서 눈으로 확인할 수 있다 (app/api/owner/probe).           */
/* ────────────────────────────────────────────────────────────────────────── */
export interface BedrockRequestRecord {
  at: number;
  url: string;
  modelIdInUrl: string;
  headerNames: string[];
  bodyKeys: string[];
  guardrail: boolean;
  guardrailWhere: string[];
}
let lastBedrock: BedrockRequestRecord | null = null;
export const lastBedrockRequest = () => lastBedrock;
export const resetBedrockRequest = () => {
  lastBedrock = null;
};
/** 점검 탭의 기본 모델: 서비스가 Bedrock 을 쓰면 그 메인 모델, 아니면 Bedrock 기본 메인 모델 */
export const defaultBedrockModelId = (): string => {
  const env = process.env.AI_MODEL?.trim();
  const m = (process.env.AI_PROVIDER?.trim() || ACTIVE_PROVIDER) === "bedrock" && env ? env : PROVIDERS.bedrock.model;
  return fixBedrockModelId(m);
};

function findGuardrail(v: unknown, path: string, out: string[]) {
  if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (/guardrail/i.test(k)) out.push(`${path}${k}`);
      findGuardrail(val, `${path}${k}.`, out);
    }
  }
}

function guardFetch(inner?: typeof fetch): typeof fetch {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const headers = new Headers(init?.headers ?? (typeof input === "object" && "headers" in input ? (input as Request).headers : undefined));
    const where: string[] = [];
    headers.forEach((_v, k) => {
      if (/guardrail/i.test(k)) where.push(`header:${k}`);
    });
    let bodyKeys: string[] = [];
    if (typeof init?.body === "string") {
      try {
        const obj = JSON.parse(init.body) as Record<string, unknown>;
        bodyKeys = Object.keys(obj);
        findGuardrail(obj, "body.", where);
      } catch {
        if (/guardrail/i.test(init.body)) where.push("body(text)");
      }
    }
    const m = /\/model\/([^/]+)\//.exec(url);
    const names: string[] = [];
    headers.forEach((_v, k) => names.push(k));
    lastBedrock = { at: Date.now(), url: url.replace(/\?.*$/, ""), modelIdInUrl: m ? decodeURIComponent(m[1]) : "", headerNames: names.sort(), bodyKeys, guardrail: where.length > 0, guardrailWhere: where };
    if (where.length) throw new Error(`[config/ai] Bedrock 요청에 guardrail 항목이 섞여 있어 전송을 막았습니다 (${where.join(", ")}). 순수 모델 ID 로만 호출해야 합니다.`);
    return (inner ?? fetch)(input, init);
  };
}

/** Bedrock 모델 만들기 (점검 가능한 fetch 사용). 테스트용으로 fetch·키를 바꿔 끼울 수 있다 */
export function createBedrockModel(modelId: string, opt: { fetchImpl?: typeof fetch; apiKey?: string } = {}): LanguageModel {
  const apiKey = opt.apiKey || process.env.AWS_BEDROCK_API_KEY || process.env.AWS_BEARER_TOKEN_BEDROCK;
  const useIam = process.env.BEDROCK_USE_IAM === "true" && !opt.apiKey;
  if (!apiKey && !useIam) {
    throw new Error(
      "[config/ai] Bedrock 인증 정보가 없습니다. AWS_BEDROCK_API_KEY 를 설정하세요. " +
        "(IAM 액세스 키를 쓰려면 BEDROCK_USE_IAM=true 와 AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY 설정)"
    );
  }
  return createAmazonBedrock({
    // Vercel 은 AWS_REGION 을 함수 실행 리전으로 자동 주입할 수 있어 전용 변수를 먼저 본다.
    region: bedrockRegion(),
    apiKey: useIam ? undefined : apiKey,
    baseURL: process.env.BEDROCK_BASE_URL || undefined, // (선택) 프록시/테스트용
    fetch: guardFetch(opt.fetchImpl),
  })(modelId);
}

const PROVIDERS = {
  /* ------------------------------------------------------------------------ */
  /*  Amazon Bedrock  (✅ 활성 — Bedrock 안의 모델을 자유롭게 골라 쓴다)           */
  /*    역할별 모델 (하이브리드 라우팅, lib/modelRouter.ts):                       */
  /*      model      = 메인 (감정·고민·긴 대화·사진 보기)   ← AI_MODEL 로 덮어쓰기   */
  /*      lightModel = 가벼운 대화 (인사·맞장구·짧은 말)    ← AI_MODEL_LIGHT       */
  /*      cheapModel = 보조 작업 (기억 정리)               ← AI_CHEAP_MODEL       */
  /*    모델 ID 는 AWS 콘솔 → Bedrock → Model catalog 에서 확인 (교차 리전은 us./global. 접두사) */
  /*    인증: AWS_BEDROCK_API_KEY (Bedrock API 키)                              */
  /*          IAM 키를 쓰려면 BEDROCK_USE_IAM=true + AWS_ACCESS_KEY_ID/SECRET     */
  /*          (Vercel 은 쓸 수 없는 AWS_* 값을 자동 주입할 수 있어 명시적으로만 사용) */
  /*    리전: BEDROCK_REGION > AWS_REGION > us-east-1                           */
  /*    ⚠️ 모델은 AWS 콘솔 → Bedrock → Model access 에서 계정별로 활성화해야 한다. */
  /* ------------------------------------------------------------------------ */
  bedrock: {
    label: "Amazon Bedrock",
    // 아래 중 하나만 주석 해제 (또는 .env 의 AI_MODEL 로 덮어쓰기)
    // global. = 전 세계 교차 리전 추론 프로파일 → 서울(ap-northeast-2)·미국 어느 리전에서 호출해도 된다.
    // (이 계정 서울 리전 목록 기준, 2026-10)
    model: "global.anthropic.claude-sonnet-5", // ✅ Claude Sonnet 5 — 메인
    // model: "global.anthropic.claude-sonnet-5-5",          // Claude Sonnet 5.5 (생각 기능을 끌 수 없어 조금 느림)
    // model: "global.anthropic.claude-opus-5",              // Claude Opus 5 — 더 똑똑, 비쌈
    // model: "global.anthropic.claude-sonnet-4-6",          // Claude Sonnet 4.6 — 저렴한 대안
    create: (modelId) => createBedrockModel(modelId),
    // ⚠️ Haiku 4.5 는 계정에서 "Anthropic 사용 사례 양식"을 제출해야 쓸 수 있다.
    //    아직이면 자동으로 cheapModel(Nova 2 Lite) → 메인 순서로 넘어간다 (lib/modelRouter.ts runWithFallback)
    lightModel: "global.anthropic.claude-haiku-4-5-20251001-v1:0", // Claude Haiku 4.5 — 빠르고 저렴, 말투 유지 좋음
    // lightModel: "global.amazon.nova-2-lite-v1:0",                // Amazon Nova 2 Lite — 더 저렴
    // lightModel: "apac.amazon.nova-micro-v1:0",                   // Amazon Nova Micro — 가장 저렴 (APAC)
    cheapModel: "global.amazon.nova-2-lite-v1:0", // Amazon Nova 2 Lite — 기억 정리용
    options: bedrockClaudeOptions,
  },

  /* ------------------------------------------------------------------------ */
  /*  Google Gemini  (대기 — AI_PROVIDER=google 로 전환. 보이스톡은 항상 Gemini Live) */
  /*    인증: GOOGLE_GENERATIVE_AI_API_KEY                                     */
  /* ------------------------------------------------------------------------ */
  google: {
    label: "Google Gemini",
    // 보이스톡(gemini-3.8-live)과 같은 Gemini 3.8 세대 — 텍스트·음성 모두 구글 키 하나로
    model: "gemini-3.8-flash", // ✅ Gemini 3.8 Flash (정식) — 빠르고 똑똑함
    // model: "gemini-3.1-pro-preview", // Gemini 3.1 Pro (미리보기) — 가장 똑똑하지만 느리고 비쌈
    // model: "gemini-3.5-flash-lite",  // 가장 저렴
    create: (modelId) =>
      createGoogleGenerativeAI({
        baseURL: process.env.GOOGLE_GENERATIVE_AI_BASE_URL || undefined,
      })(modelId),
    lightModel: "gemini-3.5-flash-lite",
    cheapModel: "gemini-3.5-flash-lite",
    // 메신저 답장은 깊은 생각이 필요 없어 생각 단계를 낮게 (빠른 답장)
    options: (modelId) => (/gemini-3/.test(modelId) ? { google: { thinkingConfig: { thinkingLevel: "low" } } } : undefined),
  },

  /* ------------------------------------------------------------------------ */
  /*  xAI Grok  (대기 — AI_PROVIDER=xai 로 전환하거나, 주인님 모드 🛠 › 모델 에서 골라 테스트) */
  /*    인증: XAI_API_KEY  (console.x.ai 에서 발급)                              */
  /*    주소: 기본 https://api.x.ai/v1 (XAI_BASE_URL 로 바꾸기, 미국 리전: https://us.api.x.ai/v1) */
  /*    모델 ID 는 docs.x.ai › Models 참고 (2026-10 기준 최신: grok-4.7)          */
  /* ------------------------------------------------------------------------ */
  xai: {
    label: "xAI Grok",
    model: "grok-4.7", // 최신 플래그십 (500k 컨텍스트)
    create: (modelId) => {
      const apiKey = process.env.XAI_API_KEY?.trim();
      if (!apiKey) throw new Error("[config/ai] XAI_API_KEY 가 없습니다. Vercel 환경변수(또는 .env.local)에 XAI_API_KEY 를 추가하세요.");
      return createOpenAI({ apiKey, baseURL: process.env.XAI_BASE_URL?.trim() || "https://api.x.ai/v1" }).chat(modelId);
    },
    lightModel: "grok-4.7",
    cheapModel: "grok-4.7",
  },

  /* ------------------------------------------------------------------------ */
  /*  OpenAI GPT  (대기 — 우회(fallback) 모델 또는 🛠 › 모델 에서 사용)             */
  /*    인증: OPENAI_API_KEY (선택 OPENAI_BASE_URL)                              */
  /*    Bedrock 으로 쓰는 GPT(gpt-oss)는 이 항목이 아니라 Bedrock 모델 ID 로 부른다  */
  /* ------------------------------------------------------------------------ */
  openai: {
    label: "OpenAI GPT",
    model: "gpt-5",
    create: (modelId) => {
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) throw new Error("[config/ai] OPENAI_API_KEY 가 없습니다. Vercel 환경변수(또는 .env.local)에 OPENAI_API_KEY 를 추가하세요.");
      return createOpenAI({ apiKey, baseURL: process.env.OPENAI_BASE_URL?.trim() || undefined }).chat(modelId);
    },
  },

  /* ------------------------------------------------------------------------ */
  /*  Anthropic 직접 API  (비활성 — 쓰려면 위 import 와 함께 주석 해제)           */
  /*    인증: ANTHROPIC_API_KEY                                                 */
  /* ------------------------------------------------------------------------ */
  // anthropic: {
  //   label: "Anthropic",
  //   model: "claude-haiku-4-5",
  //   create: (modelId) => createAnthropic()(modelId),
  // },
} satisfies Record<string, ProviderEntry>;

/* ========================================================================== */
/*  아래는 수정할 필요 없음                                                     */
/* ========================================================================== */

export type ProviderId = keyof typeof PROVIDERS;

function isProviderId(value: string): value is ProviderId {
  return value in PROVIDERS;
}

export interface ResolvedModel {
  provider: ProviderId;
  label: string;
  modelId: string;
  model: LanguageModel;
  /** generateText({ providerOptions }) 에 그대로 넘긴다 */
  providerOptions?: ProviderOptions;
}

/** 지금 어떤 프로바이더/모델을 쓰는지 (키 없이 설정만 읽음 — /api/status 표시용) */
export function describeModel(): {
  provider: string;
  label: string;
  modelId: string;
  lightModelId: string;
  cheapModelId: string;
  routing: boolean;
  region?: string;
} {
  const requested = process.env.AI_PROVIDER?.trim() || ACTIVE_PROVIDER;
  const entry: ProviderEntry | undefined = isProviderId(requested) ? PROVIDERS[requested] : undefined;
  const main = process.env.AI_MODEL?.trim() || entry?.model || "";
  const light = process.env.AI_MODEL_LIGHT?.trim() || entry?.lightModel || main;
  const fix = (id: string) => (requested === "bedrock" ? fixBedrockModelId(id) : id);
  return {
    provider: requested,
    label: entry?.label ?? "(알 수 없음)",
    modelId: fix(main),
    lightModelId: fix(light),
    cheapModelId: fix(process.env.AI_CHEAP_MODEL?.trim() || entry?.cheapModel || light),
    routing: process.env.AI_ROUTING?.trim() !== "off",
    ...(requested === "bedrock" ? { region: bedrockRegion() } : {}),
  };
}

/**
 * 환경변수 > 설정 파일 순으로 프로바이더/모델을 결정해 모델 인스턴스를 만든다.
 * @param purpose "cheap" 이면 보조 작업용 저렴한 모델 (AI_CHEAP_MODEL > cheapModel)
 */
export type ModelTier = "chat" | "light" | "cheap" | "mature";

/** 모델 이름 앞에 "프로바이더:" 를 붙이면 그 프로바이더로 호출한다. 예) AI_MODEL_MATURE=xai:grok-4.7 */
export function splitProviderPrefix(spec: string): { provider?: ProviderId; modelId: string } {
  const m = /^([a-z]+):(.+)$/.exec(spec.trim());
  if (m && isProviderId(m[1])) return { provider: m[1], modelId: m[2] };
  return { modelId: spec.trim() };
}

function build(provider: ProviderId, modelId: string): ResolvedModel {
  const entry: ProviderEntry = PROVIDERS[provider];
  const id = provider === "bedrock" ? fixBedrockModelId(modelId) : modelId;
  return { provider, label: entry.label, modelId: id, model: entry.create(id), providerOptions: entry.options?.(id) };
}

/** 🛠 주인님 모드: 프로바이더·모델 ID 를 직접 지정해 호출 (설정과 무관, 주인 토큰을 확인한 뒤에만 쓸 것) */
export function resolveOverrideModel(provider: string, modelId: string): ResolvedModel {
  if (!isProviderId(provider)) throw new Error(`알 수 없는 프로바이더: ${provider} (사용 가능: ${Object.keys(PROVIDERS).join(", ")})`);
  return build(provider, modelId.trim());
}

/** 프로바이더별 인증 정보가 설정돼 있는지 (값은 내보내지 않음) */
export function providerKeys(): Record<ProviderId, boolean> {
  const has = (k: string) => !!process.env[k]?.trim();
  return {
    bedrock: has("AWS_BEDROCK_API_KEY") || has("AWS_BEARER_TOKEN_BEDROCK") || process.env.BEDROCK_USE_IAM === "true",
    google: has("GOOGLE_GENERATIVE_AI_API_KEY"),
    xai: has("XAI_API_KEY"),
    openai: has("OPENAI_API_KEY"),
  };
}

export function resolveModel(purpose: ModelTier = "chat"): ResolvedModel {
  const requested = process.env.AI_PROVIDER?.trim() || ACTIVE_PROVIDER;
  if (!isProviderId(requested)) {
    throw new Error(
      `[config/ai] AI_PROVIDER="${requested}" 를 사용할 수 없습니다. ` +
        `사용 가능: ${Object.keys(PROVIDERS).join(", ")} (config/ai.ts 에서 주석 처리된 프로바이더는 주석 해제 필요)`
    );
  }
  const entry: ProviderEntry = PROVIDERS[requested];
  let modelId = process.env.AI_MODEL?.trim() || entry.model;
  // 프로바이더와 맞지 않는 모델 이름이면(예: google 인데 Claude 이름) 설정 파일 기본값으로
  if (requested === "google" && !/^gemini|^models\//.test(modelId)) modelId = entry.model;
  if (requested === "bedrock" && /^gemini/.test(modelId)) modelId = entry.model;
  if (requested === "xai" && !/^grok/.test(modelId)) modelId = entry.model;
  const light = process.env.AI_MODEL_LIGHT?.trim() || entry.lightModel || modelId;
  if (purpose === "light") modelId = light;
  // 🔞 mature: 성인 확인을 마친 유저가 매혹(설렘) 모드를 켠 대화에만 쓰는 모델. 환경변수 AI_MODEL_MATURE 가 없으면 메인 모델.
  //    예) Bedrock: AI_MODEL_MATURE=mistral.mistral-large-2407-v1:0 · 다른 프로바이더: AI_MODEL_MATURE=xai:grok-4.7  (docs/MODES.md 4번)
  if (purpose === "mature") {
    const m = settingValue("matureModel");
    if (m) {
      const sp = splitProviderPrefix(m);
      return build(sp.provider ?? requested, sp.modelId);
    }
  }
  if (purpose === "cheap") modelId = process.env.AI_CHEAP_MODEL?.trim() || entry.cheapModel || light;
  return build(requested, modelId);
}

/** 성인(매혹) 전용 모델이 따로 설정돼 있으면 그 모델 ID (프로바이더 접두사 처리·리전 보정 포함), 없으면 null — 모델은 만들지 않는다 */
export function matureModelId(): string | null {
  const m = settingValue("matureModel");
  if (!m) return null;
  const sp = splitProviderPrefix(m);
  const provider = sp.provider ?? (process.env.AI_PROVIDER?.trim() || ACTIVE_PROVIDER);
  return provider === "bedrock" ? fixBedrockModelId(sp.modelId) : sp.modelId;
}


/* ────────────────────────────────────────────────────────────────────────── */
/*  🔁 우회(fallback) 모델 — 일반 대화방에서 모델이 실패하면 손님에게 오류를 보이지 않고      */
/*     아래 순서로 다른 모델이 대신 답한다 (성공률이 높았던 모델이 앞으로 올라온다).        */
/*   · 환경변수 AI_FALLBACK_MODELS (쉼표로 구분, "off" 면 끔)가 있으면 그 목록을 쓴다.     */
/*   · 앞에 "프로바이더:" 를 붙이면 그 프로바이더, 없으면 Bedrock.                       */
/*     예) AI_FALLBACK_MODELS=global.anthropic.claude-sonnet-5-5,openai:gpt-5,google:gemini-3.8-flash */
/*   · 키가 없는 프로바이더는 조용히 건너뛴다.                                        */
/* ────────────────────────────────────────────────────────────────────────── */
export const DEFAULT_FALLBACK_MODELS: readonly string[] = [
  "global.anthropic.claude-sonnet-5-5", // Sonnet 계열 (가장 성공률 높음)
  "global.anthropic.claude-haiku-4-5-20251001-v1:0",
  "openai.gpt-oss-120b-1:0", // GPT (Bedrock gpt-oss)
  "openai:gpt-5", // GPT (OpenAI 직접 — OPENAI_API_KEY 가 있을 때만)
  "google:gemini-3.8-flash", // GOOGLE_GENERATIVE_AI_API_KEY 가 있을 때만
  "global.amazon.nova-2-lite-v1:0",
];

export function fallbackSpecs(): string[] {
  const raw = settingValue("fallbackModels").trim();
  if (raw.toLowerCase() === "off") return [];
  if (!raw) return [...DEFAULT_FALLBACK_MODELS];
  return raw.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
}

export interface FallbackEntry {
  spec: string;
  provider: ProviderId;
  modelId: string;
  /** 키가 있어 실제로 쓸 수 있는가 */
  usable: boolean;
}

/** 우회 목록 (🛠 표시용) */
export function describeFallbacks(): FallbackEntry[] {
  const keys = providerKeys();
  return fallbackSpecs().flatMap((spec) => {
    const sp = splitProviderPrefixAny(spec);
    return [{ spec, provider: sp.provider, modelId: sp.modelId, usable: keys[sp.provider] }];
  });
}

function splitProviderPrefixAny(spec: string): { provider: ProviderId; modelId: string } {
  const sp = splitProviderPrefix(spec);
  return { provider: sp.provider ?? "bedrock", modelId: sp.modelId };
}

/** 실제로 호출 가능한 우회 모델 인스턴스들 (키 없거나 만들기 실패한 것은 제외) */
export function resolveFallbacks(): ResolvedModel[] {
  const out: ResolvedModel[] = [];
  for (const e of describeFallbacks()) {
    if (!e.usable) continue;
    try {
      out.push(build(e.provider, e.modelId));
    } catch (err) {
      console.warn(`[fallback] ${e.spec} 준비 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return out;
}
