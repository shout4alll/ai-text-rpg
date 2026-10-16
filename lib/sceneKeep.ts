/**
 * 🎞 진행 중인 장면 유지 — 키스·포옹·손잡기 같은 스킨십 장면이나 "눈 감아봐 → 감았어" 같은 연기(演技) 장면이 이어지는 중에는
 * 유저의 짧은 말("감았어", "띠용", "웃으니까 이쁘잖아")이 말 자체로는 평범해 보여도 사실은 그 장면 속 반응이다.
 * 이걸 "가벼운 말"로 보고 가벼운 모델이 받으면 장면이 끊기고 엉뚱한 상황("조용히 책 읽고 있을게")이 된다.
 *  → 장면이 진행 중이면 ① 맥락이 깊은 턴으로 취급(메인 모델) ② 장면을 그대로 이어 가라는 줄과 최근 흐름 요약을 붙인다. (서버 전용, AI 호출 없음)
 */
export interface SceneTurn {
  role: "user" | "assistant";
  kind?: string;
  content: string;
  at?: number;
}

/** 신체 접촉·장면 진행을 나타내는 말 (일반 대화의 '기대돼', '이쪽', '다가오는 주말' 같은 말은 걸리지 않게 좁게) */
const PHYS_RE = /키스|뽀뽀|입맞|입술|안아\s?(줘|줄|봐|볼|주|도)|안겨|포옹|껴안|품에|손\s?(잡|을 잡)|손깍지|쓰다듬|토닥|기대(어|고|봐|도 돼|볼게)|어깨에|무릎|눈\s?(감|뜨)|가만히 (있|서|좀)|이리\s?와|가까이|다가(와|가서|갈게|간다|가봐|서)|볼에|이마에|귓가|속삭|숨결|(^|\s)쪽(\.|!|…|~|\s|$)|두근거|심장이/;

const WINDOW_MS = 30 * 60_000;
const text = (t: SceneTurn) => t.kind === undefined || t.kind === "text";

export interface SceneResult {
  active: boolean;
  /** 최근 흐름 요약 (프롬프트용) */
  summary: string;
}

export function detectScene(turns: SceneTurn[], userText: string, now = Date.now()): SceneResult {
  const none = { active: false, summary: "" };
  const msgs = turns.filter(text);
  if (msgs.length === 0) return none;
  const lastAi = [...msgs].reverse().find((t) => t.role === "assistant");
  if (!lastAi) return none;
  if (lastAi.at && now - lastAi.at > WINDOW_MS) return none; // 오래전 장면은 끝난 것
  const recent = msgs.slice(-5);
  const hits = recent.filter((t) => PHYS_RE.test(t.content)).length;
  const lastAiHit = PHYS_RE.test(lastAi.content);
  const short = userText.replace(/\s+/g, "").length <= 14;
  const userHit = PHYS_RE.test(userText);
  // 장면 진행 중: 최근 몇 턴 중 둘 이상이 접촉·장면 말이거나, 직전 내 말이 장면이고 유저가 짧게 이어받을 때, 유저가 직접 접촉을 청할 때(직전에 장면이 있었으면)
  const active = hits >= 2 || (lastAiHit && short) || (userHit && hits >= 1);
  if (!active) return none;
  const flow = recent
    .slice(-4)
    .map((t) => `${t.role === "user" ? "유저" : "너"}: ${t.content.replace(/\s+/g, " ").slice(0, 40)}`)
    .join(" / ");
  return { active: true, summary: flow };
}

/** 이번 턴 프롬프트에 붙일 장면 유지 줄 */
export function sceneLines(scene: SceneResult): string[] {
  if (!scene.active) return [];
  return [
    `- 진행 중인 장면(끊지 마라): 지금 둘은 스킨십·연기 장면 한가운데에 있다. 최근 흐름 — ${scene.summary}. 유저의 이번 말("감았어", "띠용", "ㅋㅋ", 칭찬 한마디 등)은 새 이야기가 아니라 이 장면 속 반응이다. 다음 말은 그 장면을 그대로 이어서 진행해라 — 네 행동·감각·감정을 한두 문장으로 구체적으로(예: 눈을 감은 유저에게 다가가는 동작과 그때의 떨림). 뜻을 정확히 모르는 의성어·감탄("띠용", "헉", "와", "ㅋㅋ")도 네가 방금 한 행동에 대한 놀람·설렘·쑥스러움으로 받아 그 반응에 한두 마디로 호응해라(그 말의 뜻을 설명하라고 하지 마라). 장소·상황을 바꾸거나("책 읽고 있을게" 같은 딴 일로 넘어가기), "무슨 상황이야?"처럼 모르는 척 되묻거나, 이미 한 행동을 처음인 듯 다시 시작하지 마라. 수위는 직전 대화와 관계 단계, 네 설정·안전 규칙이 허용하는 범위에서 한 걸음만.`,
  ];
}
