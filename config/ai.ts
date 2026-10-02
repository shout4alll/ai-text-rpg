import "server-only";
import type { LanguageModel } from "ai";

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
// import { createOpenAI } from "@ai-sdk/openai";       // OpenAI 사용 시 주석 해제
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
}

const PROVIDERS = {
  /* ------------------------------------------------------------------------ */
  /*  Amazon Bedrock  (활성)                                                   */
  /*    인증: AWS_BEDROCK_API_KEY (Bedrock API 키)                              */
  /*          IAM 키를 쓰려면 BEDROCK_USE_IAM=true + AWS_ACCESS_KEY_ID/SECRET     */
  /*          (Vercel 은 쓸 수 없는 AWS_* 값을 자동 주입할 수 있어 명시적으로만 사용) */
  /*    리전: BEDROCK_REGION > AWS_REGION > us-east-1                           */
  /*    ⚠️ 모델은 AWS 콘솔 → Bedrock → Model access 에서 계정별로 활성화해야 한다. */
  /* ------------------------------------------------------------------------ */
  bedrock: {
    label: "Amazon Bedrock",
    // 아래 중 하나만 주석 해제
    model: "amazon.nova-lite-v1:0", // Amazon Nova Lite — us-east-1 리전 내 호출, 빠르고 저렴
    // model: "us.amazon.nova-pro-v1:0",                       // Amazon Nova Pro (교차 리전)
    // model: "us.anthropic.claude-haiku-4-5-20251001-v1:0",   // Claude Haiku 4.5 (교차 리전 추론 프로파일)
    // model: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",  // Claude Sonnet 4.5 (교차 리전 추론 프로파일)
    // model: "anthropic.claude-3-5-sonnet-20240620-v1:0",     // Claude 3.5 Sonnet v1 — 현재 AWS 리전 목록에서 빠짐(단종 추정), 비권장
    create: (modelId) => {
      const apiKey = process.env.AWS_BEDROCK_API_KEY || process.env.AWS_BEARER_TOKEN_BEDROCK;
      const useIam = process.env.BEDROCK_USE_IAM === "true";
      if (!apiKey && !useIam) {
        throw new Error(
          "[config/ai] Bedrock 인증 정보가 없습니다. AWS_BEDROCK_API_KEY 를 설정하세요. " +
            "(IAM 액세스 키를 쓰려면 BEDROCK_USE_IAM=true 와 AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY 설정)"
        );
      }
      return createAmazonBedrock({
        // Vercel 은 AWS_REGION 을 함수 실행 리전으로 자동 주입할 수 있어 전용 변수를 먼저 본다.
        region: process.env.BEDROCK_REGION || process.env.AWS_REGION || "us-east-1",
        apiKey: useIam ? undefined : apiKey,
        baseURL: process.env.BEDROCK_BASE_URL || undefined, // (선택) 프록시/테스트용
      })(modelId);
    },
  },

  /* ------------------------------------------------------------------------ */
  /*  Google Gemini  (대기 — AI_PROVIDER=google 로 바로 전환 가능)               */
  /*    인증: GOOGLE_GENERATIVE_AI_API_KEY                                     */
  /* ------------------------------------------------------------------------ */
  google: {
    label: "Google Gemini",
    model: "gemini-flash-latest",
    // model: "gemini-2.5-flash",
    // model: "gemini-2.5-pro",
    create: (modelId) =>
      createGoogleGenerativeAI({
        baseURL: process.env.GOOGLE_GENERATIVE_AI_BASE_URL || undefined,
      })(modelId),
  },

  /* ------------------------------------------------------------------------ */
  /*  OpenAI  (비활성 — 쓰려면 위 import 와 함께 주석 해제)                       */
  /*    인증: OPENAI_API_KEY                                                    */
  /* ------------------------------------------------------------------------ */
  // openai: {
  //   label: "OpenAI",
  //   model: "gpt-4o-mini",
  //   create: (modelId) => createOpenAI()(modelId),
  // },

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
}

/** 환경변수 > 설정 파일 순으로 프로바이더/모델을 결정해 모델 인스턴스를 만든다. */
export function resolveModel(): ResolvedModel {
  const requested = process.env.AI_PROVIDER?.trim() || ACTIVE_PROVIDER;
  if (!isProviderId(requested)) {
    throw new Error(
      `[config/ai] AI_PROVIDER="${requested}" 를 사용할 수 없습니다. ` +
        `사용 가능: ${Object.keys(PROVIDERS).join(", ")} (config/ai.ts 에서 주석 처리된 프로바이더는 주석 해제 필요)`
    );
  }
  const entry: ProviderEntry = PROVIDERS[requested];
  const modelId = process.env.AI_MODEL?.trim() || entry.model;
  return { provider: requested, label: entry.label, modelId, model: entry.create(modelId) };
}
