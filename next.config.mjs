/** 📱 앱 빌드(npm run mobile:build)일 때는 정적 파일로 내보낸다 (out/) */
const mobile = process.env.MOBILE_BUILD === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three"],
  // 📦 인물 JSON 은 서버가 실행 중에 폴더에서 직접 읽는다 (lib/personas/server.ts) → 배포 파일에 포함
  experimental: { outputFileTracingIncludes: { "/**": ["./personas/**/*.json"] } },
  ...(mobile
    ? {
        output: "export",
        distDir: "out", // 정적 결과물 폴더 (개발 서버의 .next 와 섞이지 않게)
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
