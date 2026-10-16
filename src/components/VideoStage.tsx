"use client";
// ─────────────────────────────────────────────────────────────
// VideoStage — <video> element POORI APP me ek dafa mount hota hai.
// AsmaPlayer ka video tab open ho → video uske frame me (portal).
// Warna → 1px invisible host me (NOT display:none — taake browser
// playback pause na kare). Element kabhi unmount nahi hota.
// ─────────────────────────────────────────────────────────────
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { attachVideo, useVideoSlot, VIDEO_SRC, VIDEO_POSTER } from "@/lib/videoPlayer";

export default function VideoStage() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const slot = useVideoSlot();
  const attached = useRef(false);

  return (
    <>
      {/* invisible host — video yahin "rehta" hai jab AsmaPlayer ka frame na ho */}
      <div
        ref={setHost}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 h-px w-px overflow-hidden opacity-0"
      />
      {host &&
        createPortal(
          <video
            ref={(el) => {
              if (el && !attached.current) {
                attached.current = true;
                attachVideo(el);
              }
            }}
            src={VIDEO_SRC}
            poster={VIDEO_POSTER}
            preload="none"
            playsInline
            className="h-full w-full bg-black"
          />,
          slot ?? host
        )}
    </>
  );
}
