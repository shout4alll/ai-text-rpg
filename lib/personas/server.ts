import "server-only";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { PERSONA_FILES, SHARED_FILE } from "@/personas";
import { personaFileSchema, sharedFileSchema, type PersonaFile } from "@/lib/personas/schema";
import type { Persona } from "@/lib/personas/types";
import { LOOKS } from "@/config/looks";
import type { AlbumItem } from "@/config/media";
import { balanceSchema } from "@/config/balanceSchema";
import balanceJson from "@/config/balance.json";

// config/balance.json 형식 검사 (빌드·서버 시작 시) — 틀리면 어느 항목인지 알려 준다
{
  const b = balanceSchema.safeParse(balanceJson);
  if (!b.success) throw new Error(`[balance] config/balance.json 형식 오류:\n${z.prettifyError(b.error)}`);
}

/**
 * 페르소나 파일 로더 (서버 전용).
 * personas/index.ts 에 등록된 JSON 을 검증하고, 화면용 공개 데이터와 서버용 프롬프트를 나눠 제공한다.
 */

/**
 * 📦 업데이트 이원화: personas/ 폴더의 *.json 을 서버가 직접 읽는다 → 인물 추가는 JSON 파일 + public/avatar/personas/<id>/ 리소스만
 *    올리고 배포하면 끝 (앱 재빌드·코드 수정 불필요). 앱은 /api/personas 로 최신 목록을 받는다.
 *    순서: 파일의 order 값(작을수록 앞) → 파일 이름. hidden: true 면 목록에서 뺀다. _ 로 시작하는 파일은 공용 파일.
 *    폴더를 못 읽는 환경이면 personas/index.ts 의 등록 목록을 쓴다.
 */
function loadPersonaFiles(): { file: string; data: unknown }[] {
  const dir = path.join(process.cwd(), "personas");
  try {
    const names = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
    if (names.length === 0) return PERSONA_FILES;
    const items = names.map((file) => ({ file, data: JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as Record<string, unknown> }));
    const known = PERSONA_FILES.map((f) => f.file);
    const rank = (f: { file: string; data: Record<string, unknown> }) =>
      typeof f.data.order === "number" ? f.data.order : known.includes(f.file) ? known.indexOf(f.file) : 1000;
    return items.filter((f) => f.data.hidden !== true).sort((a, b) => rank(a) - rank(b) || a.file.localeCompare(b.file));
  } catch {
    return PERSONA_FILES;
  }
}

function validate(): PersonaFile[] {
  const seen = new Set<string>();
  return loadPersonaFiles().map(({ file, data }) => {
    const parsed = personaFileSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(`[personas] ${file} 형식 오류:\n${z.prettifyError(parsed.error)}`);
    }
    const p = parsed.data;
    if (`${p.id}.json` !== file) {
      throw new Error(`[personas] ${file} 의 id("${p.id}")가 파일 이름과 다릅니다. 파일 이름을 ${p.id}.json 으로 맞추세요.`);
    }
    if (seen.has(p.id)) throw new Error(`[personas] id 중복: ${p.id}`);
    seen.add(p.id);
    return p;
  });
}

const FILES = validate();
if (FILES.length === 0) throw new Error("[personas] 등록된 페르소나가 없습니다. personas/index.ts 를 확인하세요.");

const sharedParsed = sharedFileSchema.safeParse(SHARED_FILE);
if (!sharedParsed.success) {
  throw new Error(`[personas] _shared.json 형식 오류:\n${z.prettifyError(sharedParsed.error)}`);
}

/** 모든 페르소나에 공통으로 붙는 규칙 (프롬프트용 문자열) */
export const SHARED_RULES = sharedParsed.data.rules.map((r) => `- ${r}`).join("\n");
/** 같은 규칙의 목록 형태 (🛠 규칙 탭 기본값) */
export const SHARED_RULES_LIST: string[] = [...sharedParsed.data.rules];

const BY_ID = new Map(FILES.map((p) => [p.id, p]));

/** 목록의 첫 번째 페르소나가 기본값 */
export const DEFAULT_PERSONA_ID = FILES[0].id;

export function isPersonaId(id: unknown): id is string {
  return typeof id === "string" && BY_ID.has(id);
}

/** 서버 전용: 프롬프트까지 포함한 전체 파일 */
export function getPersonaFile(id: string): PersonaFile {
  const p = BY_ID.get(id);
  if (!p) throw new Error(`[personas] unknown id: ${id}`);
  return p;
}

const CLIP_EXT = process.env.NEXT_PUBLIC_AVATAR_CLIP_EXT || "mp4";

/** public/<urlPath> 파일이 있는지 */
function publicFileExists(urlPath: string): boolean {
  try {
    return fs.statSync(path.join(process.cwd(), "public", urlPath)).isFile();
  } catch {
    return false;
  }
}

/** public/<urlDir> 안의 영상 파일을 찾아 { 이름: URL } 로 반환 (없으면 빈 객체) */
function scanClips(urlDir: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const abs = path.join(process.cwd(), "public", urlDir);
    for (const f of fs.readdirSync(abs)) {
      const m = f.match(/^(.+)\.([a-z0-9]+)$/i);
      if (m && m[2].toLowerCase() === CLIP_EXT) out[m[1]] = `${urlDir}/${f}`;
    }
  } catch {
    /* 폴더 없음 */
  }
  return out;
}

/**
 * 📸 이 인물이 가진 기본 사진(룩) — public/avatar/personas/<id>/base/<룩id>.(jpg|png|webp)
 * 파일이 있는 룩만 돌려준다 (config/looks.json 순서).
 */
export function looksOf(p: PersonaFile): { id: string; label: string; src: string }[] {
  const dir = `/avatar/personas/${p.id}/base`;
  try {
    const files = fs.readdirSync(path.join(process.cwd(), "public", dir));
    const out: { id: string; label: string; src: string }[] = [];
    for (const l of LOOKS) {
      const f = files.find((n) => /\.(jpe?g|png|webp)$/i.test(n) && n.replace(/\.[^.]+$/, "") === l.id);
      if (f) out.push({ id: l.id, label: l.label, src: `${dir}/${f}` });
    }
    return out;
  } catch {
    return []; // base 폴더가 없으면 지금까지처럼 stage.jpg·앨범만 쓴다
  }
}

/** 앨범 항목을 공개 URL 로 */
export function albumOf(p: PersonaFile): AlbumItem[] {
  const base = `/avatar/personas/${p.id}`;
  return p.album.map((a) => ({ id: a.id, type: a.type, src: `${base}/${a.file.replace(/^\/+/, "")}`, desc: a.desc }));
}

/** 화면용 공개 데이터 (프롬프트 제외) */
export function toPublic(p: PersonaFile): Persona {
  const base = `/avatar/personas/${p.id}`;
  // 인물 폴더의 클립이 우선, 없는 이름만 (같은 인물의) 대체 폴더에서 채운다
  const clips = {
    ...(p.image.fallbackClipsDir ? scanClips(p.image.fallbackClipsDir) : {}),
    ...scanClips(`${base}/clips`),
  };
  return {
    id: p.id,
    name: p.name,
    status: p.status,
    profile: { age: p.age, occupation: p.occupation, gender: p.gender },
    description: p.description,
    tags: p.tags,
    relationshipType: p.relationshipType,
    greeting: p.greeting,
    ...(p.cheatRoom ? { cheatRoom: true } : {}),
    ...(p.balance ? { balance: p.balance } : {}),
    accent: p.accent,
    ...(p.touchLines ? { touchLines: p.touchLines } : {}),
    ...(p.allure
      ? {
          allure: true,
          allureUi: {
            emoji: p.allure.emoji ?? (p.gender === "male" ? "🌙" : "💋"),
            label: p.allure.label ?? (p.gender === "male" ? "설렘 모드" : "매혹 모드"),
          },
        }
      : {}),
    voiceName: p.voice?.name ?? (p.gender === "male" ? "Puck" : "Leda"),
    ...(p.story ? { story: p.story } : {}),
    details: {
      likes: p.traits?.likes ?? [],
      dislikes: p.traits?.dislikes ?? [],
      // 하루 일과 (프롬프트의 lifestyle — 3인칭 설명이라 공개해도 되는 부분만)
      lifestyle: p.prompt.lifestyle,
    },
    traits: {
      gift: p.traits?.gift ?? { name: "꽃다발", emoji: "💐" },
      ...(p.traits?.giftLikes ? { giftLikes: p.traits.giftLikes } : {}),
      reactionBias: p.traits?.reactionBias ?? {},
      stageUpLines: p.traits?.stageUpLines ?? [],
    },
    album: albumOf(p),
    assets: {
      poster: `${base}/${p.image.portrait}`,
      clips,
      objectPosition: p.image.objectPosition,
      ...(publicFileExists(`${base}/stage.jpg`) ? { stagePoster: `${base}/stage.jpg` } : {}),
      stagePosition: p.image.stagePosition,
      premiumClips: scanClips(`${base}/clips/premium`),
      // ⭐ 특별 리액션 영상 — clips/special/ (이름 앞에 special_ 를 붙여 일반 영상과 섞이지 않게)
      specialClips: Object.fromEntries(Object.entries(scanClips(`${base}/clips/special`)).map(([k, v]) => [`special_${k}`, v])),
      allureClips: p.allure
        ? Object.fromEntries(Object.entries(scanClips(`${base}/clips/allure`)).map(([k, v]) => [`allure_${k}`, v]))
        : {},
      ...(p.image.fallbackPoster ? { fallbackPoster: p.image.fallbackPoster } : {}),
    },
  };
}

export function listPublicPersonas(): Persona[] {
  return FILES.map(toPublic);
}
