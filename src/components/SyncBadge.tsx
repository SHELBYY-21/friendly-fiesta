'use client';

import { useEffect, useState } from 'react';

export type SyncStatus = 'live' | 'syncing' | 'stale' | 'error';

interface SyncBadgeProps {
  lastSync?: Date | null;
  status?: SyncStatus;
  /** Max age in ms before showing "stale" (default: 60_000 = 1 min) */
  staleAfterMs?: number;
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 5) return 'เมื่อกี้';
  if (diffSec < 60) return `${diffSec}s ที่แล้ว`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ที่แล้ว`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ที่แล้ว`;
}

const STATUS_CONFIG: Record<SyncStatus, { dot: string; label: string; ring: string; bg: string; text: string }> = {
  live: {
    dot: 'bg-emerald-400 shadow-emerald-400/60 animate-pulse',
    label: 'Live',
    ring: 'ring-emerald-400/25',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-300',
  },
  syncing: {
    dot: 'bg-cyan-400 shadow-cyan-400/60 animate-ping',
    label: 'Syncing…',
    ring: 'ring-cyan-400/25',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-300',
  },
  stale: {
    dot: 'bg-amber-400 shadow-amber-400/60',
    label: 'Stale',
    ring: 'ring-amber-400/25',
    bg: 'bg-amber-500/10',
    text: 'text-amber-300',
  },
  error: {
    dot: 'bg-rose-400 shadow-rose-400/60',
    label: 'Error',
    ring: 'ring-rose-400/25',
    bg: 'bg-rose-500/10',
    text: 'text-rose-300',
  },
};

export default function SyncBadge({ lastSync, status, staleAfterMs = 60_000 }: SyncBadgeProps) {
  const [, forceUpdate] = useState(0);

  // Re-render every 15s so relative time stays fresh
  useEffect(() => {
    const id = setInterval(() => forceUpdate((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  // Derive effective status
  let effectiveStatus: SyncStatus = status ?? 'live';
  if (!status && lastSync) {
    const age = Date.now() - lastSync.getTime();
    if (age > staleAfterMs) effectiveStatus = 'stale';
    else effectiveStatus = 'live';
  }
  if (!status && !lastSync) effectiveStatus = 'syncing';

  const cfg = STATUS_CONFIG[effectiveStatus];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${cfg.bg} ${cfg.ring} ${cfg.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full shadow-sm ${cfg.dot}`} />
      <span>{cfg.label}</span>
      {lastSync && (
        <span className="opacity-70">· {formatRelative(lastSync)}</span>
      )}
    </span>
  );
}
