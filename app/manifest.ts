// PWA manifest — Next.js MetadataRoute.Manifest.
// Server component route: https://chatapp0071.vercel.app/manifest.webmanifest
// No props; app/layout.tsx se automatic link ho jata hai.

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chat",
    short_name: "Chat",
    description: "Chat karo doston se — WhatsApp jaisa messenger",
    start_url: "/",
    display: "standalone",
    background_color: "#0b141a",
    theme_color: "#0b141a",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
