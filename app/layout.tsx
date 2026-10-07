import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "캐릭톡 — 마음이 닿는 대화",
  description: "정해진 인물과 메신저로 교감하는 AI 채팅",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // 노치 영역까지 배경 사용 (safe-area 로 여백 처리)
  themeColor: "#fdf7fa",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" data-theme="blossom" suppressHydrationWarning>
      <head>
        {/* 🎨 저장된 테마를 그리기 전에 적용 (깜빡임 방지) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("ai-rpg.theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
        {/* 프리텐다드 (한글 UI 폰트) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="bg-paper font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
