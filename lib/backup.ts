"use client";
/**
 * 대화 기록 백업 / 복원 (이 기기 → 내 PC 파일)
 *
 *  - 모든 인물의 대화방(메시지·호감도·기억·삐짐), 멤버십·캐시(테스트), 설정을 JSON 파일 하나로 내려받는다.
 *  - 사진·영상(유저가 올린 것)은 선택하면 파일 안에 함께 넣는다 (용량이 커질 수 있음).
 *  - 복원하면 이 기기의 기록을 백업 파일 내용으로 바꾼다.
 */
import { deleteMediaFor, listAllMedia, putMedia, type UserMediaRecord } from "@/lib/userMedia";

const PREFIX = "ai-rpg.";
/** 백업에 넣지 않는 키 (개발용 비밀번호 등) */
const SKIP = new Set(["ai-rpg.voicePass", "ai-rpg.deviceId"]);

export interface BackupFile {
  app: "charactalk";
  v: 1;
  /** all = 전체 백업, persona = 한 인물과의 대화만 */
  scope?: "all" | "persona";
  personaId?: string;
  personaName?: string;
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

const CHUNK = 768 * 1024; // 3의 배수 (base64 조각 경계 유지)

function bufToBase64(buf: ArrayBuffer): string {
  const u = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(bin);
}

interface FileSaver {
  begin(o: { name: string; mime: string }): Promise<void>;
  append(o: { data: string }): Promise<void>;
  finish(): Promise<{ path: string }>;
  abort(): Promise<void>;
}

/** 앱(안드로이드)이면 '다운로드' 폴더에 직접 저장, 브라우저(PC)면 일반 다운로드 */
async function saveFile(name: string, blob: Blob): Promise<void> {
  const cap = (typeof window !== "undefined" ? (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; registerPlugin?: <T>(n: string) => T } }).Capacitor : undefined);
  if (cap?.isNativePlatform?.() && cap.registerPlugin) {
    const saver = cap.registerPlugin<FileSaver>("FileSaver");
    await saver.begin({ name, mime: "application/json" });
    try {
      for (let off = 0; off < blob.size; off += CHUNK) {
        await saver.append({ data: bufToBase64(await blob.slice(off, off + CHUNK).arrayBuffer()) });
      }
      await saver.finish();
    } catch (e) {
      await saver.abort().catch(() => undefined);
      throw e;
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** 파일명에 쓸 수 없는 글자 제거 */
const safeName = (s: string) => s.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 30);

/**
 * 백업 파일을 만들어 다운로드 폴더에 저장한다.
 *  - personaId 없음: 전체 백업 (모든 대화방·설정)
 *  - personaId 있음: 그 인물과의 대화(기록·호감도·기억)와 사진·영상만
 * @returns 저장한 대화방 수
 */
export async function downloadBackup(opts: { includeMedia: boolean; personaId?: string; personaName?: string }): Promise<{ rooms: number; media: number; bytes: number }> {
  const pid = opts.personaId;
  const storage: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(PREFIX) || SKIP.has(k)) continue;
    if (pid && k !== `${PREFIX}chat.${pid}`) continue;
    const v = localStorage.getItem(k);
    if (v !== null) storage[k] = v;
  }
  const media: BackupFile["media"] = [];
  if (opts.includeMedia) {
    for (const r of await listAllMedia()) {
      if (pid && r.personaId !== pid) continue;
      media.push({ key: r.key, personaId: r.personaId, type: r.type, dataUrl: await blobToDataUrl(r.blob), frames: r.frames, duration: r.duration, at: r.at });
    }
  }
  const file: BackupFile = {
    app: "charactalk",
    v: 1,
    scope: pid ? "persona" : "all",
    ...(pid ? { personaId: pid, personaName: opts.personaName } : {}),
    exportedAt: new Date().toISOString(),
    storage,
    media,
  };
  const blob = new Blob([JSON.stringify(file)], { type: "application/json" });
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  const name = pid ? `WitH-chat-${safeName(opts.personaName || pid)}-${stamp}.json` : `WitH-backup-all-${stamp}.json`;
  await saveFile(name, blob);
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

/** 복원: 전체 백업은 이 기기의 기록을 통째로 바꾸고, 인물별 백업은 그 인물의 대화만 바꾼다 */
export async function restoreBackup(b: BackupFile): Promise<void> {
  const partial = b.scope === "persona" && !!b.personaId;
  const remove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(PREFIX) || SKIP.has(k)) continue;
    if (partial && k !== `${PREFIX}chat.${b.personaId}`) continue;
    remove.push(k);
  }
  for (const k of remove) localStorage.removeItem(k);
  for (const [k, v] of Object.entries(b.storage)) {
    if (!k.startsWith(PREFIX) || SKIP.has(k) || typeof v !== "string") continue;
    if (partial && k !== `${PREFIX}chat.${b.personaId}`) continue;
    localStorage.setItem(k, v);
  }
  if (partial && b.personaId) await deleteMediaFor(b.personaId);
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
