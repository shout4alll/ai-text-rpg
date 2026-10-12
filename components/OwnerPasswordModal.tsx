"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 🔑 주인님 입장 — 대화창에 "**주인님입장**" (별표 포함)을 치면 뜨는 비밀번호 창.
 *  비밀번호(치트 문구)는 대화 기록에 남지 않고 ●●●● 로만 보인다. 서버(/api/owner/enter)가 확인한다.
 */
export default function OwnerPasswordModal({ onSubmit, onClose }: { onSubmit: (code: string) => Promise<string | null>; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);

  const submit = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    const err = await onSubmit(code.trim());
    setBusy(false);
    if (err) {
      setMsg(err);
      setCode("");
      ref.current?.focus();
    } else onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose} data-owner-pw>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-2xl ring-1 ring-ink-line"
      >
        <p className="text-sm font-bold text-ink">🔑 주인님 입장</p>
        <p className="mt-1 text-xs text-ink-mute">비밀번호를 입력하세요. 대화 기록에는 남지 않아요.</p>
        <input
          ref={ref}
          type="password"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="●●●●●●"
          data-owner-pw-input
          className="mt-3 w-full rounded-xl bg-paper px-4 py-3 text-base tracking-widest text-ink ring-1 ring-ink-line focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        {msg && <p className="mt-2 text-xs text-rose-500" data-owner-pw-msg>{msg}</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-full bg-black/[0.06] py-2.5 text-sm font-semibold text-ink">취소</button>
          <button type="submit" disabled={busy || !code.trim()} data-owner-pw-ok className="flex-1 rounded-full bg-ink py-2.5 text-sm font-semibold text-white disabled:opacity-40">
            {busy ? "확인 중…" : "입장"}
          </button>
        </div>
      </form>
    </div>
  );
}
