'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="th">
      <body style={{ background: '#000', color: '#f5f5f7', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#c9a84c', fontSize: 28, margin: 0 }}>◈</p>
            <h1 style={{ fontSize: 24, fontWeight: 500, margin: '16px 0 8px' }}>Failed to load</h1>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                marginTop: 24,
                height: 44,
                padding: '0 22px',
                borderRadius: 999,
                border: 0,
                background: '#f5f5f7',
                color: '#000',
                fontWeight: 600,
              }}
            >
              Retry
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
