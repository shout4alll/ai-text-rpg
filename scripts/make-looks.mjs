/**
 * 📸 인물 기본 사진(룩) 만들기 — config/looks.json 의 옷차림·장소대로 한 장씩 생성한다.
 *
 *   node scripts/make-looks.mjs character_a                  # 그 인물의 모든 룩 (이미 있는 건 건너뜀)
 *   node scripts/make-looks.mjs character_a pajama_home       # 특정 룩만
 *   node scripts/make-looks.mjs character_a --force           # 이미 있어도 다시 만들기
 *
 * 저장 위치: public/avatar/personas/<인물id>/base/<룩id>.jpg
 * 기준 이미지는 그 인물의 stage.jpg·앨범 사진·대표 사진을 쓴다 (얼굴 일관성).
 * 키: .env.local 의 GOOGLE_GENERATIVE_AI_API_KEY
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";

const ROOT = process.cwd();
const MODEL = process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-3.1-flash-image";
const MAX_REFS = 4;

/* .env.local 읽기 */
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  console.error("GOOGLE_GENERATIVE_AI_API_KEY 가 없습니다 (.env.local)");
  process.exit(1);
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const [personaId, ...wantRaw] = args.filter((a) => a !== "--force");
const want = wantRaw.filter(Boolean);
if (!personaId) {
  console.error("사용법: node scripts/make-looks.mjs <인물id> [룩id...] [--force]");
  process.exit(1);
}

const { looks } = JSON.parse(fs.readFileSync(path.join(ROOT, "config/looks.json"), "utf8"));
const persona = JSON.parse(fs.readFileSync(path.join(ROOT, `personas/${personaId}.json`), "utf8"));
const baseUrl = `avatar/personas/${persona.id}`;
const outDir = path.join(ROOT, "public", baseUrl, "base");
fs.mkdirSync(outDir, { recursive: true });

/* 기준 이미지 (얼굴 일관성) */
const refFiles = [
  path.join(ROOT, "public", baseUrl, "stage.jpg"),
  ...(persona.album ?? [])
    .filter((a) => a.type === "photo")
    .map((a) => path.join(ROOT, "public", baseUrl, a.file.replace(/^\/+/, ""))),
  path.join(ROOT, "public", baseUrl, persona.image.portrait),
];
const refs = [];
for (const f of refFiles) {
  if (refs.length >= MAX_REFS) break;
  try {
    const buf = fs.readFileSync(f);
    const mimeType = f.endsWith(".png") ? "image/png" : f.endsWith(".webp") ? "image/webp" : "image/jpeg";
    refs.push({ data: buf.toString("base64"), mimeType });
  } catch {
    /* 없는 파일은 건너뜀 */
  }
}
if (refs.length === 0) {
  console.error(`기준 사진이 없습니다: public/${baseUrl}/`);
  process.exit(1);
}

const who = persona.gender === "male" ? "man" : "woman";
const ai = new GoogleGenAI({ apiKey });

const targets = looks.filter((l) => (want.length ? want.includes(l.id) : true));
if (targets.length === 0) {
  console.error(`그런 룩이 없습니다: ${want.join(", ")}`);
  process.exit(1);
}

console.log(`${persona.name}(${persona.id}) · 기준 사진 ${refs.length}장 · 모델 ${MODEL}`);

let made = 0;
for (const look of targets) {
  const out = path.join(outDir, `${look.id}.jpg`);
  if (!force && fs.existsSync(out)) {
    console.log(`  - ${look.id} (${look.label}) 이미 있음 — 건너뜀`);
    continue;
  }
  const prompt = [
    `Create a photorealistic smartphone photo of the ${who} shown in the reference images.`,
    "IDENTITY IS CRITICAL: exactly the same person — identical face shape, eyes, nose, lips, eyebrows, skin tone, age, hair color and hairstyle. Do not beautify or change facial features.",
    `Who: ${persona.age}-year-old ${persona.occupation} (fictional character).`,
    `Outfit: ${look.outfit}.`,
    `Setting: ${look.place}.`,
    "Framing: vertical 9:16, upper body to waist, face clearly visible and well lit, candid and natural like a photo taken by a friend or a casual selfie.",
    "Always fully clothed, tasteful and non-suggestive. No text, no captions, no watermark, no other people.",
  ].join("\n");

  process.stdout.write(`  · ${look.id} (${look.label}) 만드는 중… `);
  try {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [...refs.map((r) => ({ inlineData: r })), { text: prompt }] }],
      config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "9:16" } },
    });
    const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part) {
      console.log("실패 (이미지가 오지 않음 — 안전 필터일 수 있음)");
      continue;
    }
    const buf = Buffer.from(part.inlineData.data, "base64");
    await sharp(buf).resize({ height: 1280, withoutEnlargement: true }).jpeg({ quality: 86 }).toFile(out);
    made++;
    console.log(`저장 (${(fs.statSync(out).size / 1024).toFixed(0)}KB)`);
  } catch (e) {
    console.log(`실패: ${String(e?.message ?? e).slice(0, 140)}`);
  }
}
console.log(`\n완료: ${made}장 → public/${baseUrl}/base/`);
