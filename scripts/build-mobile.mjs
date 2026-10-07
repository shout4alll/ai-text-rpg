/**
 * 📱 앱용 화면 빌드 → out/ → 안드로이드·iOS 프로젝트에 복사
 *
 *   npm run mobile:build            (안드로이드만 복사)
 *   npm run mobile:build -- --ios   (iOS 도 복사, Mac 에서)
 *
 * 앱 안에는 화면만 들어가고, AI 호출은 서버(NEXT_PUBLIC_API_BASE)로 간다.
 * 서버 코드(app/api)·개발 도구(app/voice-lab)는 정적 빌드에 넣을 수 없어서 빌드하는 동안만 잠시 옮겨 둔다.
 * ⚠️ 빌드 중에는 개발 서버(npm run dev)를 꺼 두세요.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const env = { ...process.env };
// .env.mobile 이 있으면 읽는다 (NEXT_PUBLIC_API_BASE=https://...)
const envFile = path.join(root, ".env.mobile");
/** UTF-8 / BOM / UTF-16(윈도우 PowerShell 의 > 로 만든 파일) 모두 읽는다 */
function readText(file) {
  const buf = fs.readFileSync(file);
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.toString("utf16le").replace(/^﻿/, "");
  if (buf[0] === 0xfe && buf[1] === 0xff) return Buffer.from(buf.subarray(2)).swap16().toString("utf16le");
  return buf.toString("utf8").replace(/^﻿/, "");
}
if (fs.existsSync(envFile)) {
  for (const line of readText(envFile).split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#")) env[m[1]] ||= m[2].replace(/^["']|["']$/g, "");
  }
}
if (!env.NEXT_PUBLIC_API_BASE) {
  const found = fs.existsSync(envFile);
  const stray = fs.readdirSync(root).filter((f) => /^\.env\.mobile\./.test(f) && f !== ".env.mobile.example");
  console.error("❌ NEXT_PUBLIC_API_BASE 가 없어요.");
  console.error(`   찾은 곳: ${envFile}`);
  if (!found) {
    console.error("   → .env.mobile 파일이 이 폴더에 없어요.");
    if (stray.length) console.error(`   → 비슷한 이름이 있어요: ${stray.join(", ")} (이름을 .env.mobile 로 바꿔 주세요. 메모장은 .txt 를 붙이기도 해요)`);
  } else {
    console.error("   → 파일은 있는데 NEXT_PUBLIC_API_BASE=https://... 줄이 없거나 값이 비어 있어요.");
  }
  console.error("   만드는 법(PowerShell): Set-Content -Encoding ascii .env.mobile 'NEXT_PUBLIC_API_BASE=https://배포주소'");
  process.exit(1);
}
if (!/^https:\/\//.test(env.NEXT_PUBLIC_API_BASE)) console.warn("⚠️ 서버 주소는 https:// 를 권장해요 (앱은 http 접속을 막을 수 있어요).");

const stash = path.join(root, ".mobile-stash");
const moves = [
  ["app/api", "api"],
  ["app/voice-lab", "voice-lab"],
];
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** 폴더를 옮긴다. 윈도우에서 개발 서버·VS Code 감시가 폴더를 잡고 있으면 이름 변경(rename)이 EPERM 으로 막히므로, 그땐 복사 후 삭제로 넘어간다. */
function stashDir(src, dst) {
  for (let i = 0; i < 3; i++) {
    try {
      fs.renameSync(src, dst);
      return;
    } catch (e) {
      if (!["EPERM", "EBUSY", "EACCES"].includes(e.code)) throw e;
      sleep(300);
    }
  }
  fs.cpSync(src, dst, { recursive: true });
  fs.rmSync(src, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
function removeLeftover(dir) {
  // 폴더 자체는 못 지워도 안의 파일만 없으면 빌드에는 영향이 없다
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

fs.mkdirSync(stash, { recursive: true });
const done = []; // 복원할 [원래 위치, 보관 이름]
let restoreFailed = false;
try {
  for (const [from, name] of moves) {
    const src = path.join(root, from);
    if (!fs.existsSync(src)) continue;
    const dst = path.join(stash, name);
    try {
      stashDir(src, dst);
    } catch (e) {
      // 복사는 됐는데 삭제가 막힌 경우: 안의 파일만이라도 비운다
      if (fs.existsSync(dst)) removeLeftover(src);
      else throw e;
    }
    if (fs.existsSync(src) && fs.readdirSync(src).length) {
      throw new Error(`${from} 폴더를 비우지 못했어요. 개발 서버(npm run dev)와 VS Code 의 해당 폴더 탭을 닫고 다시 실행해 주세요.`);
    }
    done.push([from, name]);
  }
  execSync("npx next build", { stdio: "inherit", env: { ...env, MOBILE_BUILD: "1" } });
} finally {
  for (const [from, name] of done) {
    const dst = path.join(root, from);
    const bak = path.join(stash, name);
    try {
      if (!fs.existsSync(dst)) fs.renameSync(bak, dst);
      else fs.cpSync(bak, dst, { recursive: true, force: true });
    } catch (e) {
      try {
        fs.cpSync(bak, dst, { recursive: true, force: true });
      } catch (e2) {
        restoreFailed = true;
        console.error(`⚠️ ${from} 를 되돌리지 못했어요. 원본은 ${bak} 에 그대로 있어요. 직접 ${from} 로 복사해 주세요. (${e2.code ?? e2.message})`);
      }
    }
  }
  if (!restoreFailed) fs.rmSync(stash, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
if (restoreFailed) process.exit(1);

const ios = process.argv.includes("--ios");
execSync(`npx cap sync ${ios ? "" : "android"}`.trim(), { stdio: "inherit", env });
console.log("\n✅ 앱 화면 준비 완료. 안드로이드: npm run android:open → Android Studio 에서 Build > Build APK(s)");
