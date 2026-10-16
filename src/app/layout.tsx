import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChatsApp",
  description: "Madrasa doston ke liye apni chat — tez, saaf, apni.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#eef0fb",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ur-Latn" suppressHydrationWarning>
      <body>
        <div className="mesh-bg" aria-hidden />
        <div className="relative z-10 h-dvh p-0 md:p-3">
          <div className="mx-auto flex h-full max-w-[1600px] gap-3">{children}</div>
        </div>
      </body>
    </html>
  );
}
