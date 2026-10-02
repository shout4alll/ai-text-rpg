import "server-only";
import { z } from "zod";
import { PERSONA_FILES, SHARED_FILE } from "@/personas";
import { personaFileSchema, sharedFileSchema, type PersonaFile } from "@/lib/personas/schema";
import type { Persona } from "@/lib/personas/types";

/**
 * 페르소나 파일 로더 (서버 전용).
 * personas/index.ts 에 등록된 JSON 을 검증하고, 화면용 공개 데이터와 서버용 프롬프트를 나눠 제공한다.
 */

function validate(): PersonaFile[] {
  const seen = new Set<string>();
  return PERSONA_FILES.map(({ file, data }) => {
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

/** 화면용 공개 데이터 (프롬프트 제외) */
export function toPublic(p: PersonaFile): Persona {
  const base = `/avatar/personas/${p.id}`;
  return {
    id: p.id,
    name: p.name,
    title: p.title,
    profile: { age: p.age, occupation: p.occupation, gender: p.gender },
    description: p.description,
    tags: p.tags,
    greeting: p.greeting,
    accent: p.accent,
    assets: {
      poster: `${base}/${p.image.portrait}`,
      clipsDir: `${base}/clips`,
      objectPosition: p.image.objectPosition,
      ...(p.image.fallbackClipsDir ? { fallbackClipsDir: p.image.fallbackClipsDir } : {}),
      ...(p.image.fallbackPoster ? { fallbackPoster: p.image.fallbackPoster } : {}),
    },
  };
}

export function listPublicPersonas(): Persona[] {
  return FILES.map(toPublic);
}
