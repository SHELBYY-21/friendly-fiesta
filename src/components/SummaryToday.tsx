'use client';

import CountUp from './CountUp';
import SyncBadge, { type SyncStatus } from './SyncBadge';

export interface SummaryTodayProps {
  dateLabel?: string;
  account?: {
    id: string;
    name: string;
    bankName: string;
    last4: string;
  };
  daily: {
    transactionCount: number;
    totalThbReceived: number;
    totalUsdtSent: number;
    requiredUsdt?: number;
    pendingUsdt?: number;
    coinDelta?: number;
    feeUsdt?: number;
  };
  rates: {
    sellRate: number;
    marketRate: number;
  };
  lastSync?: Date | null;
  syncStatus?: SyncStatus;
}

function Row({
  label,
  value,
  suffix,
  gold,
  cyan,
}: {
  label: string;
  value: number;
  suffix: string;
  gold?: boolean;
  cyan?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[color:var(--border)] py-2.5 last:border-b-0">
      <span className="text-xs uppercase tracking-[0.12em] text-[color:var(--muted)]">{label}</span>
      <span className={`font-semibold tabular-nums ${gold ? 'text-gold' : cyan ? 'text-cyan' : 'text-fg'}`}>
        <CountUp value={value} decimals={suffix === 'THB' || suffix === '' ? 0 : 2} suffix={suffix ? ` ${suffix}` : ''} />
      </span>
    </div>
  );
}

export default function SummaryToday({
  dateLabel,
  account,
  daily,
  rates,
  lastSync,
  syncStatus,
}: SummaryTodayProps) {
  const required = daily.requiredUsdt ?? 0;
  const pending = daily.pendingUsdt ?? Math.max(0, required - daily.totalUsdtSent);
  const coin = daily.coinDelta ?? daily.totalUsdtSent - required;

  return (
    <div className="glass glass-hover accent-top reveal p-5" style={{ animationDelay: '0ms' }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-[0.14em]">SUMMARY TODAY</h2>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            {dateLabel ?? 'today'}
            {account ? `  ·  ${account.bankName} ····${account.last4}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="pill pill-live">live</span>
          <SyncBadge lastSync={lastSync} status={syncStatus} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6">
        <Row label="Deposit" value={daily.totalThbReceived} suffix="THB" />
        <Row label="Required" value={required} suffix="USDT" gold />
        <Row label="Sent" value={daily.totalUsdtSent} suffix="USDT" />
        <Row label="Pending" value={pending} suffix="USDT" gold />
        <Row label="Coin +/-" value={coin} suffix="USDT" cyan />
        <Row label="Fee" value={daily.feeUsdt ?? 0} suffix="USDT" />
      </div>

      <div className="mt-4 flex justify-between rounded-lg bg-white/5 px-3 py-2 font-mono text-xs">
        <span>DESK {rates.sellRate > 0 ? rates.sellRate.toFixed(2) : '—'}</span>
        <span className="text-cyan">MKT {rates.marketRate > 0 ? rates.marketRate.toFixed(2) : '—'}</span>
        <span className="text-faint">{daily.transactionCount} tx</span>
      </div>
    </div>
  );
}
