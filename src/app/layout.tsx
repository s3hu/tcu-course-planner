import type { Metadata } from "next";
import "./globals.css";
import "./editorial.css";

export const metadata: Metadata = {
  title: "履修ノート | 東京都市大学 メディア情報学部",
  description: "社会メディア学科（2022〜2026年度入学）と情報システム学科（2023〜2026年度入学）の学修要覧・提供データをもとに、単位の内訳・シラバス・前半後半の時間割を確認する非公式履修プランナー。個別の履修許可と卒業可否は判定しません。",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
