'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * CameraCapture — in-app camera: live preview, capture, switch camera,
 * review with caption, then send.
 */
export default function CameraCapture({
  onClose,
  onSend,
}: {
  onClose: () => void;
  onSend: (file: File, caption: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('environment');
  const [photo, setPhoto] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    let cancelled = false;
    const startCam = async () => {
      stopStream();
      setError('');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        if (!cancelled) setError('Camera nahi khul saka. Permission check karein.');
      }
    };
    if (!photo) startCam();
    return () => { cancelled = true; stopStream(); };
  }, [facing, photo]);

  const capture = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || v.videoWidth === 0) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    if (facing === 'user') { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, 0, 0);
    setPhoto(c.toDataURL('image/jpeg', 0.85));
    stopStream();
  };

  const retake = () => { setPhoto(null); setCaption(''); };

  const send = () => {
    if (!photo || sending) return;
    setSending(true);
    fetch(photo)
      .then((r) => r.blob())
      .then((blob) => {
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onSend(file, caption.trim());
      })
      .finally(() => setSending(false));
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col mv2-fade-anim">
      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <p className="text-white/80 text-[15px] mb-6">{error}</p>
          <button onClick={onClose} className="h-12 px-8 rounded-full bg-[var(--mv2-accent)] text-white font-semibold">Wapas</button>
        </div>
      ) : photo ? (
        <>
          <div className="flex-1 relative overflow-hidden">
            <img src={photo} alt="Captured" className="absolute inset-0 w-full h-full object-contain bg-black" />
          </div>
          <div className="p-4 mv2-safe-bottom bg-black">
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Caption likhein..."
              className="w-full h-12 px-4 rounded-full bg-white/10 text-white placeholder:text-white/50 outline-none text-[15px] mb-3"
            />
            <div className="flex items-center justify-between">
              <button onClick={retake} className="h-12 px-5 rounded-full bg-white/10 text-white text-[15px]">Dobara lein</button>
              <button
                onClick={send}
                disabled={sending}
                className="h-12 px-8 rounded-full bg-[var(--mv2-accent)] text-white font-semibold disabled:opacity-50"
              >
                {sending ? 'Bhej rahe...' : 'Bhejein →'}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 relative overflow-hidden bg-black">
            <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" style={facing === 'user' ? { transform: 'scaleX(-1)' } : undefined} />
            <canvas ref={canvasRef} className="hidden" />
            <button onClick={onClose} aria-label="Band karein" className="absolute top-4 left-4 mv2-safe-top w-11 h-11 rounded-full bg-black/50 text-white flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
            <button
              onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
              aria-label="Camera badlein"
              className="absolute top-4 right-4 mv2-safe-top w-11 h-11 rounded-full bg-black/50 text-white flex items-center justify-center"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2" /><path d="M20 4v4h-4M4 20v-4h4" /></svg>
            </button>
          </div>
          <div className="py-6 mv2-safe-bottom bg-black flex items-center justify-center">
            <button
              onClick={capture}
              aria-label="Photo lein"
              className="w-[76px] h-[76px] rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition-transform"
            >
              <span className="w-14 h-14 rounded-full bg-white" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
