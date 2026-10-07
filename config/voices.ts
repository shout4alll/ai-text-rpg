/**
 * Gemini 기본 제공 목소리 30종 (보이스톡·목소리 미리 듣기 공용)
 * 출처: https://ai.google.dev/gemini-api/docs/speech-generation (2026-10 확인)
 * gender 는 목소리 인상 기준(공식 분류 아님) — 목소리 맞추기 화면에서 후보를 거르는 데만 쓴다.
 */
export const GEMINI_VOICES = [
  { name: "Zephyr", trait: "Bright · 밝음", gender: "female" },
  { name: "Kore", trait: "Firm · 단단함", gender: "female" },
  { name: "Leda", trait: "Youthful · 앳됨", gender: "female" },
  { name: "Aoede", trait: "Breezy · 산뜻함", gender: "female" },
  { name: "Callirrhoe", trait: "Easy-going · 느긋함", gender: "female" },
  { name: "Autonoe", trait: "Bright · 밝음", gender: "female" },
  { name: "Despina", trait: "Smooth · 부드러움", gender: "female" },
  { name: "Erinome", trait: "Clear · 또렷함", gender: "female" },
  { name: "Laomedeia", trait: "Upbeat · 경쾌함", gender: "female" },
  { name: "Achernar", trait: "Soft · 여림", gender: "female" },
  { name: "Gacrux", trait: "Mature · 성숙함", gender: "female" },
  { name: "Pulcherrima", trait: "Forward · 적극적", gender: "female" },
  { name: "Vindemiatrix", trait: "Gentle · 다정함", gender: "female" },
  { name: "Sulafat", trait: "Warm · 따뜻함", gender: "female" },
  { name: "Puck", trait: "Upbeat · 경쾌함", gender: "male" },
  { name: "Charon", trait: "Informative · 차분한 설명조", gender: "male" },
  { name: "Fenrir", trait: "Excitable · 들뜸", gender: "male" },
  { name: "Orus", trait: "Firm · 단단함", gender: "male" },
  { name: "Enceladus", trait: "Breathy · 숨소리", gender: "male" },
  { name: "Iapetus", trait: "Clear · 또렷함", gender: "male" },
  { name: "Umbriel", trait: "Easy-going · 느긋함", gender: "male" },
  { name: "Algieba", trait: "Smooth · 부드러움", gender: "male" },
  { name: "Algenib", trait: "Gravelly · 거친 저음", gender: "male" },
  { name: "Rasalgethi", trait: "Informative · 설명조", gender: "male" },
  { name: "Alnilam", trait: "Firm · 단단함", gender: "male" },
  { name: "Schedar", trait: "Even · 고른 톤", gender: "male" },
  { name: "Achird", trait: "Friendly · 친근함", gender: "male" },
  { name: "Zubenelgenubi", trait: "Casual · 캐주얼", gender: "male" },
  { name: "Sadachbia", trait: "Lively · 생기", gender: "male" },
  { name: "Sadaltager", trait: "Knowledgeable · 지적임", gender: "male" },
] as const;

export type GeminiVoiceName = (typeof GEMINI_VOICES)[number]["name"];
export const GEMINI_VOICE_NAMES = GEMINI_VOICES.map((v) => v.name) as GeminiVoiceName[];

export function isGeminiVoice(v: unknown): v is GeminiVoiceName {
  return typeof v === "string" && (GEMINI_VOICE_NAMES as string[]).includes(v);
}

/** 목소리 맞추기에서 고른 값 (기기 저장) — { personaId: voiceName } */
export const VOICE_OVERRIDE_KEY = "ai-rpg.voiceOverride";

export function readVoiceOverride(personaId: string): GeminiVoiceName | null {
  try {
    const m = JSON.parse(localStorage.getItem(VOICE_OVERRIDE_KEY) ?? "{}") as Record<string, string>;
    return isGeminiVoice(m[personaId]) ? m[personaId] : null;
  } catch {
    return null;
  }
}

export function writeVoiceOverride(personaId: string, voice: GeminiVoiceName | null) {
  try {
    const m = JSON.parse(localStorage.getItem(VOICE_OVERRIDE_KEY) ?? "{}") as Record<string, string>;
    if (voice) m[personaId] = voice;
    else delete m[personaId];
    localStorage.setItem(VOICE_OVERRIDE_KEY, JSON.stringify(m));
  } catch {
    /* 저장 불가 */
  }
}
