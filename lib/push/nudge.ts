/**
 * 📲 선톡 알림 — 기기 예약 알림(Capacitor Local Notifications) 연결.
 *
 * 흐름
 *  1) 앱이 백그라운드로 가면 → 시간표(lib/push/plan.ts)대로 알림을 폰에 예약한다 (오전 9시~밤 10시, 하루 3~4번).
 *  2) 앱이 다시 앞으로 오면 → 예약을 모두 취소한다 (지금 쓰는 중이니 알림이 필요 없다).
 *  3) 알림이 도착했거나 눌렀다면 → "도착한 선톡" 목록(queue)에 넣는다. 대화방을 열면 인물이 그 종류에 맞게 실제로 먼저 말을 건다.
 *
 * 웹 브라우저에서는 아무것도 하지 않는다 (앱 전용).
 */
import { Capacitor } from "@capacitor/core";
import {
  NOTIFY_CHANNEL,
  NOTIFY_ID_BASE,
  NOTIFY_ID_COUNT,
  NOTIFY_TITLE,
  NUDGE_KEEP_MS,
  nudgeBody,
  type NudgeKind,
} from "@/config/notifications";
import { planNudges, type NudgeCandidate } from "@/lib/push/plan";
import { loadNotifyPlan, refreshNotifyPlan } from "@/lib/push/planClient";
import { loadNotifySettings, saveNotifySettings } from "@/lib/push/settings";

export type { NudgeCandidate } from "@/lib/push/plan";

export const isNativeApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

const inRange = (id: number) => id >= NOTIFY_ID_BASE && id < NOTIFY_ID_BASE + NOTIFY_ID_COUNT;

type LN = (typeof import("@capacitor/local-notifications"))["LocalNotifications"];
let pluginCache: Promise<LN> | null = null;

/** 플러그인은 미리 불러 둔다 — 앱이 백그라운드로 가는 순간에 처음 불러오면 예약이 끊길 수 있다 */
function plugin(): Promise<LN> {
  if (!pluginCache) pluginCache = import("@capacitor/local-notifications").then((m) => m.LocalNotifications);
  return pluginCache;
}
if (typeof window !== "undefined" && isNativeApp()) void plugin().catch(() => {});

/* ── 도착한 선톡 목록 (대화방에서 꺼내 쓴다) ──────────────────────────────── */
export interface Nudge {
  /** 중복 방지 키 (알림 id + 예약 시각) */
  key: string;
  personaId: string;
  kind: NudgeKind;
  /** 일과표 슬롯 id (morning·lunch·goodnight …) */
  topic?: string;
  /** 알림이 울릴 예정이던 시각(ms) */
  at: number;
}

const QUEUE_KEY = "ai-rpg.nudge.queue";
const HANDLED_KEY = "ai-rpg.nudge.handled";

function readList<T>(key: string): T[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}
function writeList(key: string, v: unknown[]) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* 저장 불가 환경은 무시 */
  }
}

function queue(): Nudge[] {
  const now = Date.now();
  return readList<Nudge>(QUEUE_KEY).filter((n) => n && typeof n.key === "string" && now - n.at < NUDGE_KEEP_MS);
}

/** 도착한 선톡 추가 (이미 처리했거나 목록에 있으면 무시) */
export function addNudge(n: Nudge): void {
  const handled = readList<string>(HANDLED_KEY);
  const q = queue();
  if (handled.includes(n.key) || q.some((x) => x.key === n.key)) return;
  writeList(QUEUE_KEY, [...q, n].slice(-30));
}

/** 이 인물에게 도착해 있는 선톡 중 가장 오래된 것 */
export function peekNudge(personaId: string): Nudge | null {
  return queue().find((n) => n.personaId === personaId) ?? null;
}

/** 대화방에 전달했으면 목록에서 지운다 */
export function consumeNudge(key: string): void {
  writeList(QUEUE_KEY, queue().filter((n) => n.key !== key));
  writeList(HANDLED_KEY, [...readList<string>(HANDLED_KEY), key].slice(-60));
}

/** 인물과의 대화를 지우면 그 인물의 선톡도 같이 지운다 */
export function dropNudges(personaId: string): void {
  writeList(QUEUE_KEY, queue().filter((n) => n.personaId !== personaId));
}

/** 어떤 인물에게 도착한 선톡이 있는가 (대화 목록 표시용) */
export function nudgedPersonas(): Set<string> {
  return new Set(queue().map((n) => n.personaId));
}

/* ── 권한 ───────────────────────────────────────────────────────────────── */
export type NotifyPermission = "granted" | "denied" | "prompt" | "unsupported";

export async function notifyPermission(): Promise<NotifyPermission> {
  if (!isNativeApp()) return "unsupported";
  try {
    const r = await (await plugin()).checkPermissions();
    return r.display === "granted" ? "granted" : r.display === "denied" ? "denied" : "prompt";
  } catch {
    return "unsupported";
  }
}

/** 알림 허용을 요청한다 (안드로이드 13+·iOS 에서 시스템 창이 뜬다) */
export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (!isNativeApp()) return "unsupported";
  try {
    const r = await (await plugin()).requestPermissions();
    const s = loadNotifySettings();
    saveNotifySettings({ ...s, asked: true });
    return r.display === "granted" ? "granted" : "denied";
  } catch {
    return "unsupported";
  }
}

/* ── 예약 / 취소 / 수신 ──────────────────────────────────────────────────── */
async function ensureChannel() {
  if (Capacitor.getPlatform() !== "android") return;
  try {
    await (await plugin()).createChannel({
      id: NOTIFY_CHANNEL.id,
      name: NOTIFY_CHANNEL.name,
      description: NOTIFY_CHANNEL.description,
      importance: 4, // 소리와 함께 헤드업
      visibility: 0, // 잠금 화면에서는 내용 숨김
    });
  } catch {
    /* 채널을 못 만들어도 기본 채널로 간다 */
  }
}

/** 예약된 선톡 알림을 모두 취소 */
export async function cancelNudges(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const LN = await plugin();
    const { notifications } = await LN.getPending();
    const mine = notifications.filter((n) => inRange(n.id)).map((n) => ({ id: n.id }));
    if (mine.length) await LN.cancel({ notifications: mine });
  } catch {
    /* 다음에 다시 */
  }
}

/** 앱이 백그라운드로 갈 때: 시간표대로 다시 예약 (설정이 꺼져 있거나 권한이 없으면 예약하지 않는다) */
export async function scheduleNudges(candidates: NudgeCandidate[]): Promise<number> {
  if (!isNativeApp()) return 0;
  await cancelNudges();
  const settings = loadNotifySettings();
  if (!settings.enabled) return 0;
  if ((await notifyPermission()) !== "granted") return 0;
  const plan = planNudges(new Date(), candidates, settings, loadNotifyPlan());
  if (plan.length === 0) return 0;
  try {
    await ensureChannel();
    await (await plugin()).schedule({
      notifications: plan.map((p) => ({
        id: p.id,
        title: NOTIFY_TITLE,
        body: nudgeBody(p.name, p.kind),
        channelId: NOTIFY_CHANNEL.id,
        schedule: { at: p.at, allowWhileIdle: true },
        extra: { personaId: p.personaId, kind: p.kind, topic: p.topic, at: p.at.getTime() },
      })),
    });
    return plan.length;
  } catch {
    return 0;
  }
}

const isNudgeKind = (k: unknown): k is NudgeKind => k === "message" || k === "photo" || k === "video";

function toNudge(id: number, extra: unknown): Nudge | null {
  const e = (extra ?? {}) as { personaId?: unknown; kind?: unknown; at?: unknown; topic?: unknown };
  if (typeof e.personaId !== "string" || !isNudgeKind(e.kind)) return null;
  const at = typeof e.at === "number" ? e.at : Date.now();
  return { key: `${id}:${at}`, personaId: e.personaId, kind: e.kind, topic: typeof e.topic === "string" ? e.topic : undefined, at };
}

/** 이미 도착해 알림창에 쌓여 있는 선톡을 목록으로 옮기고 알림창은 비운다 */
export async function syncDeliveredNudges(): Promise<number> {
  if (!isNativeApp()) return 0;
  try {
    const LN = await plugin();
    const { notifications } = await LN.getDeliveredNotifications();
    const mine = notifications.filter((n) => inRange(n.id));
    let added = 0;
    for (const n of mine) {
      const nudge = toNudge(n.id, n.extra);
      if (nudge) {
        addNudge(nudge);
        added += 1;
      }
    }
    if (mine.length) await LN.removeDeliveredNotifications({ notifications: mine.map((n) => ({ id: n.id, title: n.title ?? "", body: n.body ?? "" })) });
    return added;
  } catch {
    return 0;
  }
}

export interface NudgeLifecycleHandlers {
  /** 백그라운드로 갈 때 예약할 후보 (최근 대화 기록에서 만든다) */
  getCandidates: () => NudgeCandidate[];
  /** 알림을 눌렀거나(personaId 있음) 앱이 앞으로 와서 도착한 선톡이 정리되었을 때(없음) */
  onDelivered: (personaId?: string) => void;
}

/**
 * 앱 수명주기에 연결한다. 반환값은 해제 함수.
 * 시작할 때도 한 번 "앞으로 온 것"으로 처리한다 (꺼져 있던 동안 도착한 알림 정리).
 */
export function startNudgeLifecycle(h: NudgeLifecycleHandlers): () => void {
  if (!isNativeApp()) return () => {};
  const subs: { remove: () => Promise<void> | void }[] = [];
  let disposed = false;

  const toForeground = async () => {
    await syncDeliveredNudges();
    if (!disposed) h.onDelivered();
    // 쓰는 중에도 "지금부터 minLeadMin 뒤" 기준으로 예약을 계속 갱신해 둔다.
    // (앱이 백그라운드로 가는 순간에만 예약하면, 그 사이 OS 가 앱을 멈추면 예약이 통째로 빠진다)
    await scheduleNudges(h.getCandidates());
  };
  const toBackground = () => {
    void scheduleNudges(h.getCandidates());
  };
  // 쓰는 동안에도 10분마다 예약을 "지금부터 minLeadMin 뒤" 기준으로 밀어 둔다 → 쓰는 중에 알림이 울리지 않고, 갑자기 앱이 멈춰도 예약이 남는다
  const tick = setInterval(() => void scheduleNudges(h.getCandidates()), 10 * 60_000);

  void (async () => {
    try {
      const { App } = await import("@capacitor/app");
      const LN = await plugin();
      const s1 = await App.addListener("appStateChange", ({ isActive }) => (isActive ? void toForeground() : toBackground()));
      const s2 = await LN.addListener("localNotificationActionPerformed", (e) => {
        const nudge = toNudge(e.notification.id, e.notification.extra);
        if (!nudge) return;
        addNudge(nudge);
        void LN.removeDeliveredNotifications({ notifications: [{ id: e.notification.id, title: "", body: "" }] }).catch(() => {});
        if (!disposed) h.onDelivered(nudge.personaId);
      });
      if (disposed) {
        void s1.remove();
        void s2.remove();
        return;
      }
      subs.push(s1, s2);
      await refreshNotifyPlan(); // CMS 일과표 (실패하면 마지막 값/기본값)
      // 처음 실행이면 바로 알림 권한을 묻는다 (기다렸다 묻지 않아야 첫 백그라운드 때 예약된다)
      const st = loadNotifySettings();
      if (st.enabled && !st.asked && (await notifyPermission()) === "prompt") await requestNotifyPermission();
      await toForeground(); // 권한을 받은 뒤에 예약해야 첫 실행에서도 예약된다
    } catch {
      /* 플러그인을 못 불러오면 알림 없이 동작 */
    }
  })();

  return () => {
    disposed = true;
    clearInterval(tick);
    for (const s of subs) void s.remove();
  };
}

/* ── 점검용 (설정 화면) ──────────────────────────────────────────────────── */
export interface NudgeStatus {
  permission: NotifyPermission;
  /** 지금 폰에 예약돼 있는 선톡 알림 수 (앱을 보고 있는 동안은 0이 정상 — 닫으면 예약된다) */
  pending: number;
  next: Date | null;
}

export async function nudgeStatus(): Promise<NudgeStatus> {
  const permission = await notifyPermission();
  if (!isNativeApp() || permission === "unsupported") return { permission, pending: 0, next: null };
  try {
    const { notifications } = await (await plugin()).getPending();
    const times = notifications
      .filter((n) => inRange(n.id))
      .map((n) => (n.schedule?.at ? new Date(n.schedule.at).getTime() : 0))
      .filter((t) => t > 0)
      .sort((a, b) => a - b);
    return { permission, pending: times.length, next: times.length ? new Date(times[0]) : null };
  } catch {
    return { permission, pending: 0, next: null };
  }
}

const TEST_ID = NOTIFY_ID_BASE + NOTIFY_ID_COUNT + 1;

/** 5초 뒤에 시험 알림을 보낸다. 앱을 홈 화면으로 보내 두고 기다리면 알림이 온다. */
export async function sendTestNotification(): Promise<"ok" | "denied" | "unsupported" | "error"> {
  if (!isNativeApp()) return "unsupported";
  try {
    if ((await notifyPermission()) !== "granted") {
      if ((await requestNotifyPermission()) !== "granted") return "denied";
    }
    await ensureChannel();
    await (await plugin()).schedule({
      notifications: [
        {
          id: TEST_ID,
          title: NOTIFY_TITLE,
          body: "알림이 잘 도착했어요",
          channelId: NOTIFY_CHANNEL.id,
          schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
        },
      ],
    });
    return "ok";
  } catch {
    return "error";
  }
}
