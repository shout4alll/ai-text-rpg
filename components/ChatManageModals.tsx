"use client";

import { useRef, useState } from "react";
import PersonaPortrait from "@/components/PersonaPortrait";
import { downloadBackup, readBackup, restoreBackup, type BackupFile } from "@/lib/backup";
import type { Persona } from "@/lib/personas/types";

function Shell({
  children,
  onClose,
  label,
  tone = "slate",
}: {
  children: React.ReactNode;
  onClose: () => void;
  label: string;
  tone?: "slate" | "rose";
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <div
        className={`max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white text-ink shadow-lift ring-1 ${
          tone === "rose" ? "ring-brand-100" : "ring-ink-line"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* ── 대화 초기화 (두 번 확인) ──────────────────────────────────────────── */
export function ResetFlow({
  persona,
  affection,
  memoryCount,
  messageCount,
  onBackup,
  onConfirm,
  onCancel,
}: {
  persona: Persona;
  affection: number;
  memoryCount: number;
  messageCount: number;
  onBackup: () => Promise<void>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [backingUp, setBackingUp] = useState(false);
  return (
    <Shell onClose={onCancel} label="대화 초기화" tone="rose">
      <div className="flex items-center gap-3 bg-gradient-to-r from-brand-100 to-white px-5 py-4" data-reset-step={step}>
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl ring-2 ring-brand-200">
          <PersonaPortrait persona={persona} size="sm" className="h-full w-full" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-bold">{step === 1 ? "대화를 초기화할까요?" : "정말 지울까요?"}</p>
          <p className="text-xs text-ink-mute">{persona.name} 님과의 대화</p>
        </div>
      </div>

      {step === 1 ? (
        <div className="space-y-3 px-5 py-4 text-sm">
          <p className="text-ink-soft">처음 만난 사이로 돌아가요. 아래 내용이 모두 지워져요.</p>
          <ul className="space-y-1 rounded-2xl bg-paper px-3.5 py-2.5 text-[13px] text-ink-soft">
            <li>💬 주고받은 메시지 {messageCount}개 (보이스톡 기록 포함)</li>
            <li>💗 호감도 ♥ {Math.round(affection)}</li>
            <li>🧠 {persona.name} 님의 기억 {memoryCount}개</li>
            <li>🖼 내가 보낸 사진·영상</li>
          </ul>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onCancel} className="flex-1 rounded-2xl bg-ink/5 py-3 text-sm font-medium hover:bg-ink/10">
              취소
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              data-reset-next
              className="flex-1 rounded-2xl bg-rose-500/80 py-3 text-sm font-bold hover:bg-rose-500"
            >
              초기화
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 px-5 py-4 text-sm">
          <p className="rounded-2xl bg-rose-500/15 px-3.5 py-3 text-[13px] leading-relaxed text-brand-700 ring-1 ring-brand-100">
            {persona.name} 님과의 <b>추억이 모두 사라집니다.</b>
            <br />
            지운 뒤에는 되돌릴 수 없어요. 남겨 두고 싶다면 먼저 내 PC에 백업하세요.
          </p>
          <button
            type="button"
            disabled={backingUp}
            onClick={async () => {
              setBackingUp(true);
              try {
                await onBackup();
                onConfirm();
              } finally {
                setBackingUp(false);
              }
            }}
            data-reset-backup
            className="w-full rounded-2xl bg-brand-500 py-3 text-sm font-bold hover:bg-brand-400 disabled:opacity-60"
          >
            {backingUp ? "백업 파일 만드는 중…" : "💾 백업하고 지우기"}
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="flex-1 rounded-2xl bg-ink/5 py-3 text-sm font-medium hover:bg-ink/10">
              그만두기
            </button>
            <button
              type="button"
              onClick={onConfirm}
              data-reset-confirm
              className="flex-1 rounded-2xl bg-rose-600 py-3 text-sm font-bold hover:bg-rose-500"
            >
              모두 지우기
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

/* ── 기억 보기 ────────────────────────────────────────────────────────── */
export function MemoryModal({
  persona,
  facts,
  updating,
  onRefresh,
  onDelete,
  onClose,
}: {
  persona: Persona;
  facts: string[];
  updating: boolean;
  onRefresh: () => void;
  onDelete: (index: number) => void;
  onClose: () => void;
}) {
  return (
    <Shell onClose={onClose} label="기억">
      <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
        <div>
          <p className="text-base font-bold">🧠 {persona.name} 님의 기억</p>
          <p className="text-[11px] text-ink-mute">톡과 보이스톡에서 기억해 둔 것 · 다음 대화에 반영돼요</p>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className="text-lg text-ink-mute">
          ✕
        </button>
      </div>
      <div className="px-5 pb-5">
        {facts.length === 0 ? (
          <p className="rounded-2xl bg-paper px-3.5 py-3 text-xs text-ink-mute">아직 기억한 게 없어요. 대화를 조금 더 나누면 생겨요.</p>
        ) : (
          <ul className="space-y-1.5" data-memory-list>
            {facts.map((f, i) => (
              <li key={`${i}-${f}`} className="flex items-start gap-2 rounded-xl bg-paper px-3 py-2 text-[13px]">
                <span className="flex-1 text-ink-soft">{f}</span>
                <button
                  type="button"
                  onClick={() => onDelete(i)}
                  aria-label="이 기억 지우기"
                  className="shrink-0 text-xs text-ink-mute/80 hover:text-brand-600"
                >
                  지우기
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onRefresh}
          disabled={updating}
          className="mt-3 w-full rounded-2xl bg-ink/5 py-2.5 text-xs font-medium hover:bg-ink/10 disabled:opacity-50"
        >
          {updating ? "정리하는 중…" : "지금까지 대화로 기억 정리하기"}
        </button>
      </div>
    </Shell>
  );
}

/* ── 전체 백업 / 복원 ──────────────────────────────────────────────────── */
export function BackupModal({ onClose, onRestored }: { onClose: () => void; onRestored: () => void }) {
  const [includeMedia, setIncludeMedia] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Shell onClose={onClose} label="백업">
      <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
        <div>
          <p className="text-base font-bold">💾 대화 기록 백업</p>
          <p className="text-[11px] text-ink-mute">모든 인물과의 대화·호감도·기억을 내 PC에 파일로 저장해요</p>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className="text-lg text-ink-mute">
          ✕
        </button>
      </div>
      <div className="space-y-3 px-5 pb-5 text-sm">
        <label className="flex items-center gap-2 text-xs text-ink-soft">
          <input type="checkbox" checked={includeMedia} onChange={(e) => setIncludeMedia(e.target.checked)} />
          내가 보낸 사진·영상도 함께 (파일이 커질 수 있어요)
        </label>
        <button
          type="button"
          disabled={busy}
          data-backup-download
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            try {
              const r = await downloadBackup({ includeMedia });
              setMsg(`✅ 대화방 ${r.rooms}개${r.media ? `, 사진·영상 ${r.media}개` : ""}를 저장했어요 (${(r.bytes / 1024 / 1024).toFixed(1)}MB). 다운로드 폴더를 확인하세요.`);
            } catch {
              setMsg("⚠️ 백업 파일을 만들지 못했어요.");
            } finally {
              setBusy(false);
            }
          }}
          className="w-full rounded-2xl bg-brand-500 py-3 text-sm font-bold hover:bg-brand-400 disabled:opacity-60"
        >
          {busy ? "만드는 중…" : "💾 내 PC에 백업하기"}
        </button>

        <div className="border-t border-ink-line pt-3">
          <p className="text-xs text-ink-mute">다른 기기나 예전 백업에서 불러오기</p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            data-backup-input
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                setPending(await readBackup(f));
                setMsg(null);
              } catch (err) {
                setMsg(`⚠️ ${err instanceof Error ? err.message : "파일을 읽지 못했어요."}`);
              }
            }}
          />
          {pending ? (
            <div className="mt-2 space-y-2 rounded-2xl bg-amber-400/10 p-3 ring-1 ring-amber-200">
              <p className="text-xs text-amber-700">
                {new Date(pending.exportedAt).toLocaleString("ko-KR")} 백업이에요. 불러오면 <b>이 기기의 지금 기록이 이 백업으로 바뀌어요.</b>
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPending(null)} className="flex-1 rounded-xl bg-ink/5 py-2 text-xs">
                  취소
                </button>
                <button
                  type="button"
                  disabled={busy}
                  data-backup-restore
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await restoreBackup(pending);
                      onRestored();
                    } catch {
                      setMsg("⚠️ 불러오지 못했어요.");
                      setBusy(false);
                    }
                  }}
                  className="flex-1 rounded-xl bg-amber-400 py-2 text-xs font-bold text-slate-900"
                >
                  불러오기
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-2 w-full rounded-2xl bg-ink/5 py-2.5 text-xs font-medium hover:bg-ink/10"
            >
              📂 백업 파일 불러오기
            </button>
          )}
        </div>
        {msg && <p className="text-xs text-ink-soft" data-backup-msg>{msg}</p>}
        <p className="text-[10px] leading-relaxed text-ink-mute/80">
          대화는 이 브라우저에만 저장돼요. 브라우저 데이터를 지우거나 기기를 바꾸면 사라지니 가끔 백업해 두세요.
        </p>
      </div>
    </Shell>
  );
}
