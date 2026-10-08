import { TYPO, TYPO_FIX_PHRASES } from "@/config/typing";

/**
 * 한글 오타 만들기 (화면 연출 전용 — 서버·AI 와 무관). 설정은 config/typing.ts.
 * 받침 실수, 옆 자판, 글자 겹침, 글자 순서 바뀜, 띄어쓰기 빠짐.
 */
type Rng = () => number;

const BASE = 0xac00;
const isSyl = (c: string) => {
  const n = c.charCodeAt(0);
  return n >= BASE && n <= 0xd7a3;
};
const split = (c: string) => {
  const n = c.charCodeAt(0) - BASE;
  return { l: Math.floor(n / 588), v: Math.floor((n % 588) / 28), t: n % 28 };
};
const join = (l: number, v: number, t: number) => String.fromCharCode(BASE + (l * 21 + v) * 28 + t);

/** 받침 바꿔치기 (실수하기 쉬운 쌍) */
const BATCHIM_SWAP: Record<number, number[]> = {
  1: [24], 24: [1], 4: [21], 21: [4], 19: [20, 7], 20: [19], 7: [19, 25], 25: [7], 17: [26], 26: [17], 8: [4], 16: [21],
};
/** 두벌식 자판에서 이웃한 모음 */
const VOWEL_NEIGHBOR: Record<number, number[]> = {
  0: [4, 20], 4: [0, 8, 6], 8: [4, 12, 13], 20: [0, 1], 1: [5, 20], 5: [1], 13: [18, 8, 17], 18: [13], 12: [8], 17: [13], 6: [4], 2: [0],
};
/** 두벌식 자판에서 이웃한 초성 */
const INITIAL_NEIGHBOR: Record<number, number[]> = {
  0: [3, 9, 18], 2: [6, 11], 11: [2, 5], 3: [12, 0], 7: [12], 9: [0, 18], 6: [2, 15], 12: [7, 3, 14], 18: [5, 0], 5: [11, 18], 15: [6, 16], 16: [15, 14], 14: [12, 16, 17], 17: [14],
};

const pick = <T,>(a: T[], r: Rng) => a[Math.floor(r() * a.length)];

/** 한 단어에 오타를 낸다. 바꿀 수 없으면 null */
function corrupt(word: string, r: Rng): string | null {
  const chars = [...word];
  const sylIdx = chars.map((c, i) => (isSyl(c) ? i : -1)).filter((i) => i >= 0);
  if (sylIdx.length === 0) return null;
  const ops = ["batchim", "vowel", "initial", "double", "swap"].sort(() => r() - 0.5);
  for (const op of ops) {
    const i = pick(sylIdx, r);
    const { l, v, t } = split(chars[i]);
    const out = [...chars];
    if (op === "batchim") {
      if (t !== 0 && BATCHIM_SWAP[t]) out[i] = join(l, v, pick(BATCHIM_SWAP[t], r));
      else if (t !== 0 && r() < 0.5) out[i] = join(l, v, 0);
      else continue;
    } else if (op === "vowel") {
      if (!VOWEL_NEIGHBOR[v]) continue;
      out[i] = join(l, pick(VOWEL_NEIGHBOR[v], r), t);
    } else if (op === "initial") {
      if (!INITIAL_NEIGHBOR[l]) continue;
      out[i] = join(pick(INITIAL_NEIGHBOR[l], r), v, t);
    } else if (op === "double") {
      out.splice(i, 0, chars[i]);
    } else {
      if (i + 1 >= chars.length || !isSyl(chars[i + 1]) || chars[i] === chars[i + 1]) continue;
      [out[i], out[i + 1]] = [out[i + 1], out[i]];
    }
    const s = out.join("");
    if (s !== word) return s;
  }
  return null;
}

/**
 * 말풍선 목록 중 하나에 오타를 넣는다. 정정 말풍선이 따라올 수도 있다.
 * @returns 새 목록과 (있으면) 오타가 난 위치. 오타가 없으면 그대로.
 */
export function withTypo(bubbles: string[], age: number, r: Rng = Math.random): string[] {
  if (!TYPO.enabled || bubbles.length === 0) return bubbles;
  const chance = TYPO.chance * (age >= TYPO.calmAge ? TYPO.calmFactor : 1);
  if (r() >= chance) return bubbles;
  // 오타 낼 만한 말풍선: 4글자 이상, 숫자·영문·주소가 없는 것
  const cand = bubbles.map((b, i) => i).filter((i) => {
    const b = bubbles[i];
    return b.replace(/\s/g, "").length >= 4 && !/[0-9a-zA-Z@:/]/.test(b) && /[가-힣]{2}/.test(b);
  });
  if (cand.length === 0) return bubbles;
  const bi = pick(cand, r);
  const words = bubbles[bi].split(" ");
  const wc = words.map((w, i) => i).filter((i) => /[가-힣]{2}/.test(words[i]));
  if (wc.length === 0) return bubbles;
  const wi = pick(wc, r);
  const original = words[wi];

  // 띄어쓰기 빠짐: 다음 단어와 붙는다 (정정 없이)
  let broken: string | null = null;
  if (wi + 1 < words.length && r() < 0.18) {
    const merged = [...words];
    merged.splice(wi, 2, original + words[wi + 1]);
    const out = [...bubbles];
    out[bi] = merged.join(" ");
    return out;
  }
  broken = corrupt(original, r);
  if (!broken) return bubbles;
  const w2 = [...words];
  w2[wi] = broken;
  const out = [...bubbles];
  out[bi] = w2.join(" ");
  if (r() < TYPO.fixChance) {
    // 정정은 오타가 난 말풍선 바로 뒤 (마지막 말풍선이면 그 뒤)
    const fix = r() < 0.7 ? `*${original.replace(/[~!?.,ㅎㅋ]+$/g, "") || original}` : pick([...TYPO_FIX_PHRASES], r);
    out.splice(bi + 1, 0, fix);
  }
  return out;
}
