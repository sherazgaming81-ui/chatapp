import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChatsApp — Madrasa Group",
  description: "Madrasa dostoun ke liye private chat. Baatein, ab aur qareeb.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0a1311",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ur-Latn" data-theme="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
