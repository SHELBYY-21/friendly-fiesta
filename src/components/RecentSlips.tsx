'use client';

import SyncBadge, { type SyncStatus } from './SyncBadge';

export interface RecentSlip {
  id: string;
  transactionId: string;
  slipImageUrl: string;
  slipFingerprint: string;
  ocrConfidence: number;
  extractedData: {
    amount: number;
    bank: string;
    receiver: string;
    last4: string;
    transferDate: string;
  };
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verificationTime?: string;
  createdAt: string;
}

interface RecentSlipsProps {
  slips: RecentSlip[];
  selectedSlipId?: string;
  onSelectSlip?: (id: string) => void;
  isLive?: boolean;
  lastSync?: Date | null;
  syncStatus?: SyncStatus;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color = confidence > 80 ? 'text-emerald-400' : confidence > 60 ? 'text-amber-400' : 'text-rose-400';
  return <span className={`text-xs font-semibold tabular-nums ${color}`}>{Math.round(confidence)}%</span>;
}

function StatusBadge({ status }: { status: RecentSlip['verificationStatus'] }) {
  switch (status) {
    case 'verified':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/25">
          ✓ Verified
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-400/25">
          ⏳ Pending
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-300 ring-1 ring-rose-400/25">
          ✗ Rejected
        </span>
      );
  }
}

export default function RecentSlips({ slips, selectedSlipId, onSelectSlip, isLive, lastSync, syncStatus }: RecentSlipsProps) {
  const nf = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });

  if (slips.length === 0) {
    return (
      <div className="glass accent-top reveal p-5" style={{ animationDelay: '240ms' }}>
        <div className="flex items-center justify-between">
          <p className="text-sm text-[color:var(--muted)]">ยังไม่มีสลิปล่าสุด</p>
          <SyncBadge lastSync={lastSync} status={syncStatus} />
        </div>
      </div>
    );
  }

  return (
    <div className="glass accent-top reveal overflow-hidden" style={{ animationDelay: '240ms' }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <span>🧾</span> Recent Slips
        </h2>
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--good)]">
              <span className="live-dot" /> Live
            </span>
          )}
          <SyncBadge lastSync={lastSync} status={syncStatus} />
        </div>
      </div>

      {/* Slip Grid */}
      <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {slips.map((slip, idx) => (
          <button
            key={slip.id}
            onClick={() => onSelectSlip?.(slip.id)}
            className={`group relative overflow-hidden rounded-lg transition-all ${
              selectedSlipId === slip.id ? 'ring-2 ring-[color:var(--brand-1)]' : 'hover:ring-1 hover:ring-[color:var(--border-strong)]'
            }`}
            style={{ animationDelay: `${280 + idx * 60}ms` }}
          >
            {/* Thumbnail */}
            <div className="relative h-40 overflow-hidden bg-[color:var(--surface)]">
              <img
                src={slip.slipImageUrl}
                alt={`Slip ${slip.extractedData.amount}`}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
              {/* Confidence Overlay */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 backdrop-blur">
                <span className="text-xs text-[color:var(--muted)]">OCR</span>
                <ConfidenceBadge confidence={slip.ocrConfidence} />
              </div>
            </div>

            {/* Info */}
            <div className="border-t border-[color:var(--border)] bg-[color:var(--surface)] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-white tabular-nums">{nf.format(slip.extractedData.amount)} ฿</p>
                  <p className="text-xs text-[color:var(--muted)]">{slip.extractedData.bank}</p>
                </div>
                <StatusBadge status={slip.verificationStatus} />
              </div>
              <p className="mt-2 text-xs text-[color:var(--muted)]">
                {slip.extractedData.receiver} •••• {slip.extractedData.last4}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
