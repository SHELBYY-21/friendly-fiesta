'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="max-w-sm text-center">
        <p className="text-3xl text-gold">◈</p>
        <h1 className="mt-4 text-2xl font-medium">Failed to load</h1>
        <p className="mt-2 text-sm text-muted">{error.message || 'retry'}</p>
        <button type="button" className="keep mt-8" onClick={() => reset()}>
          Retry
        </button>
      </div>
    </main>
  );
}
