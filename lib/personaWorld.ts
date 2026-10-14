/**
 * 🌍 세계관·일상 확장 (personas/<id>.json 의 world) — 캐릭터가 같은 소재만 되풀이하지 않게 한다.
 *  · 고정부(worldStatic): 주변 사람·장소·말버릇·관심사 — 프롬프트 고정부라 캐시가 적중한다.
 *  · 이번 턴(worldTurnLines): 시간대에 맞는 "오늘의 장면"(하루 단위로 고정) + 대화 소재·방향성·관심사를 무작위로 몇 개만.
 */
import type { PersonaFile } from "@/lib/personas/schema";

type Slot = "morning" | "day" | "evening" | "night";

function parts(tz: string): { slot: Slot; weekend: boolean; day: string } {
  try {
    const d = new Date();
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(d));
    const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d);
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
    const slot: Slot = hour < 5 ? "night" : hour < 11 ? "morning" : hour < 17 ? "day" : hour < 22 ? "evening" : "night";
    return { slot, weekend: wd === "Sat" || wd === "Sun", day };
  } catch {
    return { slot: "day", weekend: false, day: "" };
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function sample<T>(arr: readonly T[], n: number): T[] {
  const bag = [...arr];
  const out: T[] = [];
  while (out.length < n && bag.length > 0) out.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0]);
  return out;
}

/** 프롬프트 고정부에 들어가는 "너의 세계" (없으면 빈 문자열) */
export function worldStatic(p: PersonaFile): string {
  const w = p.world;
  if (!w) return "";
  const rows: string[] = [];
  if (w.people.length) rows.push(`- 주변 사람: ${w.people.map((x) => `${x.name}(${x.relation} — ${x.note})`).join(" / ")}`);
  if (w.places.length) rows.push(`- 자주 가는 곳·생활 공간: ${w.places.join(" / ")}`);
  if (w.interests.length) rows.push(`- 본업·대표 취미 밖의 관심사: ${w.interests.join(" / ")}`);
  if (w.quirks.length) rows.push(`- 말버릇·습관: ${w.quirks.join(" / ")}`);
  if (!rows.length) return "";
  return `\n[너의 세계 — 이야깃거리 창고]
${rows.join("\n")}
- 이 목록은 네 대사가 아니라 재료다. 네 직업·대표 취미 이야기는 대화 전체의 일부일 뿐이고, 나머지는 위의 사람·장소·관심사와 유저와 지금 나누는 이야기로 채워라. 같은 사람·장소·소재를 연달아 꺼내지 말고, 꺼낼 땐 구체적인 한 장면·한 마디로 말해라. 설정에 없는 가족·친구를 새로 만들어 내지 마라(필요하면 위 목록에서).`;
}

/** 이번 턴 "참고" 줄들 — 선택 사항이며 유저와 지금 하는 이야기가 우선이다 */
export function worldTurnLines(p: PersonaFile, tz: string): string[] {
  const w = p.world;
  if (!w) return [];
  const { slot, weekend, day } = parts(tz);
  const lines: string[] = [];
  const fit = w.scenes.filter((s) => !s.when || s.when === slot || (s.when === "weekend" && weekend));
  if (fit.length) {
    // 오늘의 장면: 같은 날·같은 시간대엔 같은 장면(하루 안에서 일관되게), 날이 바뀌면 다른 장면
    const today = fit[hash(`${p.id}|${day}|${slot}`) % fit.length];
    lines.push(`- 네 오늘의 장면(배경일 뿐, 유저가 묻거나 흐름이 맞을 때만 한마디로): ${today.text}`);
  }
  const topics = sample(w.topics, 2);
  if (topics.length) lines.push(`- 이번 턴에 이어 가거나 꺼내 볼 만한 소재(전부 선택 사항, 지금 하던 이야기가 있으면 그게 먼저): ${topics.map((t) => `「${t}」`).join(" ")}`);
  const interest = sample(w.interests, 1);
  if (interest.length) lines.push(`- 요즘 빠진 것 하나(역시 선택): 「${interest[0]}」`);
  const mood = sample(w.moods, 1);
  if (mood.length) lines.push(`- 이번 턴의 대화 결(유저 기분·상황에 어긋나면 무시): ${mood[0]}`);
  return lines;
}
