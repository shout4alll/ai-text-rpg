import "server-only";

/**
 * 유료 리액션 영상(clips/premium/ — 예: 뽀뽀) 이용 권한.
 *
 * PREMIUM_ACCESS 환경변수
 *   - open : 누구나 (개발 서버 기본값, 배포 환경에서 테스트할 때도 open 으로)
 *   - paid : 이용권이 있어야 함 (배포 기본값). 결제 연동 전에는 아무도 못 봄 → 잠금 안내만 가끔 뜬다
 *   (잠금 안내까지 없애려면 clips/premium/ 폴더의 영상을 빼면 된다)
 *
 * ▶ 결제 연동 시: 로그인 사용자별로 판단해야 하므로 page.tsx 를 동적 렌더로 바꾸고
 *   여기서 사용자 구독/구매 내역을 확인해 true/false 를 넘기면 된다.
 *   또한 유료 영상 파일은 public/ 이 아닌 비공개 저장소 + 서명 URL 로 옮겨야 진짜로 잠긴다. (docs/REACTION_VIDEOS.md)
 */
export function premiumReactionsUnlocked(): boolean {
  const v = process.env.PREMIUM_ACCESS?.trim();
  if (v === "open") return true;
  if (v === "paid") return false;
  return process.env.NODE_ENV !== "production";
}

/**
 * 유료 실시간 사진(/api/media/photo) 호출 허용 여부.
 * MEDIA_ACCESS: open(개발 기본) | paid(배포 기본 — VOICE_DEV_PASS 와 같은 x-voice-pass 헤더로만 통과) | off
 * ▶ 결제 연동 시: 여기서 로그인 사용자 확인 + 서버 잔액 차감을 하도록 바꾼다.
 */
export function checkMediaAccess(request: Request): { ok: true } | { ok: false; status: 402 | 403; error: string } {
  const v = process.env.MEDIA_ACCESS?.trim();
  const mode = v === "open" || v === "paid" || v === "off" ? v : process.env.NODE_ENV === "production" ? "paid" : "open";
  if (mode === "off") return { ok: false, status: 403, error: "사진 기능이 지금은 꺼져 있어요." };
  if (mode === "open") return { ok: true };
  const pass = process.env.VOICE_DEV_PASS;
  if (pass && request.headers.get("x-voice-pass") === pass) return { ok: true };
  return { ok: false, status: 402, error: "실시간 사진은 이용권이 필요한 유료 기능이에요." };
}
