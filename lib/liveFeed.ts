import "server-only";

/**
 * 💬 실시간 대화 모니터 (🛠 주인님 모드 전용) — 손님들과 캐릭터가 주고받은 턴을 서버 메모리에 최근 N개만 보관.
 *  · GET /api/owner/live?since=<ms> 로 그 뒤의 턴만 가져간다 (관리창이 3초마다).
 *  · 파일·DB 에 저장하지 않는다. Vercel 은 인스턴스마다 따로 쌓이고, 재배포·재시작하면 비워진다.
 *  · 손님 구분은 기기마다 만든 무작위 id(앞 4자리)와 프로필 이름만 쓴다.
 */
export interface LiveTurn {
  id: number;
  at: number;
  personaId: string;
  personaName: string;
  /** 기기 무작위 id 앞 4자리 */
  device: string;
  userName: string;
  /** 주인님(🛠) 대화인지 */
  owner: boolean;
  kind: string;
  userText: string;
  replies: string[];
  model: string;
  route: string;
  ms: number;
  error?: string;
}

const MAX = 400;
const FEED: LiveTurn[] = [];
let seq = 0;

export function pushLive(t: Omit<LiveTurn, "id">): void {
  FEED.push({ ...t, id: ++seq, userText: t.userText.slice(0, 500), replies: t.replies.map((r) => r.slice(0, 500)) });
  if (FEED.length > MAX) FEED.splice(0, FEED.length - MAX);
}

export function liveSince(since: number): LiveTurn[] {
  return FEED.filter((t) => t.at > since);
}
