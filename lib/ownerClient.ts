import type { OwnerOpts, PersonaOverride, PromptMode, RulesOverride } from "@/lib/ownerOverrides";

/**
 * 🛠 주인님 모드 테스트 설정의 브라우저 저장소 (이 기기에만 저장 — CMS 가 생기면 이 파일의 저장 방식만 서버로 바꾸면 된다)
 * 채팅을 보낼 때마다 buildOwnerOpts() 가 /api/chat 요청에 실어 보내고, 서버는 주인 토큰이 맞을 때만 반영한다.
 */
const KEY = "ai-rpg.owner.opts";

export interface StoredOwnerOpts {
  model?: { provider: string; modelId: string };
  promptMode?: PromptMode;
  personas: Record<string, PersonaOverride>;
  rules?: RulesOverride;
}

export function loadOwnerOpts(): StoredOwnerOpts {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as StoredOwnerOpts | null;
    return v && typeof v === "object" ? { ...v, personas: v.personas ?? {} } : { personas: {} };
  } catch {
    return { personas: {} };
  }
}

export function saveOwnerOpts(o: StoredOwnerOpts) {
  try {
    localStorage.setItem(KEY, JSON.stringify(o));
  } catch {
    /* 저장 불가 */
  }
}

/** 채팅 요청에 실을 값 (비어 있으면 undefined) */
export function buildOwnerOpts(personaId: string): OwnerOpts | undefined {
  const s = loadOwnerOpts();
  const persona = s.personas[personaId];
  const out: OwnerOpts = {
    ...(s.model ? { model: s.model } : {}),
    ...(s.promptMode ? { promptMode: s.promptMode } : {}),
    ...(persona && Object.keys(persona).length ? { persona } : {}),
    ...(s.rules && Object.keys(s.rules).length ? { rules: s.rules } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}
