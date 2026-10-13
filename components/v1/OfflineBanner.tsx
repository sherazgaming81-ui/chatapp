// OfflineBanner — 'use client'
// Slim banner pinned to the top while the app is offline.
// Slide-down animation via keyframes; renders null when online.
//
// Props:
//   online: boolean — true hides the banner
//
// Example:
//   const [online, setOnline] = useState(navigator.onLine);
//   // ... window online/offline listeners
//   <OfflineBanner online={online} />
'use client';

interface OfflineBannerProps {
  online: boolean;
}

export default function OfflineBanner({ online }: OfflineBannerProps) {
  if (online) return null;

  return (
    <>
      <style>{`
        @keyframes offline-slide-down {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .offline-banner-anim { animation: offline-slide-down 0.25s ease-out; }
      `}</style>
      <div
        role="alert"
        className="offline-banner-anim w-full px-4 py-2 text-center text-[13px] font-medium text-[#ffe9c4] bg-[#b45309]/90 border-b border-[#f59e0b]/40"
      >
        <span className="inline-flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#fbbf24] animate-pulse" aria-hidden />
          Internet nahi hai — dobara connect ho raha hai…
        </span>
      </div>
    </>
  );
}
