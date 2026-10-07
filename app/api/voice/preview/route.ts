import { NextResponse } from "next/server";
import { GoogleGenAI, Modality } from "@google/genai";
import { z } from "zod";
import { getPersonaFile, isPersonaId } from "@/lib/personas/server";
import { checkVoiceAccess } from "@/lib/voice/access";
import { isGeminiVoice } from "@/config/voices";

/**
 * POST /api/voice/preview — 목소리 미리 듣기 (/voice-lab 전용)
 *
 * 인물의 대사 한 줄을 Gemini TTS 로 읽어 준다. 보이스톡(Live)과 같은 "기본 목소리 이름"을 쓰므로
 * 영상 속 목소리와 비교해 가장 비슷한 목소리를 고르는 데 쓴다.
 * (TTS 와 Live 는 같은 목소리 이름을 쓰지만 모델이 달라 아주 조금 다르게 들릴 수 있다)
 *
 * 비용 보호: 보이스톡과 같은 이용 권한(VOICE_ACCESS / VOICE_DEV_PASS)이 있어야 한다.
 * 모델: GEMINI_TTS_MODEL (기본 gemini-3.8-flash-lite-tts) — 안 되면 예전 모델로 자동 재시도
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FALLBACK_MODELS = ["gemini-3.8-flash-lite-tts", "gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"];

const bodySchema = z.object({
  personaId: z.string().max(64),
  voice: z.string().max(40),
  text: z.string().min(1).max(200).optional(),
});

export async function POST(request: Request) {
  const access = checkVoiceAccess(request);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_GENERATIVE_AI_API_KEY 가 필요해요." }, { status: 503 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isPersonaId(parsed.data.personaId) || !isGeminiVoice(parsed.data.voice)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const persona = getPersonaFile(parsed.data.personaId);
  const style = persona.voice?.style ?? "자연스럽게";
  const line = parsed.data.text ?? persona.greeting.slice(0, 120);
  const prompt = `다음 한국어 대사를 이런 느낌으로 읽어 줘: ${style}\n\n${line}`;

  const env = process.env.GEMINI_TTS_MODEL?.trim();
  const models = env ? [env, ...FALLBACK_MODELS.filter((m) => m !== env)] : FALLBACK_MODELS;
  const ai = new GoogleGenAI({ apiKey });
  let lastErr: unknown = null;
  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: parsed.data.voice } } },
        },
      });
      const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part?.inlineData?.data) throw new Error("no audio");
      return NextResponse.json({ audio: part.inlineData.data, mimeType: part.inlineData.mimeType ?? "audio/L16;rate=24000", model });
    } catch (err) {
      lastErr = err;
      const msg = String((err as Error)?.message ?? err);
      // 모델이 없거나 지원 안 하면 다음 모델로, 그 밖의 오류는 바로 중단
      if (!/404|not found|not supported|NOT_FOUND|INVALID_ARGUMENT/i.test(msg)) break;
    }
  }
  console.error("[/api/voice/preview]", lastErr);
  const quota = /429|quota|RESOURCE_EXHAUSTED/i.test(String((lastErr as Error)?.message ?? lastErr));
  return NextResponse.json(
    { error: quota ? "미리 듣기 사용량이 다 찼어요. 잠시 뒤 다시 해 주세요." : "미리 듣기를 만들지 못했어요." },
    { status: quota ? 503 : 502 }
  );
}
