'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ margin: 0, background: '#0b141a', color: '#fff', fontFamily: 'sans-serif' }}>
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Kuch ghalat ho gaya</h1>
          <p style={{ color: '#8696a0', fontSize: 14, marginBottom: 24 }}>App load nahi ho saki. Dobara try karein.</p>
          <button
            onClick={() => reset()}
            style={{ background: '#00a884', color: '#0b141a', fontWeight: 600, borderRadius: 999, padding: '10px 24px', border: 'none', cursor: 'pointer' }}
          >
            Dobara try karein
          </button>
        </div>
      </body>
    </html>
  );
}
