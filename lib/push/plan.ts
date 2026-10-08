/**
 * 🗓 선톡 알림 시간표 만들기 (순수 함수 — 기기와 무관하게 시험할 수 있다).
 *
 * 규칙 (일과표 = lib/push/planSchema.ts, 기본값 config/notifications.ts, CMS 가 덮어쓴다)
 *  - 하루 6~7번: 아침·점심·저녁·잠자리 같은 required 슬롯은 매일, 나머지 슬롯에서 목표 횟수만큼 뽑는다.
 *  - 슬롯마다 기준 시각 ± jitter 로 흔들어 매일 시각이 조금씩 다르다. window 밖의 시각은 절대 만들지 않는다.
 *  - 알림 사이는 minGapMin 이상 벌린다 (붙으면 optional 슬롯을 버린다).
 *  - 지금부터 minLeadMin 분 이내의 시각은 버린다 (대화를 막 끝낸 직후에 오지 않게).
 *  - 누가 보낼지: 최근에 대화한 사람일수록 자주, 같은 사람이 연달아 나오지 않게.
 *  - 무엇을 보낼지: 메시지가 기본이고, 슬롯이 허용하고 안 보낸 사진·영상이 남아 있을 때 가끔 사진·영상.
 */
import { NOTIFY_ID_BASE, NOTIFY_ID_COUNT, type NudgeKind } from "@/config/notifications";
import { toMin, type NotifyPlan, type NotifySlot } from "@/lib/push/planSchema";
import { kindOn, type NotifySettings } from "@/lib/push/settings";

export interface NudgeCandidate {
  personaId: string;
  name: string;
  /** 마지막 대화 시각 (ms) */
  lastAt: number;
  /** 아직 안 보낸 앨범 항목 수 */
  photos: number;
  videos: number;
}

export interface PlannedNudge {
  id: number;
  at: Date;
  personaId: string;
  name: string;
  kind: NudgeKind;
  /** 일과표 슬롯 id (morning, lunch …) — 서버가 그 시간대 상황 지침을 붙인다 */
  topic: string;
}

type Rng = () => number;

const atMin = (base: Date, dayOffset: number, minutes: number) =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, Math.floor(minutes / 60), minutes % 60, 0, 0);

export interface DaySlot {
  at: Date;
  slot: NotifySlot;
}

/** 하루 치 (정렬됨, 모두 window 안, minGapMin 이상 간격) */
export function daySlots(base: Date, dayOffset: number, plan: NotifyPlan, rng: Rng): DaySlot[] {
  const lo = toMin(plan.window.start);
  const hi = toMin(plan.window.end);
  const usable = plan.slots.filter((s) => s.enabled);
  const required = usable.filter((s) => s.required);
  const optional = usable.filter((s) => !s.required);
  const want = plan.perDay.min + Math.floor(rng() * (plan.perDay.max - plan.perDay.min + 1));
  // 필수 + 목표 횟수가 될 때까지 선택 슬롯을 무작위로 (순서는 나중에 시각으로 정렬)
  const pool = [...optional];
  const chosen = [...required];
  while (chosen.length < want && pool.length) chosen.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);

  const items = chosen.map((slot) => {
    const jitter = (rng() * 2 - 1) * slot.jitterMin;
    const m = Math.round(Math.min(hi - 1, Math.max(lo, toMin(slot.at) + jitter)));
    return { at: atMin(base, dayOffset, m), slot, m };
  });
  items.sort((a, b) => a.m - b.m);
  // 너무 붙은 것은 선택 슬롯부터 버린다
  const out: typeof items = [];
  for (const it of items) {
    const prev = out[out.length - 1];
    if (prev && it.m - prev.m < plan.minGapMin) {
      if (!it.slot.required) continue;
      if (!prev.slot.required) {
        out.pop();
        out.push(it);
        continue;
      }
    }
    out.push(it);
  }
  return out.map(({ at, slot }) => ({ at, slot }));
}

/** 앞으로 예약할 모든 시각 (지금 + 여유 시간 이후만) */
export function planSlotTimes(now: Date, plan: NotifyPlan, rng: Rng = Math.random): DaySlot[] {
  if (!plan.enabled) return [];
  const minAt = now.getTime() + plan.minLeadMin * 60_000;
  const out: DaySlot[] = [];
  for (let d = 0; d < plan.daysAhead; d++) {
    for (const s of daySlots(now, d, plan, rng)) if (s.at.getTime() >= minAt) out.push(s);
  }
  return out.slice(0, NOTIFY_ID_COUNT);
}

function pickPersona(sorted: NudgeCandidate[], prev: string | null, rng: Rng): NudgeCandidate {
  // 최근 대화한 순서대로 4, 2, 1, 1 ... 가중치
  const weights = sorted.map((_, i) => (i === 0 ? 4 : i === 1 ? 2 : 1));
  const pool = sorted.length > 1 ? sorted.map((c, i) => ({ c, w: c.personaId === prev ? 0 : weights[i] })) : sorted.map((c, i) => ({ c, w: weights[i] }));
  const total = pool.reduce((s, x) => s + x.w, 0);
  let r = rng() * total;
  for (const x of pool) {
    r -= x.w;
    if (r <= 0) return x.c;
  }
  return pool[pool.length - 1].c;
}

export function planNudges(now: Date, candidates: NudgeCandidate[], settings: NotifySettings, plan: NotifyPlan, rng: Rng = Math.random): PlannedNudge[] {
  const msgOn = kindOn(settings, "nudge_message");
  const mediaOn = kindOn(settings, "nudge_media");
  if (!settings.enabled || (!msgOn && !mediaOn) || candidates.length === 0) return [];

  const sorted = [...candidates].sort((a, b) => b.lastAt - a.lastAt);
  const left = new Map(sorted.map((c) => [c.personaId, { photos: c.photos, videos: c.videos }]));
  const planned: PlannedNudge[] = [];
  let prev: string | null = null;

  for (const { at: t, slot } of planSlotTimes(now, plan, rng)) {
    const who = pickPersona(sorted, prev, rng);
    prev = who.personaId;
    const stock = left.get(who.personaId)!;
    const canMedia = mediaOn && slot.allowMedia && stock.photos + stock.videos > 0;
    // 메시지가 꺼져 있으면 사진·영상만, 사진·영상이 없으면 메시지만. 둘 다 되면 약 30%가 사진·영상
    let kind: NudgeKind = "message";
    if (canMedia && (!msgOn || rng() < 0.3)) {
      const photoShare = stock.photos / (stock.photos + stock.videos);
      kind = rng() < photoShare ? "photo" : "video";
      if (kind === "photo") stock.photos -= 1;
      else stock.videos -= 1;
    } else if (!msgOn) {
      continue; // 메시지는 꺼져 있고 보낼 사진·영상도 없다
    }
    planned.push({ id: NOTIFY_ID_BASE + planned.length, at: t, personaId: who.personaId, name: who.name, kind, topic: slot.id });
  }
  return planned;
}
