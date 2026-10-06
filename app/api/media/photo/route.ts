import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { getPersonaFile, isPersonaId, albumOf } from "@/lib/personas/server";
import { checkMediaAccess } from "@/lib/entitlements";

/**
 * POST /api/media/photo — 유료 "실시간 사진" 생성
 *
 * 인물의 기존 사진(stage.jpg, 앨범 사진, 대표 사진)을 기준 이미지로 넣어
 * 같은 얼굴의 새 사진을 만든다. 모델: GEMINI_IMAGE_MODEL (기본 gemini-3.1-flash-image)
 *
 * 캐시 차감은 지금은 브라우저(테스트 지갑)에서 한다. 실제 판매 시 이 라우트에서 서버 잔액을 차감할 것. (docs/MEDIA.md)
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_MODEL = "gemini-3.1-flash-image";
/** 얼굴 일관성용 기준 이미지 최대 개수 (Gemini 3.1 Flash Image 권장 최대 4) */
const MAX_REFS = 4;

const bodySchema = z.object({
  personaId: z.string().max(64),
  request: z.string().min(1).max(200),
  timeZone: z.string().max(64).optional(),
});

/** 기준 이미지 읽기: 로컬 파일 → 안 되면 같은 서버에서 받아오기(Vercel 은 public 파일이 함수에 없음) */
async function loadImage(url: string, origin: string): Promise<{ data: string; mimeType: string } | null> {
  const mimeType = url.endsWith(".png") ? "image/png" : url.endsWith(".webp") ? "image/webp" : "image/jpeg";
  try {
    const buf = await fs.readFile(path.join(process.cwd(), "public", url));
    return { data: buf.toString("base64"), mimeType };
  } catch {
    /* 아래로 */
  }
  try {
    const res = await fetch(new URL(url, origin));
    if (!res.ok) return null;
    return { data: Buffer.from(await res.arrayBuffer()).toString("base64"), mimeType };
  } catch {
    return null;
  }
}

function localTime(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", weekday: "long" }).format(new Date());
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  const access = checkMediaAccess(request);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "사진 기능 설정이 아직 안 됐어요. (GOOGLE_GENERATIVE_AI_API_KEY 필요)" }, { status: 503 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { personaId, request: wish } = parsed.data;
  if (!isPersonaId(personaId)) return NextResponse.json({ error: "Unknown persona" }, { status: 400 });

  const persona = getPersonaFile(personaId);
  const base = `/avatar/personas/${persona.id}`;
  const origin = new URL(request.url).origin;

  // 기준 이미지: 리액션 화면 이미지 → 앨범 사진 → 대표 사진 순
  const refUrls = [
    `${base}/stage.jpg`,
    ...albumOf(persona)
      .filter((a) => a.type === "photo")
      .map((a) => a.src),
    `${base}/${persona.image.portrait}`,
  ];
  const refs: { data: string; mimeType: string }[] = [];
  for (const u of refUrls) {
    if (refs.length >= MAX_REFS) break;
    const img = await loadImage(u, origin);
    if (img) refs.push(img);
  }
  if (refs.length === 0) return NextResponse.json({ error: "기준 사진이 없어요." }, { status: 500 });

  const when = localTime(persona.timezone);
  const prompt = [
    `Create a new photorealistic smartphone photo of the ${persona.gender === "male" ? "man" : "woman"} shown in the reference images.`,
    "IDENTITY IS CRITICAL: it must be exactly the same person — identical face shape, eyes, nose, lips, eyebrows, skin tone, age, hair color and hairstyle. Do not beautify or change facial features.",
    `Who: ${persona.age}-year-old ${persona.occupation} (fictional character).`,
    `What the viewer asked to see (Korean): "${wish}". Interpret it naturally as a casual photo sent in a private messenger chat.`,
    when ? `Their local time right now is ${when}; match lighting and setting to it unless the request says otherwise.` : "",
    "Style: candid, natural smartphone selfie or photo taken by a friend, realistic skin texture, natural light, vertical 9:16 framing, face clearly visible.",
    "Always fully clothed, tasteful and non-suggestive. No text, no captions, no watermark, no other identifiable real people.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
      model: process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_MODEL,
      contents: [{ role: "user", parts: [...refs.map((r) => ({ inlineData: r })), { text: prompt }] }],
      config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "9:16" } },
    });
    const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) {
      // 안전 필터 등으로 이미지가 안 나옴
      return NextResponse.json({ error: "이 사진은 보낼 수 없어요." }, { status: 422 });
    }
    return NextResponse.json({ image: part.inlineData.data, mimeType: part.inlineData.mimeType ?? "image/png" });
  } catch (error) {
    console.error("[/api/media/photo] error:", error);
    return NextResponse.json({ error: "사진을 만들지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
