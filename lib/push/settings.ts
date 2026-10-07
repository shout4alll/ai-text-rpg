/**
 * 🔔 알림 설정 저장 (이 기기에만, localStorage).
 * 전체 on/off + 종류별 on/off. 종류가 늘어도 기본값으로 채워지므로 예전 저장값과 호환된다.
 */
import { NOTIFY_KINDS, NOTIFY_SETTINGS_KEY } from "@/config/notifications";

export interface NotifySettings {
  /** 전체 알림 (끄면 아무것도 안 온다) */
  enabled: boolean;
  /** 종류별 (id → 켬/끔) */
  kinds: Record<string, boolean>;
  /** 알림 권한을 이미 한 번 물어봤는가 */
  asked: boolean;
}

export function defaultNotifySettings(): NotifySettings {
  return {
    enabled: true,
    kinds: Object.fromEntries(NOTIFY_KINDS.map((k) => [k.id, k.default])),
    asked: false,
  };
}

export function loadNotifySettings(): NotifySettings {
  const base = defaultNotifySettings();
  try {
    const raw = localStorage.getItem(NOTIFY_SETTINGS_KEY);
    if (!raw) return base;
    const d = JSON.parse(raw) as Partial<NotifySettings>;
    return {
      enabled: typeof d.enabled === "boolean" ? d.enabled : base.enabled,
      kinds: { ...base.kinds, ...(d.kinds && typeof d.kinds === "object" ? d.kinds : {}) },
      asked: d.asked === true,
    };
  } catch {
    return base;
  }
}

export function saveNotifySettings(s: NotifySettings): void {
  try {
    localStorage.setItem(NOTIFY_SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* 저장 불가 환경은 무시 */
  }
}

/** 이 종류의 알림을 지금 보내도 되는가 (전체 + 종류 둘 다 켜져 있어야 한다) */
export function kindOn(s: NotifySettings, id: string): boolean {
  return s.enabled && s.kinds[id] !== false;
}
