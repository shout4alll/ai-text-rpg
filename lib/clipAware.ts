import { clipLabel } from "@/config/clipLabels";

/**
 * 🎬 리액션 영상 인지 — 대화 중 화면에서 재생된 영상(또는 유저가 "리액션 보기"로 본 영상)을
 * 캐릭터가 "내가 한 행동"으로 알고 있게 하고, 유저가 그 장면에 반응하면 모른 척하지 않고 받아치게 한다. (서버 전용 로직, AI 호출 없음)
 *
 *  · 클라이언트가 AI 말풍선마다 실제로 재생된 영상 이름을 turn.clip 으로 기록해 보낸다 (재생 안 됐으면 없음)
 *  · 유저가 리액션 보기로 고른 영상은 watched 로 따로 보낸다
 *  · 15분 안의 것만 이번 턴 "지금 상황"에 한두 줄로 붙인다
 */
export interface ClipTurn {
  role: "user" | "assistant";
  kind?: string;
  content: string;
  at?: number;
  clip?: string;
}

const TTL_MS = 15 * 60_000;

/** 영상이 무엇을 보여 주는지 (모델이 장면을 상상하도록) */
const MEANING: Record<string, string> = {
  idle: "가만히 있는 평소 모습",
  smile: "은은하게 웃는 모습",
  laugh: "크게 웃는 모습",
  nod: "고개를 끄덕이는 모습",
  shake: "고개를 가로젓는 모습",
  shy: "쑥스러워하는 모습",
  love: "두근거리는 눈빛으로 바라보는 모습",
  pout: "토라진 표정",
  surprised: "깜짝 놀란 모습",
  sad: "속상해하는 모습",
  touched: "뭉클해하는 모습",
  thinking: "생각에 잠긴 모습",
  excited: "신나서 들뜬 모습",
  comfort: "다독여 주는 모습",
  sleepy: "졸려 하는 모습",
  turn_away: "홱 등을 돌려 삐진 모습",
  blow_kiss: "손키스를 날리는 모습",
  flying_kiss: "귀엽게 뽀뽀를 날리는 모습",
  kiss: "애정을 담아 손키스를 보내는 모습",
  hair_tuck: "머리카락을 귀 뒤로 넘기며 수줍게 웃는 모습",
  touch_joy: "간지러워 웃는 모습",
  touch_shy: "화면을 만지자 부끄러워하는 모습",
  touch_pout: "만지지 말라며 앙탈하는 모습",
};

const baseName = (c: string) => c.replace(/^(allure_|special_)/, "");
const describe = (clip: string) => {
  const label = clipLabel(clip);
  const meaning = MEANING[clip] ?? MEANING[baseName(clip)];
  return meaning ? `'${label}' 영상(${meaning})` : `'${label}' 영상`;
};

/** 유저 말이 방금 본 영상·표정·행동을 가리키는가 */
const REF_RE = /영상|표정|손\s?키스|키스|뽀뽀|윙크|눈빛|머리\s?(넘|쓸|만지)|웃는|웃었|방금\s*(그|저|뭐|뭘)|아까\s*(그|저)|그거\s*(뭐|귀|예|이쁘|설레)|뭐야\s*(ㅋ|ㅎ)|귀여|이쁘|예쁘|설레|두근|쑥스|부끄|삐졌|등\s?돌|심쿵|녹아|반했/;

export function clipAwareLines(opts: { turns: ClipTurn[]; watched?: { clip: string; at: number }; userText: string; now?: number }): string[] {
  const now = opts.now ?? Date.now();
  const lines: string[] = [];

  // 대화 중 재생된 영상: 가장 최근 AI 말풍선 두 개 (15분 안)
  const shown = opts.turns
    .filter((t) => t.role === "assistant" && (t.kind === undefined || t.kind === "text") && t.clip && t.at && now - t.at < TTL_MS)
    .slice(-2)
    .reverse();
  const seen = new Set<string>();
  for (const t of shown) {
    const clip = t.clip as string;
    if (seen.has(clip)) continue;
    seen.add(clip);
    const said = t.content.replace(/\s+/g, " ").trim().slice(0, 30);
    lines.push(`- 화면에서 네 모습: ${describe(clip)}이 ${lines.length === 0 ? "방금" : "그 전에"} 재생됐다${said ? `(네 "${said}" 말과 함께)` : ""}. 유저는 그 영상을 봤다.`);
  }

  // 유저가 리액션 보기로 고른 영상
  const w = opts.watched;
  if (w && w.clip && now - w.at < TTL_MS && !seen.has(w.clip)) {
    const min = Math.max(0, Math.round((now - w.at) / 60_000));
    lines.push(`- 유저가 '리액션 보기'로 네 ${describe(w.clip)}을 골라 감상했다(${min <= 0 ? "방금" : `${min}분 전`}). 네가 보여 준 모습으로 알고 있다.`);
  }

  if (lines.length === 0) return [];

  if (REF_RE.test(opts.userText)) {
    lines.push(
      `- 유저가 지금 그 영상(화면 속 네 모습)에 반응하고 있다. 네가 실제로 그 행동을 한 것으로 알고 자연스럽게 받아라 — 쑥스러워하거나, 장난으로 받아치거나, 은근히 인정하거나, 일부러 한 거라면 능청스럽게. "무슨 영상이요?"처럼 모르는 척하지 마라. 영상을 길게 묘사하지 말고 한두 마디로, 네 성격·관계 단계에 맞는 수위로.`
    );
  } else {
    lines.push(`- 유저가 그 영상·표정·행동을 언급하면 네가 한 것으로 알고 자연스럽게 받아라. 네가 먼저 영상 얘기를 꺼낼 필요는 없다.`);
  }
  return lines;
}
