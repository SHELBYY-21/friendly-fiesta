'use client';

import { useEffect, useState } from 'react';

export type SyncStatus = 'live' | 'syncing' | 'stale' | 'error';

interface SyncBadgeProps {
  lastSync?: Date | null;
  status?: SyncStatus;
  staleAfterMs?: number;
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 5) return 'อัปเดตล่าสุด';
  if (diffSec < 60) return `${diffSec} วิ`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} นาที`;
  return `${Math.floor(diffMin / 60)} ชม.`;
}

const LABEL: Record<SyncStatus, string> = {
  live: 'สด',
  syncing: 'กำลังอัปเดตข้อมูล',
  stale: 'ข้อมูลเก่า',
  error: 'เชื่อมไม่ได้',
};

export default function SyncBadge({ lastSync, status, staleAfterMs = 60_000 }: SyncBadgeProps) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceUpdate((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  let effectiveStatus: SyncStatus = status ?? 'live';
  if (!status && lastSync) {
    effectiveStatus = Date.now() - lastSync.getTime() > staleAfterMs ? 'stale' : 'live';
  }
  if (!status && !lastSync) effectiveStatus = 'syncing';

  const tone =
    effectiveStatus === 'error' ? 'text-danger' :
    effectiveStatus === 'stale' ? 'text-gold' :
    effectiveStatus === 'syncing' ? 'text-gold' :
    'text-cyan';

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      <span>{LABEL[effectiveStatus]}</span>
      {lastSync && effectiveStatus !== 'syncing' ? <span className="text-muted font-medium">{formatRelative(lastSync)}</span> : null}
    </span>
  );
}
