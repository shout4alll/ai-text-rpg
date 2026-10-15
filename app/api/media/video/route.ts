import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { getPersonaFile, isPersonaId, albumOf, looksOf } from "@/lib/personas/server";
import { pickLook } from "@/config/looks";
import { checkMediaAccess } from "@/lib/entitlements";

/**
 * /api/media/video — 유료 "실시간 영상" 생성 (Gemini Omni Flash, 백그라운드 작업)
 *
 *  POST  {personaId, request}        → 생성 시작, {id} 반환 (생성에 보통 1~2분 → 함수 시간 제한을 피하려고 시작/확인/받기를 나눈다)
 *  GET   ?id=...                      → {status: "working" | "done" | "failed", error?}
 *  GET   ?id=...&file=1               → 완성된 mp4 파일
 *
 * 인물 사진(stage.jpg·앨범·대표)을 기준 이미지로 넣어 같은 얼굴의 짧은 세로 영상을 만든다.
 * 모델: GEMINI_VIDEO_MODEL (기본 gemini-omni-1.1-flash) — 720p 기준 약 $0.10/초 (유료 등급만). docs/MEDIA.md
 * ⚠️ 이 모델은 서버 API 형태(Interactions API)가 바뀔 수 있어, 실제 키로 한 번 시험해 보세요.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_MODEL = "gemini-omni-1.1-flash";
const MAX_REFS = 3;
const DURATION_SEC = 5;

const bodySchema = z.object({
  personaId: z.string().max(64),
  request: z.string().min(1).max(200),
});

/** 그 인물의 현지 시각(시) — 요청에 단서가 없을 때 어울리는 룩을 고르는 데 쓴다 */
function hourIn(timeZone: string): number | undefined {
  try {
    return Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  } catch {
    return undefined;
  }
}

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

/** 응답 어디에 있든 영상 조각({type:"video", data|uri})을 찾는다 */
function findVideo(x: unknown): { data?: string; uri?: string; mime_type?: string } | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (o.type === "video" && (typeof o.data === "string" || typeof o.uri === "string")) return o as { data?: string; uri?: string; mime_type?: string };
  for (const v of Object.values(o)) {
    const r = findVideo(v);
    if (r) return r;
  }
  return null;
}

const ID_RE = /^[A-Za-z0-9_\-./]{6,200}$/;

export async function POST(request: Request) {
  const access = checkMediaAccess(request);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "영상 기능 설정이 아직 안 됐어요. (GOOGLE_GENERATIVE_AI_API_KEY 필요)" }, { status: 503 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { personaId, request: wish } = parsed.data;
  if (!isPersonaId(personaId)) return NextResponse.json({ error: "Unknown persona" }, { status: 400 });

  const persona = getPersonaFile(personaId);
  const base = `/avatar/personas/${persona.id}`;
  const origin = new URL(request.url).origin;
  // 📸 요청에 가장 가까운 기본 사진(룩)이 있으면 맨 앞에 (옷차림·장소를 맞춘다)
  const looks = looksOf(persona);
  const look = pickLook(wish, looks.map((l) => l.id), hourIn(persona.timezone));
  const lookSrc = look ? looks.find((l) => l.id === look.id)?.src : undefined;
  const refUrls = [...(lookSrc ? [lookSrc] : []), `${base}/stage.jpg`, ...albumOf(persona).filter((a) => a.type === "photo").map((a) => a.src), `${base}/${persona.image.portrait}`];
  const refs: { data: string; mimeType: string }[] = [];
  for (const u of refUrls) {
    if (refs.length >= MAX_REFS) break;
    const img = await loadImage(u, origin);
    if (img) refs.push(img);
  }
  if (refs.length === 0) return NextResponse.json({ error: "기준 사진이 없어요." }, { status: 500 });

  const prompt = [
    `Create a ${DURATION_SEC}-second vertical (9:16) smartphone video of the ${persona.gender === "male" ? "man" : "woman"} shown in the reference images, as if sent in a private messenger chat.`,
    "IDENTITY IS CRITICAL: exactly the same person — identical face, hair, skin tone and age. Do not beautify or change facial features.",
    `Who: ${persona.age}-year-old ${persona.occupation} (fictional character).`,
    `What the viewer asked to see (Korean): "${wish}". Interpret it naturally as a short casual video clip.`,
    look ? `The FIRST reference image shows this person in a "${look.label}" situation (${look.outfit}; ${look.place}). Keep that outfit and setting unless the request clearly asks for something else.` : "",
    "Natural, realistic, subtle movement; the person looks at the camera at times and speaks or reacts naturally with soft ambient sound. Camera mostly still, handheld feel.",
    "Always fully clothed, tasteful and non-suggestive. No text, no captions, no watermark, no other identifiable real people.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const ai = new GoogleGenAI({ apiKey, ...(process.env.GOOGLE_GENERATIVE_AI_BASE_URL?.trim() ? { httpOptions: { baseUrl: process.env.GOOGLE_GENERATIVE_AI_BASE_URL.trim() } } : {}) });
    const it = await ai.interactions.create({
      model: process.env.GEMINI_VIDEO_MODEL?.trim() || DEFAULT_MODEL,
      input: [...refs.map((r) => ({ type: "image" as const, data: r.data, mime_type: r.mimeType as "image/jpeg" })), { type: "text" as const, text: prompt }],
      response_modalities: ["video"],
      background: true,
    });
    if (!it.id) return NextResponse.json({ error: "영상을 만들지 못했어요." }, { status: 500 });
    return NextResponse.json({ id: it.id });
  } catch (error) {
    console.error("[/api/media/video] start error:", error);
    const status = (error as { status?: number })?.status;
    if (status === 429) return NextResponse.json({ error: "지금은 영상 서비스 사용량이 꽉 찼어요. 잠시 후 다시 시도해 주세요." }, { status: 503 });
    return NextResponse.json({ error: "영상을 만들지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const access = checkMediaAccess(request);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "영상 기능 설정이 아직 안 됐어요." }, { status: 503 });
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  if (!ID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    const ai = new GoogleGenAI({ apiKey, ...(process.env.GOOGLE_GENERATIVE_AI_BASE_URL?.trim() ? { httpOptions: { baseUrl: process.env.GOOGLE_GENERATIVE_AI_BASE_URL.trim() } } : {}) });
    const it = await ai.interactions.get(id);
    const status = String(it.status);
    if (status === "failed" || status === "cancelled" || status === "budget_exceeded") {
      return NextResponse.json({ status: "failed", error: "이 영상은 만들 수 없어요." });
    }
    const video = it.output_video ?? findVideo(it);
    if (status !== "completed" && !video) return NextResponse.json({ status: "working" });
    if (!video) return NextResponse.json({ status: "failed", error: "이 영상은 보낼 수 없어요." });
    if (url.searchParams.get("file") !== "1") return NextResponse.json({ status: "done" });

    // 파일 내려주기: base64 이면 풀어서, uri 이면 키로 받아서
    let bytes: Uint8Array;
    if (video.data) bytes = Uint8Array.from(Buffer.from(video.data, "base64"));
    else {
      const r = await fetch(video.uri as string, { headers: { "x-goog-api-key": apiKey } });
      if (!r.ok) return NextResponse.json({ error: "영상을 받지 못했어요." }, { status: 502 });
      bytes = new Uint8Array(await r.arrayBuffer());
    }
    return new NextResponse(bytes as unknown as BodyInit, { headers: { "content-type": video.mime_type || "video/mp4", "cache-control": "no-store" } });
  } catch (error) {
    console.error("[/api/media/video] poll error:", error);
    return NextResponse.json({ status: "working" }); // 일시 오류는 계속 기다린다 (클라이언트가 시간 제한을 둠)
  }
}
