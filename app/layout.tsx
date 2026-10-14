import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/v1/theme";
import PWAInit from "@/components/v1/PWAInit";

export const metadata: Metadata = {
  title: "ChatsApp — WhatsApp style messenger",
  description: "Chat karo doston se — WhatsApp jaisa messenger, sirf Google login ke saath",
  manifest: "/manifest.webmanifest",
  icons: {
    // ?v=3 cache-bust: purana "N" favicon browsers me cache ho chuka tha
    icon: "/favicon.png?v=3",
    apple: "/apple-touch-icon.png?v=3",
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "ChatsApp" },
};

export const viewport: Viewport = {
  themeColor: "#0b141a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">
        <ThemeProvider>
          {children}
          <PWAInit />
        </ThemeProvider>
      </body>
    </html>
  );
}
