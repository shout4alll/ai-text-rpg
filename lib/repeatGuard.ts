/**
 * 🔁 반복 방지 (서버 전용 로직이지만 비밀 정보 없음)
 *
 *  - 최근 내 답장에서 이미 말한 "행동·상황·음식" 키워드와 반복되는 표현을 찾아 AI에게 알려 준다.
 *  - 매 턴 다른 "근황 씨앗"을 몇 개 골라 줘서 같은 설정(와인·독서·등산…)만 되풀이하지 않게 한다.
 *  - 모델이 그래도 같은 말풍선을 되풀이하면 마지막에 걸러낸다.
 */

type TextTurn = { role: "user" | "assistant"; content: string; kind?: string };

/** 장면·행동·음식 카테고리: 같은 카테고리를 자꾸 말하는지 센다 */
const SCENES: { id: string; label: string; re: RegExp }[] = [
  { id: "drink", label: "술·와인·맥주", re: /와인|맥주|소주|위스키|칵테일|막걸리|한잔|한 잔|술\b|취했|취한/ },
  { id: "coffee", label: "커피·차", re: /커피|라떼|아메리카노|카페|홍차|녹차|차 한|티타임/ },
  { id: "read", label: "책·독서", re: /책을|책 |독서|읽고|읽는|읽다|소설|서점|페이지/ },
  { id: "hike", label: "산·등산·산책", re: /등산|산에|산책|산길|둘레길|공원|걷고|걷다|트레킹|한강/ },
  { id: "workout", label: "운동", re: /운동|헬스|요가|필라테스|러닝|달리기|조깅|스트레칭|수영/ },
  { id: "cook", label: "요리·식사", re: /요리|끓이|볶|먹고 있|먹는 중|저녁 먹|점심 먹|아침 먹|라면|배달|도시락|밥을/ },
  { id: "work", label: "일·야근·회의", re: /야근|회의|퇴근|출근|마감|보고서|촬영|리허설|대본|프로젝트|작업 중|일하고/ },
  { id: "home", label: "집안일·청소", re: /청소|빨래|설거지|정리하|이불|집안일|분리수거/ },
  { id: "media", label: "영화·드라마·음악", re: /영화|드라마|넷플|유튜브|노래|음악|플레이리스트|앨범|기타 치|연주/ },
  { id: "weather", label: "날씨·창밖", re: /날씨|비가|비 오|눈이|바람|창밖|하늘|노을|햇살|더워|추워|쌀쌀/ },
  { id: "tired", label: "피곤·졸림", re: /피곤|졸려|졸리|잠이|못 잤|커피 없|지쳐|지치/ },
  { id: "night", label: "잠자리·늦은 밤", re: /자려고|잘 시간|이불 속|침대|잠들|꿈에/ },
];

/** 말투·조사 때문에 같은 단어가 다르게 보이는 걸 줄이는 간단 정리 */
function stem(w: string): string {
  return w.replace(/(이랑|에서|에게|한테|으로|이라|이에요|예요|이야|이고|이나|은|는|이|가|을|를|에|도|의|로|와|과|랑|야|요|죠|네|고|서)$/u, "");
}

const STOP = new Set([
  "그리고", "그런데", "근데", "그래서", "진짜", "정말", "너무", "그냥", "조금", "아직", "오늘", "지금", "이제", "다시", "계속", "우리", "나도", "저도", "그럼", "이거", "저거", "그거", "여기", "거기",
  "하는", "해서", "하고", "했어", "했는데", "있어", "있는", "있어요", "없어", "같아", "같은", "이런", "저런", "그런", "어떻게", "뭐해", "뭐하", "뭔가", "아니", "근데요", "그래", "맞아", "그렇", "그러", "많이", "좀더", "엄청", "완전", "되게", "별로", "그래도", "하지만", "그렇지",
]);

function words(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.toLowerCase().match(/[가-힣a-z0-9]{2,}/g) ?? []) {
    const s = stem(raw);
    if (s.length >= 2 && !STOP.has(s) && !STOP.has(raw)) out.push(s);
  }
  return out;
}

/** 공백·문장부호·웃음을 지운 비교용 문자열 */
export function normalizeBubble(s: string): string {
  return s.toLowerCase().replace(/[\s.,!?…~^;:'"()\-ㅋㅎㅠㅜ♡]+/gu, "");
}

function bigramSet(s: string): Set<string> {
  const n = normalizeBubble(s);
  const set = new Set<string>();
  for (let i = 0; i < n.length - 1; i++) set.add(n.slice(i, i + 2));
  return set;
}

/** 두 말풍선이 거의 같은 말인가 (글자 2-gram 겹침 비율) */
export function nearlySame(a: string, b: string): boolean {
  const na = normalizeBubble(a);
  const nb = normalizeBubble(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (Math.min(na.length, nb.length) < 8) return false;
  const A = bigramSet(a);
  const B = bigramSet(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / Math.min(A.size, B.size) >= 0.8;
}

/** 모델이 방금 한 말풍선이 최근 내 말풍선과 같으면 뺀다 (전부 같으면 그대로 둔다) */
export function dropRepeatedBubbles(bubbles: string[], turns: TextTurn[]): string[] {
  const past: string[] = [];
  for (const t of turns.slice(-12)) {
    if (t.role === "assistant" && (t.kind === undefined || t.kind === "text")) {
      for (const p of t.content.split(/\n+/)) if (p.trim()) past.push(p.trim());
    }
  }
  const seen: string[] = [];
  const kept = bubbles.filter((b) => {
    if (normalizeBubble(b).length < 3) return true; // "헐", "ㅋㅋ" 같은 짧은 말은 반복해도 자연스럽다
    if (past.some((p) => nearlySame(p, b)) || seen.some((p) => nearlySame(p, b))) return false;
    seen.push(b);
    return true;
  });
  return kept.length > 0 ? kept : bubbles;
}

/** 근황 씨앗 — 직업·성격에 맞게 바꿔 쓰라고 안내한다. time: 어울리는 시간대 (없으면 아무 때나) */
const SEEDS: { t: string; time?: "morning" | "day" | "evening" | "night" }[] = [
  { t: "창밖에서 문득 본 작은 장면(지나가는 사람·동물·간판·구름)" },
  { t: "오늘 있었던 사소한 해프닝(잘못 누른 것, 놓친 것, 우연히 만난 사람)" },
  { t: "문득 떠오른 어릴 적 기억 한 조각" },
  { t: "요즘 머릿속에 맴도는 노래나 멜로디" },
  { t: "몸 상태(어깨 뻐근함, 눈 피로, 손발 차가움, 배에서 나는 소리)" },
  { t: "기다리는 택배·연락·결과 같은 작은 기대" },
  { t: "SNS·뉴스에서 본 소소한 이야깃거리" },
  { t: "새로 시작해 보고 싶은 사소한 것(앱, 취미, 음식, 길)" },
  { t: "주변 사람(가족·동료·친구·이웃) 이야기 한 토막" },
  { t: "최근에 산 것·고장 난 것·잃어버린 것" },
  { t: "방금 전까지 하던 일에서 막힌 부분이나 뿌듯했던 부분" },
  { t: "계획 중인 이번 주 일정이나 가 보고 싶은 곳" },
  { t: "먹고 싶은 것 고르다 결정 못 한 고민" },
  { t: "유저가 했던 말 중 다시 떠오른 한 마디" },
  { t: "집·사무실·거리의 냄새·소리·온도" },
  { t: "손에 쥐고 있는 물건이나 정리 중인 서랍·가방" },
  { t: "이상하게 웃겼던 생각이나 혼잣말" },
  { t: "요즘 잠·꿈·컨디션 패턴" },
  { t: "아침 준비 중 겪은 사소한 일", time: "morning" },
  { t: "출근·등교 길에서 본 것", time: "morning" },
  { t: "점심 메뉴 정하기 전의 고민", time: "day" },
  { t: "일하다 잠깐 멍해진 순간", time: "day" },
  { t: "퇴근길 풍경이나 기분", time: "evening" },
  { t: "저녁 메뉴·장 보기 같은 하루 마무리 준비", time: "evening" },
  { t: "하루를 돌아보며 든 생각 한 줄", time: "night" },
  { t: "잠들기 전 습관이나 잠이 안 올 때 하는 일", time: "night" },
];

function hourIn(tz: string): number {
  try {
    return Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  } catch {
    return 12;
  }
}

function pickSeeds(h: number, avoid: Set<string>, n: number): string[] {
  const slot: "morning" | "day" | "evening" | "night" = h < 5 ? "night" : h < 11 ? "morning" : h < 17 ? "day" : h < 22 ? "evening" : "night";
  const pool = SEEDS.filter((s) => (!s.time || s.time === slot) && ![...avoid].some((a) => s.t.includes(a)));
  const out: string[] = [];
  const bag = [...pool];
  while (out.length < n && bag.length > 0) out.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0].t);
  return out;
}

/** 최근 내 답장에서 이미 말한 장면 카테고리 (최근 8개 답장 기준) */
export function recentScenes(turns: TextTurn[]): { id: string; label: string; count: number; recent: boolean }[] {
  const mine = turns.filter((t) => t.role === "assistant" && (t.kind === undefined || t.kind === "text")).slice(-8);
  const res: { id: string; label: string; count: number; recent: boolean }[] = [];
  for (const sc of SCENES) {
    let count = 0;
    let recent = false;
    mine.forEach((t, i) => {
      if (sc.re.test(t.content)) {
        count++;
        if (i >= mine.length - 3) recent = true;
      }
    });
    if (count > 0) res.push({ id: sc.id, label: sc.label, count, recent });
  }
  return res.sort((a, b) => b.count - a.count);
}

/**
 * 여러 답장에 걸쳐 되풀이된 단어 (같은 화제·같은 말버릇)
 *  · 최근 8개 답장 중 3번 이상, 또는 가장 최근 2개 답장에 연속으로 나온 3글자 이상 말(말버릇·단골 농담)
 */
function repeatedWords(turns: TextTurn[]): string[] {
  const mine = turns.filter((t) => t.role === "assistant" && (t.kind === undefined || t.kind === "text")).slice(-8);
  // 조사·어미가 붙어 다르게 보이는 말을 묶는다: 다른 답장에 실제로 나온 3글자 이상 말이 어근(앞부분)이면 같은 말로 센다
  //  예) "영업비밀이에요" · "영업비밀이라니까요" → 「영업비밀」
  const sets = mine.map((t) => new Set(words(t.content)));
  const vocab = new Set<string>();
  for (const set of sets) for (const w of set) if (w.length >= 3) vocab.add(w);
  const expand = (set: Set<string>) => {
    const out = new Set(set);
    for (const w of set) for (const u of vocab) if (u !== w && u.length >= 3 && w.startsWith(u)) out.add(u);
    return out;
  };
  const expanded = sets.map(expand);
  const df = new Map<string, number>();
  for (const set of expanded) for (const w of set) df.set(w, (df.get(w) ?? 0) + 1);
  const lastTwo = expanded.slice(-2);
  const inBothLast = (w: string) => lastTwo.length === 2 && lastTwo.every((set) => set.has(w));
  return [...df.entries()]
    .filter(([w, c]) => c >= 3 || (c >= 2 && w.length >= 3 && inBothLast(w)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);
}

/**
 * 이번 턴 프롬프트에 붙일 "반복 금지" 줄들.
 * @param userText 유저가 방금 한 말 — 유저가 직접 꺼낸 화제는 반복 대상에서 뺀다
 */
export function repeatGuardLines(turns: TextTurn[], tz: string, userText: string, opts: { seeds?: boolean; signature?: string[] } = {}): string[] {
  const lines: string[] = [];
  // 유저가 최근에 직접 꺼낸 화제(예: 책 얘기 중)는 "반복"이 아니라 지금 나누는 주제다 → 막지 않는다
  const userRecent = [userText, ...turns.filter((t) => t.role === "user" && (t.kind === undefined || t.kind === "text")).slice(-6).map((t) => t.content)].join("\n");
  // 지금 주제에 대한 대화가 이어지는 중이면 AI 자신이 꺼낸 말이어도 그 주제 단어는 허용
  const asked = (label: string) => {
    const sc = SCENES.find((s) => s.label === label);
    return !!sc && sc.re.test(userRecent);
  };
  const scenes = recentScenes(turns).filter((s) => !asked(s.label));
  const hot = scenes.filter((s) => s.recent || s.count >= 2);
  if (hot.length > 0) {
    lines.push(
      `- 반복 금지(상황·행동): 최근 네 답장에서 이미 ${hot.map((s) => `${s.label}(${s.count}번)`).join(", ")} 이야기를 했다. 같은 행동·장소·음식을 또 "하고 있다/했다"고 말하지 마라. 네가 지금 뭘 하고 있는지는 지금까지와 다른 걸로 하거나, 아예 말하지 마라. (유저가 하는 이야기·질문에는 이 제한 없이 충실히 답해라)`
    );
  }
  // 유저가 직접 쓴 말(지금 나누는 주제)만 예외 — 내가 방금 한 말은 예외로 두지 않는다(그러면 말버릇이 연속으로 나와도 안 걸린다)
  const userWords = new Set(words(userRecent));
  const rep = repeatedWords(turns).filter((w) => !userWords.has(w));
  if (rep.length > 0) {
    lines.push(
      `- 말버릇 금지: 최근 답장마다 같은 표현이 되풀이됐다 — ${rep.map((w) => `「${w}」`).join(", ")}. 이번 답장에서는 이 말·이 말을 쓴 농담·같은 뜻의 회피 멘트를 쓰지 마라(비슷하게 바꿔 쓰는 것도 금지). 같은 상황이면 지금까지와 다른 방식으로 대응해라(지금 나누는 주제에서 벗어나라는 뜻은 아니다).`
    );
  }
  // 대표 소재(직업·대표 취미) 쏠림
  lines.push(...signatureLines(turns, opts.signature, userRecent));
  const avoid = new Set<string>();
  for (const s of scenes) for (const k of s.label.split(/[·]/)) avoid.add(k);
  // 이야기가 이어지는 중(opts.seeds=false)에는 새 근황 씨앗을 주지 않는다 — 딴소리의 원인이 된다
  const seeds = opts.seeds === false ? [] : pickSeeds(hourIn(tz), avoid, 3);
  if (seeds.length > 0) {
    lines.push(
      `- 이번 턴에 굳이 네 근황을 꺼낸다면 이런 결에서 골라라(전부 선택 사항, 안 꺼내도 된다. 네 직업·성격·말투에 맞게 구체적으로 바꿔라): ${seeds.map((s) => `「${s}」`).join(" ")}. 유저의 말에 반응하는 게 먼저고, 근황은 두 번에 한 번 이하로만 꺼내라.`
    );
  }
  lines.push(...questionGuardLines(turns));
  lines.push(responseModeLine());
  return lines;
}

/** 대표 소재 키워드에 쓸 정규식 특수문자 이스케이프 */
const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * 🎯 대표 소재 쏠림 방지 — 최근 답장이 직업·대표 취미(persona.signature)로만 흐르면 이번엔 그 소재를 쓰지 못하게 한다.
 * 유저가 최근에 그 소재를 직접 꺼냈으면(예: 책 얘기 중) 막지 않는다.
 */
export function signatureLines(turns: TextTurn[], signature: string[] | undefined, userRecent: string): string[] {
  if (!signature || signature.length === 0) return [];
  const re = new RegExp(signature.map(esc).join("|"), "i");
  if (re.test(userRecent)) return [];
  const mine = turns.filter((t) => t.role === "assistant" && (t.kind === undefined || t.kind === "text") && t.content.trim()).slice(-5);
  const hits = mine.map((t) => re.test(t.content));
  const last3 = hits.slice(-3).filter(Boolean).length;
  const all = hits.filter(Boolean).length;
  if (last3 < 2 && all < 3) return [];
  return [
    `- 소재 쏠림 금지: 최근 답장 ${mine.length}개 중 ${all}개가 네 직업·대표 취미 소재(${signature.slice(0, 5).join("·")} 등)로 흘렀다. 유저가 묻지 않았으니 이번 답장에서는 그 소재를 꺼내지도, 그걸 비유로 끌어오지도 마라. 유저가 한 말·네 일상·감정·소소한 다른 화제로 답해라.`,
  ];
}

/** 이번 턴에 권하는 "대응 방식" — 같은 상황에 같은 문구·농담으로 매번 대응하는 패턴을 깬다 */
const RESPONSE_MODES = [
  "솔직하고 짧게 답하기",
  "유머로 가볍게 받아 넘기기",
  "진지하게 이유나 생각을 말하기",
  "네 경험 한 조각을 곁들이기",
  "상대의 감정을 먼저 읽어 주기",
  "가볍게 다른 화제를 꺼내기",
  "장난스럽게 되받아치기",
  "말을 아끼고 여운 있는 한마디로 받기",
  "구체적인 예를 하나 들어 설명하기",
];

function responseModeLine(): string {
  const pick = [...RESPONSE_MODES].sort(() => Math.random() - 0.5).slice(0, 2);
  return `- 이번 턴 대응 방식(권장, 유저의 말과 분위기에 맞을 때만): ${pick.map((m) => `「${m}」`).join(" 또는 ")}. 같은 상황(연애·사적인 질문·칭찬·안부 등)에 지난번과 같은 문구·농담·회피 멘트로 대응하지 마라.`;
}

/** 이번 턴에 권하는 "말을 이어 가는 방식" — 매번 질문으로 공을 넘기는 패턴을 깬다 */
const BRIDGES = [
  "유저 말에서 한 단어를 집어 네 느낌을 덧붙이기",
  "비슷한 네 경험 한 조각을 짧게 꺼내기",
  "가볍게 놀리거나 농담으로 받아치기",
  "솔직한 감탄·리액션 한마디로 끝내기",
  "유저 편을 들어 주거나 공감만 하고 끝내기",
  "네 짐작을 말해 보기(\"혹시 ~해서 그런 거 아니에요?\" 대신 \"~해서 그랬겠다\"처럼 단정형으로)",
  "앞에서 나온 이야기와 지금 말을 엮어 한마디",
  "작은 제안이나 상상 한마디(\"그럼 다음엔 ~해 봐요\")",
];

/** 문장 끝 3~6글자 — 질문 틀 비교용 ("어땠어요", "했어요", "있어요" 등) */
function questionFrame(q: string): string {
  const t = q.replace(/[\s?？!~.ㅋㅎㅠㅜ^]+$/g, "").replace(/\s+/g, " ");
  return t.slice(-3);
}

/**
 * 질문 패턴 감지: 최근 답장이 연달아 질문으로 끝나거나, 같은 틀의 질문을 되풀이하면 이번 턴에 바꾸라고 알린다.
 */
export function questionGuardLines(turns: TextTurn[]): string[] {
  const mine = turns.filter((t) => t.role === "assistant" && (t.kind === undefined || t.kind === "text") && t.content.trim()).slice(-6);
  if (mine.length === 0) return [];
  const lastBubble = (c: string) => c.split(/\n+/).map((s) => s.trim()).filter(Boolean).pop() ?? "";
  const endsQ = mine.map((t) => /[?？]\s*[ㅋㅎ~^]*$/.test(lastBubble(t.content)));
  let streak = 0;
  for (let i = endsQ.length - 1; i >= 0 && endsQ[i]; i--) streak++;
  const qCount = endsQ.filter(Boolean).length;
  const questions = mine
    .flatMap((t) => t.content.split(/(?<=[?？])/))
    .map((s) => s.split(/\n/).pop()!.trim())
    .filter((s) => /[?？]/.test(s) && s.length >= 4);
  const frames = new Map<string, number>();
  for (const q of questions) {
    const f = questionFrame(q);
    if (f.length >= 2) frames.set(f, (frames.get(f) ?? 0) + 1);
  }
  const dupFrames = [...frames.entries()].filter(([, n]) => n >= 2).map(([f]) => `"~${f}?"`);
  const lines: string[] = [];
  if (streak >= 2 || qCount >= 4) {
    const pick = [...BRIDGES].sort(() => Math.random() - 0.5).slice(0, 2);
    lines.push(
      `- 질문 패턴 주의: 최근 답장 ${mine.length}개 중 ${qCount}개가 질문으로 끝났다${streak >= 2 ? `(마지막 ${streak}개 연속)` : ""}. 이번 답장은 질문 없이 끝내라. 대신 이런 식으로 이어 가라: ${pick.map((b) => `「${b}」`).join(" 또는 ")}. 질문이 없어도 유저는 할 말이 생긴다.`
    );
  }
  if (questions.length > 0) {
    const recentQs = questions.slice(-3).map((q) => `「${q.slice(-28)}」`).join(" ");
    lines.push(
      `- 최근에 네가 한 질문: ${recentQs}${dupFrames.length ? ` — 특히 ${dupFrames.join(", ")} 같은 끝맺음을 되풀이했다` : ""}. 같은 질문·같은 틀·같은 어미로 다시 묻지 마라. 같은 뜻이라도 다른 단어·다른 각도·다른 말투로 말하고, 굳이 안 물어도 되면 묻지 마라.`
    );
  }
  return lines;
}

/** 유저의 단답(맞장구·확인·응답)인지 — 웃음(ㅋㅋ)만 있는 말은 제외 */
export const ACK_RE = /^(응|웅|ㅇㅇ|ㅇㅋ|오키|ok|okay|네|넵|넹|예|그래|그랭|그러게|그렇지|그치|맞아|알았어|알겠어|알았어요|알겠어요|음|흠|아|오|어|ㅇㅎ|그렇구나|그렇군|아하|좋아|좋지|괜찮아|몰라|글쎄)[s.!~…]*$/i;
export const isAck = (t: string) => ACK_RE.test(t.trim());

/**
 * (Grok 전용 — route.ts 가 Grok 이 답할 때만 붙인다) 유저가 단답만 이어 가면(그래·알았어·ㅇㅇ) 같이 단답으로 받아 대화가 죽는다 → 이번 턴은 네가 대화를 이끌라고 알린다.
 * (질문으로 떠넘기지 않고, 평서문으로 새 이야기·생각·상황을 던지게 한다)
 */
export function leadLines(turns: TextTurn[], userText: string): string[] {
  const users = turns.filter((t) => t.role === "user" && (t.kind === undefined || t.kind === "text") && t.content.trim());
  const minimal = (c: string) => isAck(c) || (c.replace(/\s+/g, "").length <= 3 && !/[ㅋㅎ?？]/.test(c));
  if (!minimal(userText)) return [];
  let streak = 0;
  for (let i = users.length - 1; i >= 0; i--) {
    const c = users[i].content.trim();
    if (minimal(c)) streak++;
    else break;
  }
  const mine = turns.filter((t) => t.role === "assistant" && (t.kind === undefined || t.kind === "text") && t.content.trim()).slice(-3);
  const shortEcho = mine.filter((t) => t.content.replace(/\s+/g, "").length <= 14).length;
  const stalled = streak >= 2 || shortEcho >= 2;
  return [
    `- 대화 주도(유저가 단답으로 받았다${streak >= 2 ? `: 연속 ${streak}번` : ""}): 유저가 짧게 답해도 대화를 네가 이어 가라. "알았어", "응", "그래", "생각나면 말해" 같은 짧은 맞장구로 받아 끝내지 마라. 네 쪽에서 새 이야기를 평서문으로 꺼내라 — 지금 이 대화의 시각·장소·상황 안에서 떠오른 생각·네 취향이나 의견·재미있는 관찰 중 하나를 구체적으로 한 토막 말하고(말풍선 1~3개), 질문 없이 끝내라. 장소·시간대·하는 일을 갑자기 바꾸지 마라(퇴근·귀가·쇼핑 같은 새 장면 금지). 유저가 대답하기 쉽게 이야기 속에 반응할 거리만 남겨 둬라.${stalled ? " 지금까지 대화가 단답으로 맴돌았다. 이전 말을 반복하지 말고 화제를 완전히 새로 열어라." : ""}`,
  ];
}

/** 유저가 "해봐·보여줘" 처럼 실행·진행을 재촉하는 말 */
export const PUSH_RE = /해\s*봐|해\s*보기나|해\s*보라|보여\s*줘|보여\s*봐|해\s*줘|어서|빨리|뭐\s*해|뭐\s*하는|제대로|말만|안\s*할|못\s*하|왜\s*안|그래서\??$|어떻게\s*할|계속\s*해|이어\s*가|더\s*해/;
export const isPush = (t: string) => PUSH_RE.test(t.trim());
/** 네가 "~해볼게·보여줄게" 같은 약속·예고만 하고 끝낸 답장 */
const PROMISE_RE = /(해|보여|시작해|가|해\s*줄|해\s*볼|보여\s*줄|드릴|할)(볼게|줄게|볼까|게\b)|진짜로\s*(해|보여)|제대로\s*(해|보여)|지금부터|이제부터|한번\s*해볼/;

/**
 * (Grok 전용 — route.ts 가 Grok 이 답할 때만 붙인다) "해봐" 재촉에 "해볼게"로만 대답하다 같은 말이 되풀이되는 루프를 끊는다.
 * 첫 재촉에는 약속해도 되지만, 이미 약속한 뒤에도 또 재촉이면 이번엔 말이 아니라 실제 상황·내용을 직접 만들어 진행한다.
 */
export function deliverLines(turns: TextTurn[], userText: string): string[] {
  if (!isPush(userText)) return [];
  const mine = turns.filter((t) => t.role === "assistant" && (t.kind === undefined || t.kind === "text") && t.content.trim()).slice(-3);
  const promised = mine.filter((t) => PROMISE_RE.test(t.content)).length;
  if (promised === 0) return [];
  return [
    `- 이행 우선(유저가 또 재촉했다. 너는 이미 "해볼게·보여줄게·진짜로 할게"라고 ${promised}번 약속만 했다): 이번 답장에서는 더 이상 약속·예고·다짐을 하지 마라("지금부터", "진짜로 해볼게", "제대로 보여줄게" 금지). 말로 때우지 말고 실제로 진행해라 — 단, 지금까지 정해진 시각·장소·상황 안에서 그대로 이어서(장소 이동·시간 점프·퇴근·귀가·새 활동 끼워 넣기 금지), 네 대사·감정·반응·그 자리에서 할 수 있는 작은 행동을 구체적으로 한 토막 보여 주고(말풍선 2~4개), 유저가 그 안에서 반응하게 해라. 분위기 수위도 직전 대화보다 한 걸음만 나아가라. 유저의 말을 그대로 되받아 말하거나("~하니까") 매번 상대 이름으로 문장을 시작하는 것도 하지 마라. 질문으로 끝내지 말고 네가 이야기를 이끌어라.`,
  ];
}
