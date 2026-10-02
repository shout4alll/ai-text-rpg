/**
 * 개발용 임시 클립 생성기 (ffmpeg 필요).
 * 정지 이미지를 확대/이동시켜 idle · nod · shake · surprised 클립을 만든다.
 * 실제 서비스용 클립(Veo/Flow 등으로 생성)이 준비되면 같은 파일명으로 덮어쓰면 된다.
 *
 *   npm run gen:clips            # mp4 (기본)
 *   npm run gen:clips -- webm    # webm
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const ext = process.argv[2] === "webm" ? "webm" : "mp4";
const SRC = "public/avatar/portrait.png";
const OUT = "public/avatar/clips";
mkdirSync(OUT, { recursive: true });

// 4:5 세로 크롭(얼굴 중심) 후 확대. 기본 줌 1.06 으로 이동 여유(margin)를 확보한다.
const BASE_Z = 0.06;
const clips = {
  // 4초 심리스 루프: 호흡 줌 + 미세한 상하 흔들림
  idle: { dur: 4, z: `${BASE_Z}+0.012*(1-cos(2*PI*t/4))/2`, dx: "0", dy: "3*sin(2*PI*t/4)" },
  // 끄덕임 2회, 점점 감쇠
  nod: { dur: 1.4, z: `${BASE_Z}`, dx: "0", dy: "22*sin(4*PI*t/1.4)*(1-t/1.4)" },
  // 도리도리 3회, 점점 감쇠
  shake: { dur: 1.4, z: `${BASE_Z}`, dx: "26*sin(6*PI*t/1.4)*(1-t/1.4)", dy: "0" },
  // 놀람: 순간 줌인 후 복귀
  surprised: { dur: 1.2, z: `${BASE_Z}+0.035*sin(PI*t/1.2)`, dx: "0", dy: "-10*sin(PI*t/1.2)" },
};

const codec =
  ext === "webm"
    ? ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-row-mt", "1"]
    : ["-c:v", "libx264", "-crf", "24", "-preset", "medium", "-movflags", "+faststart"];

for (const [name, c] of Object.entries(clips)) {
  const vf = [
    "crop=332:416:304:0",
    "scale=1080:1350:flags=lanczos",
    `scale=w='1080*(1+${c.z})':h=-2:eval=frame`,
    `crop=w=1080:h=1350:x='(iw-1080)/2+${c.dx}':y='(ih-1350)/2+${c.dy}'`,
    "scale=720:900:flags=lanczos",
    "format=yuv420p",
  ].join(",");
  execFileSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-loop", "1", "-framerate", "24", "-t", String(c.dur), "-i", SRC,
     "-vf", vf, "-r", "24", "-an", ...codec, "-pix_fmt", "yuv420p", `${OUT}/${name}.${ext}`],
    { stdio: "inherit" }
  );
  console.log(`wrote ${OUT}/${name}.${ext}`);
}
