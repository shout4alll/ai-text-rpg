/** 📱 앱 빌드(npm run mobile:build)일 때는 정적 파일로 내보낸다 (out/) */
const mobile = process.env.MOBILE_BUILD === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three"],
  ...(mobile
    ? {
        output: "export",
        distDir: "out", // 정적 결과물 폴더 (개발 서버의 .next 와 섞이지 않게)
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
