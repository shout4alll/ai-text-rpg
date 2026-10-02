import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "우연한 대화",
  description: "지나가다 우연히 만난 사람들과 나누는 AI 대화",
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
