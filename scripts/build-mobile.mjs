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
fs.mkdirSync(stash, { recursive: true });
const moved = [];
try {
  for (const [from, name] of moves) {
    const src = path.join(root, from);
    if (fs.existsSync(src)) {
      fs.renameSync(src, path.join(stash, name));
      moved.push([from, name]);
    }
  }
  execSync("npx next build", { stdio: "inherit", env: { ...env, MOBILE_BUILD: "1" } });
} finally {
  for (const [from, name] of moved) fs.renameSync(path.join(stash, name), path.join(root, from));
  fs.rmSync(stash, { recursive: true, force: true });
}

const ios = process.argv.includes("--ios");
execSync(`npx cap sync ${ios ? "" : "android"}`.trim(), { stdio: "inherit", env });
console.log("\n✅ 앱 화면 준비 완료. 안드로이드: npm run android:open → Android Studio 에서 Build > Build APK(s)");
