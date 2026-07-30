import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yılan II — 3310 Edition",
  description: "Nokia 3310 döneminden ilham alan klasik yılan oyunu.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
