import "server-only";

/**
 * 보이스톡 이용 권한 (유료 상품 대비).
 *
 * VOICE_ACCESS 환경변수
 *   - open : 누구나 사용 (개발/테스트용) — 개발 서버(npm run dev) 기본값
 *   - paid : 이용권이 있는 사람만 — 배포(production) 기본값. 결제 연동 전에는 VOICE_DEV_PASS 를 아는 사람만 통과
 *   - off  : 보이스톡 끄기
 *
 * ▶ 결제 연동 시 할 일: hasVoicePass() 안에서 로그인 사용자/결제 내역(구독, 분 단위 이용권)을 확인하도록 바꾸면 된다.
 *   통화 시간 정산은 /api/voice/session 응답의 maxSeconds 와 클라이언트가 보내는 종료 시간을 기준으로 하면 된다.
 */
export type VoiceAccessMode = "open" | "paid" | "off";

export function voiceAccessMode(): VoiceAccessMode {
  const v = process.env.VOICE_ACCESS?.trim();
  if (v === "open" || v === "paid" || v === "off") return v;
  return process.env.NODE_ENV === "production" ? "paid" : "open";
}

/** 결제 연동 전 임시: 요청 헤더 x-voice-pass 가 VOICE_DEV_PASS 와 같으면 통과 */
export function hasVoicePass(request: Request): boolean {
  const pass = process.env.VOICE_DEV_PASS;
  if (!pass) return false;
  return request.headers.get("x-voice-pass") === pass;
}

export type VoiceAccessResult = { ok: true } | { ok: false; status: 402 | 403; error: string };

export function checkVoiceAccess(request: Request): VoiceAccessResult {
  const mode = voiceAccessMode();
  if (mode === "off") return { ok: false, status: 403, error: "보이스톡이 지금은 꺼져 있어요." };
  if (mode === "open") return { ok: true };
  if (hasVoicePass(request)) return { ok: true };
  return { ok: false, status: 402, error: "보이스톡은 이용권이 필요한 유료 기능이에요." };
}

/** 한 번 통화의 최대 길이(초). Live API 세션 한도(약 10분)를 넘지 않게 기본 10분 */
export function voiceMaxSeconds(): number {
  const n = Number(process.env.VOICE_MAX_MINUTES);
  const min = Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 10;
  return Math.round(min * 60);
}
