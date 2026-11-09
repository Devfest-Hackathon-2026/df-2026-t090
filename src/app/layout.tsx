import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HIVE",
  description: "その夢を実現させる仲間を見つけよう。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="h-full antialiased font-sans">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
