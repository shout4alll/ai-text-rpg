/**
 * 📸 인물 기본 사진(룩) — 실제 값은 config/looks.json.
 *
 * 유료 "실시간 사진·영상"을 만들 때, 유저가 원한 장면에 가장 가까운 룩 사진을 첫 번째 기준 이미지로 넣는다.
 * 그러면 매번 같은 셀카 한 장만 기준으로 쓸 때보다 옷차림·장소가 요청에 맞게 나온다.
 *
 * 사진 파일: public/avatar/personas/<인물id>/base/<룩id>.jpg  (scripts/make-looks.mjs 로 만든다)
 * 파일이 없으면 지금까지처럼 stage.jpg·앨범 사진만 기준으로 쓴다.
 */
import raw from "@/config/looks.json";

export interface LookDef {
  id: string;
  /** 화면·로그용 이름 */
  label: string;
  /** 어울리는 시간대 (요청에 단서가 없을 때 이걸로 고른다) */
  when?: ("morning" | "day" | "evening" | "night")[];
  /** 사진을 만들 때 쓰는 옷차림 설명 (영어) */
  outfit: string;
  /** 장소·빛 설명 (영어) */
  place: string;
  /** 유저 요청에 이 말이 들어 있으면 이 룩을 고른다 */
  keywords: string[];
}

export const LOOKS = (raw as { looks: LookDef[] }).looks;

export const lookById = (id: string): LookDef | undefined => LOOKS.find((l) => l.id === id);

/**
 * 유저가 원한 장면(한국어)과 지금 시간대로 가장 알맞은 룩을 고른다.
 * @param have 이 인물이 실제로 가진 룩 id 들 (사진 파일이 있는 것만)
 */
export function pickLook(wish: string, have: string[], hour?: number): LookDef | undefined {
  const mine = LOOKS.filter((l) => have.includes(l.id));
  if (mine.length === 0) return undefined;
  // 1) 요청에 들어 있는 말로 고르기 (가장 많이 걸린 룩)
  let best: { look: LookDef; hits: number } | null = null;
  for (const l of mine) {
    const hits = l.keywords.filter((k) => wish.includes(k)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { look: l, hits };
  }
  if (best) return best.look;
  // 2) 단서가 없으면 지금 시간대에 어울리는 룩
  if (typeof hour === "number") {
    const slot = hour < 5 ? "night" : hour < 11 ? "morning" : hour < 17 ? "day" : hour < 22 ? "evening" : "night";
    const fit = mine.find((l) => l.when?.includes(slot));
    if (fit) return fit;
  }
  return undefined;
}
