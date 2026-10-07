"use client";

import { IconClose, IconBubble, IconScreen } from "@/components/icons";
import { THEMES, type ThemeId } from "@/config/themes";

/**
 * 🎨 대화창 꾸미기 — 화면(영상 배경 / 메신저) + 색 테마.
 * 고른 값은 기기에 기억된다 (config/themes.ts).
 */
export default function ThemePicker({
  theme,
  messenger,
  onTheme,
  onMessenger,
  onClose,
}: {
  theme: ThemeId;
  /** 메신저(카톡) 화면 */
  messenger: boolean;
  onTheme: (t: ThemeId) => void;
  /** 없으면 화면 고르기를 숨김 (대화 목록에서 열 때) */
  onMessenger?: (on: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fade-in fixed inset-0 z-[60] flex items-end justify-center bg-ink/30 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="대화창 꾸미기"
      data-theme-picker
      onClick={onClose}
    >
      <div
        className="sheet-up w-full max-w-md rounded-t-[28px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink shadow-lift sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">대화창 꾸미기</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-mute hover:bg-ink/5">
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        {onMessenger && (
          <section className="mt-4">
            <p className="text-xs font-semibold text-ink-mute">기본 화면</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[
                { on: false, icon: <IconScreen className="h-5 w-5" />, title: "영상 배경", sub: "인물이 반응하는 화면" },
                { on: true, icon: <IconBubble className="h-5 w-5" />, title: "메신저", sub: "배경 없이 톡처럼 · 공공장소" },
              ].map((o) => {
                const sel = messenger === o.on;
                return (
                  <button
                    key={o.title}
                    type="button"
                    onClick={() => onMessenger(o.on)}
                    aria-pressed={sel}
                    data-view-option={o.on ? "messenger" : "stage"}
                    className={`rounded-2xl p-3 text-left ring-1 transition ${sel ? "bg-brand-50 ring-2 ring-brand-400" : "bg-paper ring-ink-line hover:ring-brand-200"}`}
                  >
                    <span className={sel ? "text-brand-600" : "text-ink-soft"}>{o.icon}</span>
                    <p className="mt-1.5 text-sm font-semibold">{o.title}</p>
                    <p className="text-[11px] text-ink-mute">{o.sub}</p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="mt-5">
          <p className="text-xs font-semibold text-ink-mute">색 테마</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {THEMES.map((t) => {
              const sel = t.id === theme;
              const [bg, me, accent] = t.swatch;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTheme(t.id)}
                  aria-pressed={sel}
                  data-theme-option={t.id}
                  className={`overflow-hidden rounded-2xl text-left ring-1 transition ${sel ? "ring-2 ring-brand-400" : "ring-ink-line hover:ring-brand-200"}`}
                >
                  {/* 미리보기 말풍선 */}
                  <div className="space-y-1 p-2.5" style={{ background: bg }}>
                    <div className="w-3/4 rounded-xl rounded-tl-sm bg-white px-2 py-1 text-[10px] text-[#333]">안녕하세요 :)</div>
                    <div className="ml-auto w-2/3 rounded-xl rounded-tr-sm px-2 py-1 text-right text-[10px]" style={{ background: me, color: t.id === "night" ? "#fff" : "#2b2b2b" }}>
                      반가워요!
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-surface px-2.5 py-1.5">
                    <span className="text-xs font-semibold">{t.label}</span>
                    <span className="h-3 w-3 rounded-full" style={{ background: accent }} />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
