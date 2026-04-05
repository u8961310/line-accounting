import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LINE 記帳系統",
  description: "透過 LINE 記帳，自動同步到 Notion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body className="antialiased">{children}</body>
    </html>
  );
}
