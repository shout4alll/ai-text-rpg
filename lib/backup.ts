"use client";
/**
 * 대화 기록 백업 / 복원 (이 기기 → 내 PC 파일)
 *
 *  - 모든 인물의 대화방(메시지·호감도·기억·삐짐), 멤버십·캐시(테스트), 설정을 JSON 파일 하나로 내려받는다.
 *  - 사진·영상(유저가 올린 것)은 선택하면 파일 안에 함께 넣는다 (용량이 커질 수 있음).
 *  - 복원하면 이 기기의 기록을 백업 파일 내용으로 바꾼다.
 */
import { listAllMedia, putMedia, type UserMediaRecord } from "@/lib/userMedia";

const PREFIX = "ai-rpg.";
/** 백업에 넣지 않는 키 (개발용 비밀번호 등) */
const SKIP = new Set(["ai-rpg.voicePass"]);

export interface BackupFile {
  app: "charactalk";
  v: 1;
  exportedAt: string;
  storage: Record<string, string>;
  media: { key: string; personaId: string; type: "photo" | "video"; dataUrl: string; frames: string[]; duration?: number; at: number }[];
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });

async function dataUrlToBlob(d: string): Promise<Blob> {
  return (await fetch(d)).blob();
}

/** 백업 파일을 만들어 내려받는다. @returns 저장한 대화방 수 */
export async function downloadBackup(opts: { includeMedia: boolean }): Promise<{ rooms: number; media: number; bytes: number }> {
  const storage: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(PREFIX) || SKIP.has(k)) continue;
    const v = localStorage.getItem(k);
    if (v !== null) storage[k] = v;
  }
  const media: BackupFile["media"] = [];
  if (opts.includeMedia) {
    for (const r of await listAllMedia()) {
      media.push({ key: r.key, personaId: r.personaId, type: r.type, dataUrl: await blobToDataUrl(r.blob), frames: r.frames, duration: r.duration, at: r.at });
    }
  }
  const file: BackupFile = { app: "charactalk", v: 1, exportedAt: new Date().toISOString(), storage, media };
  const blob = new Blob([JSON.stringify(file)], { type: "application/json" });
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const name = `charactalk-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  const rooms = Object.keys(storage).filter((k) => k.startsWith("ai-rpg.chat.")).length;
  return { rooms, media: media.length, bytes: blob.size };
}

/** 백업 파일 읽기 (형식 검사) */
export async function readBackup(file: File): Promise<BackupFile> {
  const data = JSON.parse(await file.text()) as Partial<BackupFile>;
  if (!data || data.app !== "charactalk" || data.v !== 1 || typeof data.storage !== "object") {
    throw new Error("WitH 백업 파일이 아니에요.");
  }
  return { ...data, media: Array.isArray(data.media) ? data.media : [] } as BackupFile;
}

/** 복원: 이 기기의 기록을 백업 내용으로 바꾼다 (사진·영상은 백업에 있는 것만 추가) */
export async function restoreBackup(b: BackupFile): Promise<void> {
  const remove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX) && !SKIP.has(k)) remove.push(k);
  }
  for (const k of remove) localStorage.removeItem(k);
  for (const [k, v] of Object.entries(b.storage)) {
    if (k.startsWith(PREFIX) && !SKIP.has(k) && typeof v === "string") localStorage.setItem(k, v);
  }
  for (const m of b.media) {
    const rec: UserMediaRecord = {
      key: m.key,
      personaId: m.personaId,
      type: m.type,
      blob: await dataUrlToBlob(m.dataUrl),
      frames: m.frames ?? [],
      duration: m.duration,
      at: m.at,
    };
    await putMedia(rec);
  }
}
