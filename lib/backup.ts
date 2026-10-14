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

const CHUNK = 384 * 1024; // 3의 배수 (base64 조각 경계 유지) — 앱 브리지가 한 번에 받기 편한 크기

function bufToBase64(buf: ArrayBuffer): string {
  const u = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** 앱(안드로이드)의 다운로드 폴더에 있는 백업 파일 */
export interface NativeBackupItem {
  uri: string;
  name: string;
  size: number;
  modified: number;
}

interface FileSaver {
  begin(o: { name: string; mime: string }): Promise<void>;
  append(o: { data: string }): Promise<void>;
  finish(): Promise<{ path: string }>;
  abort(): Promise<void>;
  list(): Promise<{ items: NativeBackupItem[] }>;
  pick(): Promise<{ cancelled?: boolean; uri?: string; name?: string; size?: number }>;
  readBegin(o: { uri: string }): Promise<void>;
  readNext(o: { length?: number }): Promise<{ data: string; done: boolean }>;
  readEnd(): Promise<void>;
}

type CapacitorLike = { isNativePlatform?: () => boolean; isPluginAvailable?: (n: string) => boolean; registerPlugin?: <T>(n: string) => T };
const capacitor = (): CapacitorLike | undefined => (typeof window !== "undefined" ? (window as unknown as { Capacitor?: CapacitorLike }).Capacitor : undefined);
const errText = (e: unknown) => (e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e)).slice(0, 160);

/** 브라우저 다운로드 (PC·웹) */
function browserDownload(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * 앱(안드로이드)이면 '다운로드' 폴더에 직접 저장, 브라우저(PC)면 일반 다운로드.
 * 앱 저장이 실패하면 공유 시트(파일 공유)·브라우저 다운로드로 한 번씩 더 시도하고, 모두 실패하면 이유를 담아 오류를 던진다.
 * @returns 저장 위치 설명
 */
async function saveFile(name: string, blob: Blob): Promise<string> {
  const cap = capacitor();
  if (!(cap?.isNativePlatform?.() && cap.registerPlugin)) {
    browserDownload(name, blob);
    return "다운로드 폴더";
  }
  let nativeErr = "";
  try {
    if (cap.isPluginAvailable && !cap.isPluginAvailable("FileSaver")) throw new Error("앱에 저장 기능(FileSaver)이 없어요 — 앱을 최신 버전으로 다시 설치해 주세요");
    const saver = cap.registerPlugin<FileSaver>("FileSaver");
    await saver.begin({ name, mime: "application/json" });
    try {
      for (let off = 0; off < blob.size; off += CHUNK) {
        await saver.append({ data: bufToBase64(await blob.slice(off, off + CHUNK).arrayBuffer()) });
      }
      const r = await saver.finish();
      return r?.path ? `다운로드 폴더 (${r.path})` : "다운로드 폴더";
    } catch (e) {
      await saver.abort().catch(() => undefined);
      throw e;
    }
  } catch (e) {
    nativeErr = errText(e);
  }
  // 대체 1: 공유 시트 (카카오톡·드라이브 등으로 보내 두면 안전)
  try {
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    const file = new File([blob], name, { type: "application/json" });
    if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
      await nav.share({ files: [file], title: name });
      return "공유로 보냈어요";
    }
  } catch {
    /* 아래로 */
  }
  // 대체 2: 브라우저 다운로드
  try {
    browserDownload(name, blob);
    return "다운로드 (앱 저장은 실패: " + nativeErr + ")";
  } catch {
    throw new Error(nativeErr || "저장하지 못했어요");
  }
}

/** 파일명에 쓸 수 없는 글자 제거 */
export const safeName = (s: string) => s.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 30);

/**
 * 백업 파일을 만들어 다운로드 폴더에 저장한다.
 *  - personaId 없음: 전체 백업 (모든 대화방·설정)
 *  - personaId 있음: 그 인물과의 대화(기록·호감도·기억)와 사진·영상만
 * @returns 저장한 대화방 수
 */
export async function downloadBackup(opts: { includeMedia: boolean; personaId?: string; personaName?: string }): Promise<{ rooms: number; media: number; bytes: number; where: string }> {
  const pid = opts.personaId;
  const storage: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(PREFIX) || SKIP.has(k)) continue;
    if (pid && k !== `${PREFIX}chat.${pid}`) continue;
    const v = localStorage.getItem(k);
    if (v !== null) storage[k] = v;
  }
  // 사진·영상이 많아도 한 덩어리 문자열을 만들지 않게, 조각(Blob 파트)으로 이어 붙인다
  const head = {
    app: "charactalk",
    v: 1,
    scope: pid ? "persona" : "all",
    ...(pid ? { personaId: pid, personaName: opts.personaName } : {}),
    exportedAt: new Date().toISOString(),
    storage,
  };
  const parts: BlobPart[] = [JSON.stringify(head).slice(0, -1) + ',"media":['];
  let mediaCount = 0;
  if (opts.includeMedia) {
    for (const r of await listAllMedia()) {
      if (pid && r.personaId !== pid) continue;
      const item: BackupFile["media"][number] = { key: r.key, personaId: r.personaId, type: r.type, dataUrl: await blobToDataUrl(r.blob), frames: r.frames, duration: r.duration, at: r.at };
      parts.push((mediaCount > 0 ? "," : "") + JSON.stringify(item));
      mediaCount++;
    }
  }
  parts.push("]}");
  const blob = new Blob(parts, { type: "application/json" });
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  const name = pid ? `WitH-chat-${safeName(opts.personaName || pid)}-${stamp}.json` : `WitH-backup-all-${stamp}.json`;
  const where = await saveFile(name, blob);
  const rooms = Object.keys(storage).filter((k) => k.startsWith("ai-rpg.chat.")).length;
  return { rooms, media: mediaCount, bytes: blob.size, where };
}

/** 앱(안드로이드)에서 다운로드 폴더 저장·불러오기를 쓸 수 있는지 */
export function nativeBackupAvailable(): boolean {
  const cap = capacitor();
  return !!(cap?.isNativePlatform?.() && cap.registerPlugin && (!cap.isPluginAvailable || cap.isPluginAvailable("FileSaver")));
}
const nativeSaver = () => capacitor()!.registerPlugin!<FileSaver>("FileSaver");

/** 다운로드 폴더의 WitH 백업 파일 목록 (이 앱이 만든 파일, 최신순) */
export async function listNativeBackups(): Promise<NativeBackupItem[]> {
  if (!nativeBackupAvailable()) return [];
  const r = await nativeSaver().list();
  return Array.isArray(r?.items) ? r.items : [];
}

/** 시스템 파일 선택창을 '다운로드' 폴더에서 열어 파일을 고른다 (취소하면 null) */
export async function pickNativeBackup(): Promise<NativeBackupItem | null> {
  const r = await nativeSaver().pick();
  if (!r || r.cancelled || !r.uri) return null;
  return { uri: r.uri, name: r.name ?? "backup.json", size: r.size ?? 0, modified: Date.now() };
}

/** 앱에서 파일을 조각으로 읽어 백업으로 해석 */
export async function readNativeBackup(uri: string): Promise<BackupFile> {
  const saver = nativeSaver();
  await saver.readBegin({ uri });
  const parts: BlobPart[] = [];
  try {
    for (;;) {
      const r = await saver.readNext({ length: CHUNK });
      if (r.data) {
        const bin = atob(r.data);
        const u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        parts.push(u);
      }
      if (r.done) break;
    }
  } finally {
    await saver.readEnd().catch(() => undefined);
  }
  return parseBackup(await new Blob(parts).text());
}

function parseBackup(text: string): BackupFile {
  const data = JSON.parse(text) as Partial<BackupFile>;
  if (!data || data.app !== "charactalk" || data.v !== 1 || typeof data.storage !== "object") {
    throw new Error("WitH 백업 파일이 아니에요.");
  }
  return { ...data, media: Array.isArray(data.media) ? data.media : [] } as BackupFile;
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
