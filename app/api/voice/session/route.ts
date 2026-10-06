import { NextResponse } from "next/server";
import { GoogleGenAI, Modality } from "@google/genai";
import { z } from "zod";
import { getPersonaFile, isPersonaId } from "@/lib/personas/server";
import { AFFECTION_START } from "@/config/reactions";
import { checkVoiceAccess, voiceMaxSeconds } from "@/lib/voice/access";
import { buildVoiceInstructions, voiceNameFor } from "@/lib/voice/instructions";

/**
 * POST /api/voice/session — 보이스톡 시작
 *
 * 브라우저가 Gemini Live API 에 직접 연결할 수 있도록 "일회용 토큰"을 발급한다.
 *  - 진짜 API 키(GOOGLE_GENERATIVE_AI_API_KEY)는 서버에만 있다.
 *  - 인물 프롬프트·모델·목소리는 토큰에 잠가서(lock) 브라우저가 바꿀 수 없다.
 *  - 토큰은 1회용, 1분 안에 연결해야 하고, 통화는 maxSeconds 뒤 끊긴다.
 *
 * 모델: GEMINI_LIVE_MODEL (기본 gemini-3.1-flash-live-preview) — docs/VOICE_TALK.md
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MODEL = "gemini-3.1-flash-live-preview";

const bodySchema = z.object({
  personaId: z.string().max(64),
  affection: z.number().min(0).max(100).optional(),
  timeZone: z.string().max(64).optional(),
  /** 최근 톡 대화 (맥락용) */
  recent: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(1000) }))
    .max(40)
    .optional(),
  /** 과금 방식 — trial(무료 체험)은 서버에서도 통화 길이를 짧게 제한 */
  mode: z.enum(["trial", "plan", "cash"]).optional(),
});

export async function POST(request: Request) {
  const access = checkVoiceAccess(request);
  if (!access.ok) return NextResponse.json({ error: access.error, code: access.status }, { status: access.status });

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "보이스톡 설정이 아직 안 됐어요. (서버에 GOOGLE_GENERATIVE_AI_API_KEY 필요)" },
      { status: 503 }
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!isPersonaId(body.personaId)) {
    return NextResponse.json({ error: `Unknown personaId: ${body.personaId}` }, { status: 400 });
  }

  const persona = getPersonaFile(body.personaId);
  const model = process.env.GEMINI_LIVE_MODEL?.trim() || DEFAULT_MODEL;
  const voice = voiceNameFor(persona);
  // 무료 체험(주고받기 5번)은 3분이면 충분 → 토큰 자체를 짧게 (클라이언트 조작 대비)
  const maxSeconds = body.mode === "trial" ? Math.min(180, voiceMaxSeconds()) : voiceMaxSeconds();

  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1alpha" } });
    const now = Date.now();
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        // 통화 중 메시지 허용 시간 (최대 통화 길이 + 여유 1분)
        expireTime: new Date(now + (maxSeconds + 60) * 1000).toISOString(),
        // 이 시간 안에 연결을 시작해야 함
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model,
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: buildVoiceInstructions({
              persona,
              affection: body.affection ?? AFFECTION_START,
              userTimeZone: body.timeZone,
              recent: body.recent ?? [],
            }),
            speechConfig: {
              languageCode: "ko-KR",
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
            },
            // 자막 + 통화 후 대화 기록용
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            temperature: persona.prompt.temperature ?? 1.0,
          },
        },
      },
    });

    if (!token.name) throw new Error("empty token");
    return NextResponse.json({ token: token.name, model, voice, maxSeconds });
  } catch (error) {
    console.error("[/api/voice/session] token error:", error);
    return NextResponse.json({ error: "보이스톡 연결을 준비하지 못했어요. 잠시 후 다시 걸어 주세요." }, { status: 500 });
  }
}
