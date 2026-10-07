import { NextResponse } from "next/server";
import { describeModel } from "@/config/ai";
import { voiceAccessMode } from "@/lib/voice/access";

/**
 * GET /api/status — 지금 어떤 AI 모델로 대화·보이스톡·사진을 처리하는지 확인 (키 값은 보여 주지 않는다)
 * 예: https://<사이트>/api/status
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const chat = describeModel();
  const hasGoogle = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const hasBedrock = !!(process.env.AWS_BEDROCK_API_KEY || process.env.AWS_BEARER_TOKEN_BEDROCK) || process.env.BEDROCK_USE_IAM === "true";
  return NextResponse.json({
    chat: {
      ...chat,
      keyConfigured: chat.provider === "bedrock" ? hasBedrock : chat.provider === "google" ? hasGoogle : null,
    },
    voiceTalk: {
      provider: "Google Gemini Live",
      model: process.env.GEMINI_LIVE_MODEL?.trim() || "gemini-3.8-live",
      access: voiceAccessMode(),
      keyConfigured: hasGoogle,
    },
    livePhoto: {
      provider: "Google Gemini (이미지)",
      model: process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-3.1-flash-image",
      keyConfigured: hasGoogle,
    },
    voicePreview: {
      provider: "Google Gemini TTS",
      model: process.env.GEMINI_TTS_MODEL?.trim() || "gemini-3.8-flash-lite-tts",
      keyConfigured: hasGoogle,
    },
  });
}
