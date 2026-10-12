"use client";

import { useEffect, useState } from "react";
import { IconBell, IconClose } from "@/components/icons";
import { NOTIFY_KINDS } from "@/config/notifications";
import { loadNotifyPlan } from "@/lib/push/planClient";
import { cancelNudges, exactAlarmAllowed, isNativeApp, lastNotifyError, lastScheduleInfo, notifyPermission, nudgeStatus, openExactAlarmSetting, requestNotifyPermission, sendTestNotification, type NotifyPermission } from "@/lib/push/nudge";
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
  const [exact, setExact] = useState<boolean | null>(null);

  useEffect(() => {
    void exactAlarmAllowed().then(setExact);
    void notifyPermission().then(setPerm);
    void nudgeStatus().then((st) =>
      setInfo(`권한: ${st.permission === "granted" ? "허용" : st.permission === "denied" ? "꺼짐" : "미확인"} · 알림 채널: ${st.channelImportance === null ? "아직 없음" : st.channelImportance >= 4 ? "팝업·소리 켜짐" : st.channelImportance === 0 ? "꺼짐" : "소리·팝업 약함(" + st.channelImportance + ")"} · 알림창에 쌓인 알림 ${st.delivered}개 · 예약된 알림 ${st.pending}개${st.next ? ` (다음 ${st.next.getMonth() + 1}/${st.next.getDate()} ${String(st.next.getHours()).padStart(2, "0")}:${String(st.next.getMinutes()).padStart(2, "0")})` : ""}${(() => {
        const ls = lastScheduleInfo();
        if (!ls) return " · 아직 예약한 기록 없음";
        const f = new Date(ls.first);
        return ` · 마지막 예약 ${new Date(ls.at).getHours()}시 ${new Date(ls.at).getMinutes()}분에 ${ls.count}개(첫 알림 ${f.getMonth() + 1}/${f.getDate()} ${String(f.getHours()).padStart(2, "0")}:${String(f.getMinutes()).padStart(2, "0")}, ${ls.exact ? "정확한 알람" : "일반 알람"})`;
      })()}${lastNotifyError() ? ` · 마지막 오류: ${lastNotifyError()}` : ""}`),
    );
  }, []);

  const runTest = async () => {
    setTestMsg("보내는 중…");
    const r = await sendTestNotification();
    setTestMsg(
      r === "ok" ? "20초 뒤에 알림이 와요. 지금 바로 앱을 홈 화면으로 보내고 기다려 보세요." : r === "denied" ? "알림 권한이 꺼져 있어요. 폰 설정 › 앱 › WitH › 알림에서 허용해 주세요." : r === "unsupported" ? "앱에서만 시험할 수 있어요." : "알림을 보내지 못했어요. 앱을 최신으로 다시 설치해 주세요.",
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
            <p className="mt-1 text-ink-mute">알림은 앱을 쓰는 동안 미리 폰에 예약돼요. 가장 가까운 알림은 지금부터 1시간 이후고, 앱을 쓰고 있을 때는 울리지 않아요.</p>
            {exact === false && (
              <div className="mt-2 rounded-xl bg-brand-50 px-3 py-2 ring-1 ring-brand-100" data-notify-exact>
                <p>‘알람 및 리마인더’가 꺼져 있어요. 켜면 알림이 정해진 시각에 더 정확하게 와요.</p>
                <button type="button" onClick={async () => setExact(await openExactAlarmSetting())} className="mt-1.5 rounded-full bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink shadow-soft ring-1 ring-ink-line">
                  알람 및 리마인더 켜기
                </button>
              </div>
            )}
            {typeof navigator !== "undefined" && /SM-|SAMSUNG/i.test(navigator.userAgent) && (
              <div className="mt-2 rounded-xl bg-paper px-3 py-2 ring-1 ring-ink-line" data-notify-samsung>
                <p className="font-semibold text-ink">갤럭시(삼성) 폰이면 꼭 확인하세요</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-ink-mute">
                  <li>설정 › 배터리 › 백그라운드 사용 제한 › ‘사용하지 않는 앱을 절전 상태로 전환’ 끄기</li>
                  <li>같은 화면의 ‘절전 상태의 앱’·‘깊은 절전 상태의 앱’ 목록에 WitH가 있으면 삭제</li>
                  <li>설정 › 앱 › WitH › 배터리 › ‘제한 없음’ 선택</li>
                  <li>설정 › 앱 › WitH › 알림 › ‘선톡 알림’이 켜져 있고 ‘팝업’으로 표시되는지 확인</li>
                </ol>
              </div>
            )}
            <p className="mt-2 text-ink-mute">그래도 안 오면 폰 설정 › 앱 › WitH › 배터리를 ‘제한 없음(최적화 안 함)’으로 바꾸고, 최근 앱 목록에서 WitH를 위로 밀어 완전히 종료하지 마세요. 일부 폰은 종료하면 예약된 알림이 지워져요.</p>
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
