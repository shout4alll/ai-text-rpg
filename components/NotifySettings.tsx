"use client";

import { useEffect, useState } from "react";
import { IconBell, IconClose } from "@/components/icons";
import { NOTIFY_KINDS } from "@/config/notifications";
import { loadNotifyPlan } from "@/lib/push/planClient";
import { cancelNudges, isNativeApp, notifyPermission, nudgeStatus, requestNotifyPermission, sendTestNotification, type NotifyPermission } from "@/lib/push/nudge";
import { loadNotifySettings, saveNotifySettings, type NotifySettings as Settings } from "@/lib/push/settings";

/**
 * 🔔 알림 설정 — 전체 on/off + 종류별 on/off.
 * 알림 종류를 늘리려면 config/notifications.ts 의 NOTIFY_KINDS 에 한 줄만 추가하면 여기 목록에 자동으로 나온다.
 * 알림은 앱(Android/iOS)에서만 온다. 웹에서는 안내만 보여 준다.
 */
export default function NotifySettings({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<Settings>(() => loadNotifySettings());
  const [perm, setPerm] = useState<NotifyPermission>("unsupported");
  const native = isNativeApp();
  const [testMsg, setTestMsg] = useState("");
  const [plan] = useState(() => loadNotifyPlan());
  const [info, setInfo] = useState("");

  useEffect(() => {
    void notifyPermission().then(setPerm);
    void nudgeStatus().then((st) =>
      setInfo(`권한: ${st.permission === "granted" ? "허용" : st.permission === "denied" ? "꺼짐" : "미확인"} · 예약된 알림 ${st.pending}개${st.next ? ` (다음 ${st.next.getMonth() + 1}/${st.next.getDate()} ${String(st.next.getHours()).padStart(2, "0")}:${String(st.next.getMinutes()).padStart(2, "0")})` : ""}`),
    );
  }, []);

  const runTest = async () => {
    setTestMsg("보내는 중…");
    const r = await sendTestNotification();
    setTestMsg(
      r === "ok" ? "5초 뒤에 알림이 와요. 지금 앱을 홈 화면으로 보내 보세요." : r === "denied" ? "알림 권한이 꺼져 있어요. 폰 설정 › 앱 › WitH › 알림에서 허용해 주세요." : r === "unsupported" ? "앱에서만 시험할 수 있어요." : "알림을 보내지 못했어요. 앱을 최신으로 다시 설치해 주세요.",
    );
  };

  const update = (next: Settings) => {
    setS(next);
    saveNotifySettings(next);
    // 끄면 이미 예약된 알림도 바로 없앤다
    if (!next.enabled) void cancelNudges();
  };

  const toggleAll = async () => {
    const enabled = !s.enabled;
    update({ ...s, enabled });
    if (enabled && native && perm !== "granted") setPerm(await requestNotifyPermission());
  };

  return (
    <div
      className="fade-in fixed inset-0 z-[60] flex items-end justify-center bg-ink/30 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="알림 설정"
      data-notify-settings
      onClick={onClose}
    >
      <div
        className="sheet-up max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink shadow-lift sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <IconBell className="h-5 w-5 text-brand-500" /> 알림 설정
          </h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-mute hover:bg-ink/5">
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        {!native && (
          <p className="mt-3 rounded-2xl bg-paper px-3.5 py-3 text-[13px] leading-relaxed text-ink-soft ring-1 ring-ink-line" data-notify-web-note>
            알림은 WitH 앱에서만 받을 수 있어요. 앱을 설치하면 이 설정이 그대로 적용돼요.
          </p>
        )}

        {/* 전체 */}
        <section className="mt-4 rounded-2xl bg-paper p-1 ring-1 ring-ink-line">
          <Row title="푸시 알림" desc="끄면 어떤 알림도 오지 않아요" on={s.enabled} onToggle={toggleAll} data="all" />
        </section>

        {/* 종류별 */}
        <section className="mt-4">
          <p className="text-xs font-semibold text-ink-mute">알림 종류</p>
          <div className={`mt-2 divide-y divide-ink-line rounded-2xl bg-paper px-1 ring-1 ring-ink-line ${s.enabled ? "" : "opacity-50"}`}>
            {NOTIFY_KINDS.map((k) => (
              <Row
                key={k.id}
                title={k.label}
                desc={k.desc}
                on={s.kinds[k.id] !== false}
                disabled={!s.enabled}
                data={k.id}
                onToggle={() => update({ ...s, kinds: { ...s.kinds, [k.id]: s.kinds[k.id] === false } })}
              />
            ))}
          </div>
        </section>

        <p className="mt-4 text-[12px] leading-relaxed text-ink-mute">
          인물이 먼저 말을 걸면 알림이 와요. {plan.window.start}부터 {plan.window.end} 사이에만, 아침·점심·저녁·잠자리 같은 일과에 맞춰 하루 {plan.perDay.min}~{plan.perDay.max}번 정도 보내고 그 밖의 시간에는 절대 보내지 않아요. 알림에는 누가 보냈는지만 보이고 내용은 보이지 않아요.
        </p>

        {native && s.enabled && perm === "denied" && (
          <p className="mt-3 rounded-2xl bg-brand-50 px-3.5 py-3 text-[13px] leading-relaxed text-ink-soft ring-1 ring-brand-100" data-notify-denied>
            폰 설정에서 WitH의 알림이 꺼져 있어요. 폰의 설정 › 앱 › WitH › 알림에서 허용해 주세요.
          </p>
        )}
        {native && (
          <div className="mt-3 rounded-2xl bg-paper px-3.5 py-3 text-[12px] leading-relaxed text-ink-soft ring-1 ring-ink-line" data-notify-diag>
            <p data-notify-info>{info}</p>
            <p className="mt-1 text-ink-mute">앱을 열어 둔 동안은 예약이 0개인 게 정상이에요. 홈 화면으로 나가면 오전 9시~밤 10시 사이로 예약되고, 가장 가까운 알림도 1시간 이후예요.</p>
            <button type="button" onClick={runTest} data-notify-test className="mt-2 rounded-full bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink shadow-soft ring-1 ring-ink-line">
              테스트 알림 보내기
            </button>
            {testMsg && <p className="mt-1.5 text-ink">{testMsg}</p>}
          </div>
        )}
        {native && s.enabled && perm === "prompt" && (
          <button
            type="button"
            onClick={async () => setPerm(await requestNotifyPermission())}
            className="mt-3 w-full rounded-2xl bg-gradient-to-r from-brand-500 to-brand-400 py-3 text-sm font-semibold text-onbrand shadow-glow"
          >
            알림 허용하기
          </button>
        )}
      </div>
    </div>
  );
}

function Row({
  title,
  desc,
  on,
  onToggle,
  disabled = false,
  data,
}: {
  title: string;
  desc: string;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  data: string;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-[12px] text-ink-mute">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        disabled={disabled}
        data-notify-toggle={data}
        onClick={onToggle}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-brand-400" : "bg-ink-line"} disabled:cursor-not-allowed`}
      >
        <span className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}
