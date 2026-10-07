"use client";
/**
 * 유저가 올린 사진·영상 보관함 (이 기기의 IndexedDB).
 *
 *  - 대화 기록(localStorage)에는 키만 저장하고, 파일 자체는 IndexedDB 에 둔다 (용량 큼).
 *  - "처음부터"(대화 초기화)를 누르기 전까지 유지된다. 초기화하면 그 인물 대화방의 파일을 모두 지운다.
 *  - AI 에게는 작게 줄인 JPEG 장면만 보낸다 (사진 1장 / 영상은 장면 N개). 원본은 서버로 가지 않는다.
 *  수치: config/balance.json 의 userMedia
 */
import { BALANCE } from "@/config/balance";

const DB = "ai-rpg-media";
const STORE = "files";

export interface UserMediaRecord {
  key: string;
  personaId: string;
  type: "photo" | "video";
  blob: Blob;
  /** AI 에게 보낼 장면 (JPEG data URL) */
  frames: string[];
  duration?: number;
  at: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "key" });
        s.createIndex("personaId", "personaId");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(r ? (r.result as T) : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function putMedia(rec: UserMediaRecord): Promise<void> {
  await tx("readwrite", (s) => {
    s.put(rec);
  });
}

export async function getMedia(key: string): Promise<UserMediaRecord | undefined> {
  try {
    return await tx<UserMediaRecord>("readonly", (s) => s.get(key));
  } catch {
    return undefined;
  }
}

/** 백업용: 보관된 파일 전부 */
export async function listAllMedia(): Promise<UserMediaRecord[]> {
  try {
    return (await tx<UserMediaRecord[]>("readonly", (s) => s.getAll())) ?? [];
  } catch {
    return [];
  }
}

/** 대화방 초기화 시: 그 인물의 파일을 모두 지운다 */
export async function deleteMediaFor(personaId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(STORE, "readwrite");
      const idx = t.objectStore(STORE).index("personaId");
      const cur = idx.openCursor(IDBKeyRange.only(personaId));
      cur.onsuccess = () => {
        const c = cur.result;
        if (c) {
          c.delete();
          c.continue();
        }
      };
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  } catch {
    /* 저장소 없음 */
  }
  for (const [k, u] of urlCache) {
    if (k.startsWith(`${personaId}:`)) {
      URL.revokeObjectURL(u);
      urlCache.delete(k);
    }
  }
}

/** 화면 표시용 주소 (같은 파일은 한 번만 만든다) */
const urlCache = new Map<string, string>();
export async function mediaUrl(key: string): Promise<string | null> {
  const hit = urlCache.get(key);
  if (hit) return hit;
  const rec = await getMedia(key);
  if (!rec) return null;
  const u = URL.createObjectURL(rec.blob);
  urlCache.set(key, u);
  return u;
}

/* ── 파일 처리 ────────────────────────────────────────────────────────── */

function drawScaled(src: CanvasImageSource, w: number, h: number, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  c.getContext("2d")?.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

const toBlob = (c: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지 변환 실패"))), "image/jpeg", q));

export class UserMediaError extends Error {}

/** 하루 업로드 수 제한 (기기 기준) */
function bumpDaily(): boolean {
  const max = BALANCE.userMedia.maxPerDay;
  if (max <= 0) return true;
  try {
    const day = new Date().toDateString();
    const raw = JSON.parse(localStorage.getItem("ai-rpg.mediaDaily") ?? "{}") as { day?: string; n?: number };
    const n = raw.day === day ? raw.n ?? 0 : 0;
    if (n >= max) return false;
    localStorage.setItem("ai-rpg.mediaDaily", JSON.stringify({ day, n: n + 1 }));
  } catch {
    /* 저장 불가 → 제한 없이 */
  }
  return true;
}

/**
 * 고른 파일을 보관함에 넣고, AI 에게 보낼 장면을 만든다.
 * @throws UserMediaError 사용자에게 보여 줄 오류
 */
export async function importFile(file: File, personaId: string): Promise<UserMediaRecord> {
  const U = BALANCE.userMedia;
  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");
  if (!isVideo && !isImage) throw new UserMediaError("사진이나 영상 파일만 보낼 수 있어요.");
  if (isVideo && file.size > U.maxVideoMB * 1024 * 1024) throw new UserMediaError(`영상은 ${U.maxVideoMB}MB 이하만 보낼 수 있어요.`);
  if (!bumpDaily()) throw new UserMediaError(`사진·영상은 하루 ${U.maxPerDay}개까지 보낼 수 있어요.`);

  const key = `${personaId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

  if (isImage) {
    const bmp = await createImageBitmap(file).catch(() => {
      throw new UserMediaError("사진을 열 수 없어요. 다른 사진으로 해 주세요.");
    });
    const big = drawScaled(bmp, bmp.width, bmp.height, U.maxImageSide);
    const small = drawScaled(bmp, bmp.width, bmp.height, U.modelImageSide);
    bmp.close?.();
    const blob = await toBlob(big, 0.86);
    const rec: UserMediaRecord = { key, personaId, type: "photo", blob, frames: [small.toDataURL("image/jpeg", 0.8)], at: Date.now() };
    await putMedia(rec);
    return rec;
  }

  // 영상: 원본은 보관, AI 에게는 장면 몇 개만
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = url;
    await new Promise<void>((resolve, reject) => {
      v.onloadeddata = () => resolve();
      v.onerror = () => reject(new UserMediaError("이 영상은 이 기기에서 열 수 없어요. (mp4 권장)"));
      setTimeout(() => reject(new UserMediaError("영상을 여는 데 너무 오래 걸려요.")), 15000);
    });
    const dur = Number.isFinite(v.duration) ? v.duration : 0;
    const n = Math.max(1, U.videoFrames);
    const frames: string[] = [];
    for (let i = 0; i < n; i++) {
      const t = dur > 0 ? (dur * (i + 0.5)) / n : 0;
      v.currentTime = Math.min(Math.max(0, t), Math.max(0, dur - 0.05));
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        v.onseeked = done;
        setTimeout(done, 3000);
      });
      frames.push(drawScaled(v, v.videoWidth, v.videoHeight, U.modelImageSide).toDataURL("image/jpeg", 0.78));
    }
    const rec: UserMediaRecord = { key, personaId, type: "video", blob: file, frames, duration: Math.round(dur), at: Date.now() };
    await putMedia(rec);
    return rec;
  } finally {
    URL.revokeObjectURL(url);
  }
}
