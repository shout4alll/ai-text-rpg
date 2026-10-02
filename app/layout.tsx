import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "메신저형 AI 페르소나 채팅",
  description: "정해진 인물과 메신저로 교감하는 AI 채팅",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // 노치 영역까지 배경 사용 (safe-area 로 여백 처리)
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
