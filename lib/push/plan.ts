/**
 * 🗓 선톡 알림 시간표 만들기 (순수 함수 — 기기와 무관하게 시험할 수 있다).
 *
 * 규칙
 *  - 하루 3~4번, 오전 9시 ~ 밤 10시 사이에서만. 그 밖의 시각은 절대 만들지 않는다.
 *  - 하루 시간대를 같은 길이로 나눠 칸마다 한 번씩 랜덤으로 고르므로 알림끼리 너무 붙지 않고, 매일 시각이 다르다.
 *  - 지금부터 NOTIFY_MIN_LEAD_MIN 분 이내의 시각은 버린다 (대화를 막 끝낸 직후에 오지 않게).
 *  - 누가 보낼지: 최근에 대화한 사람일수록 자주, 같은 사람이 연달아 나오지 않게.
 *  - 무엇을 보낼지: 메시지가 기본이고, 안 보낸 사진·영상이 남아 있을 때 가끔 사진·영상.
 */
import {
  NOTIFY_DAYS_AHEAD,
  NOTIFY_ID_BASE,
  NOTIFY_ID_COUNT,
  NOTIFY_MIN_LEAD_MIN,
  NOTIFY_PER_DAY,
  NOTIFY_WINDOW,
  type NudgeKind,
} from "@/config/notifications";
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
}

type Rng = () => number;

const at = (base: Date, dayOffset: number, hour: number, minute: number) =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, hour, minute, 0, 0);

/** 하루 치 시각들 (정렬됨, 모두 [startHour, endHour - margin) 안) */
export function daySlots(base: Date, dayOffset: number, rng: Rng): Date[] {
  const start = at(base, dayOffset, NOTIFY_WINDOW.startHour, 0).getTime();
  const end = at(base, dayOffset, NOTIFY_WINDOW.endHour, 0).getTime() - NOTIFY_WINDOW.endMarginMin * 60_000;
  const n = NOTIFY_PER_DAY.min + Math.floor(rng() * (NOTIFY_PER_DAY.max - NOTIFY_PER_DAY.min + 1));
  const seg = (end - start) / n;
  const slots: Date[] = [];
  for (let k = 0; k < n; k++) {
    const lo = start + seg * k + seg * 0.12;
    const hi = start + seg * (k + 1) - seg * 0.12;
    const t = Math.min(end, Math.max(start, lo + rng() * (hi - lo)));
    slots.push(new Date(Math.floor(t / 60_000) * 60_000)); // 분 단위로
  }
  return slots;
}

/** 앞으로 예약할 모든 시각 (지금 + 여유 시간 이후만) */
export function planSlotTimes(now: Date, rng: Rng = Math.random): Date[] {
  const minAt = now.getTime() + NOTIFY_MIN_LEAD_MIN * 60_000;
  const out: Date[] = [];
  for (let d = 0; d < NOTIFY_DAYS_AHEAD; d++) {
    for (const t of daySlots(now, d, rng)) if (t.getTime() >= minAt) out.push(t);
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

export function planNudges(now: Date, candidates: NudgeCandidate[], settings: NotifySettings, rng: Rng = Math.random): PlannedNudge[] {
  const msgOn = kindOn(settings, "nudge_message");
  const mediaOn = kindOn(settings, "nudge_media");
  if (!settings.enabled || (!msgOn && !mediaOn) || candidates.length === 0) return [];

  const sorted = [...candidates].sort((a, b) => b.lastAt - a.lastAt);
  const left = new Map(sorted.map((c) => [c.personaId, { photos: c.photos, videos: c.videos }]));
  const planned: PlannedNudge[] = [];
  let prev: string | null = null;

  for (const t of planSlotTimes(now, rng)) {
    const who = pickPersona(sorted, prev, rng);
    prev = who.personaId;
    const stock = left.get(who.personaId)!;
    const canMedia = mediaOn && stock.photos + stock.videos > 0;
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
    planned.push({ id: NOTIFY_ID_BASE + planned.length, at: t, personaId: who.personaId, name: who.name, kind });
  }
  return planned;
}
