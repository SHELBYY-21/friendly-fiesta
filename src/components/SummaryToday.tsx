'use client';

import CountUp from './CountUp';
import SyncBadge, { type SyncStatus } from './SyncBadge';

export interface SummaryTodayProps {
  account: {
    id: string;
    name: string;
    bankName: string;
    last4: string;
  };
  daily: {
    transactionCount: number;
    totalThbReceived: number;
    totalUsdtSent: number;
  };
  rates: {
    sellRate: number;
    marketRate: number;
  };
  lastSync?: Date | null;
  syncStatus?: SyncStatus;
}

function StatField({
  label,
  value,
  suffix,
  color,
}: {
  label: string;
  value: number;
  suffix: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[color:var(--border)] py-3 last:border-b-0">
      <span className="text-sm text-[color:var(--muted)]">{label}</span>
      <span className={`font-semibold tabular-nums ${color}`}>
        <CountUp value={value} decimals={2} suffix={` ${suffix}`} />
      </span>
    </div>
  );
}

export default function SummaryToday({ account, daily, rates, lastSync, syncStatus }: SummaryTodayProps) {
  const nf = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });

  return (
    <div className="glass glass-hover accent-top reveal p-5 shadow-lg shadow-emerald-500/10" style={{ animationDelay: '0ms' }}>
      {/* Header: Account Info */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">📊 สรุปวันนี้</h2>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            {account.name} • {account.bankName} •••• {account.last4}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <p className="text-xs font-medium text-[color:var(--good)]">🟢 Active</p>
          <SyncBadge lastSync={lastSync} status={syncStatus} />
        </div>
      </div>

      {/* Divider */}
      <div className="my-3 h-px bg-gradient-to-r from-[color:var(--brand-1)] to-transparent opacity-50" />

      {/* Stats Fields */}
      <div className="space-y-0">
        <StatField
          label="รายการวันนี้"
          value={daily.transactionCount}
          suffix="รายการ"
          color="text-[color:var(--text)]"
        />
        <StatField label="รับ THB รวม" value={daily.totalThbReceived} suffix="฿" color="text-emerald-400" />
        <StatField label="ส่ง USDT รวม" value={daily.totalUsdtSent} suffix="USDT" color="text-cyan-400" />
      </div>

      {/* Rates Info */}
      <div className="mt-4 rounded-lg bg-white/5 px-3 py-2">
        <p className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">อัตราคำนวณ</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm text-[color:var(--text)]">Sell: {nf.format(rates.sellRate)}</span>
          <span className="text-sm text-[color:var(--text)]">Market: {nf.format(rates.marketRate)}</span>
        </div>
      </div>
    </div>
  );
}
