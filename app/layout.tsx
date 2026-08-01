import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SHOT! — Parti Oyunu",
  description: "Arkadaşlarını topla, kartları aç ve gecenin hikâyesini birlikte yaz.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr"><body>{children}</body></html>;
}
