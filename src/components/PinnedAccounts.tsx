'use client';

import SyncBadge, { type SyncStatus } from './SyncBadge';

export interface PinnedAccount {
  id: string;
  bankAccountId: string;
  accountName: string;
  bankName: string;
  last4: string;
  pinnedForDate: string;
  transactionCount: number;
  totalThb: number;
  totalUsdt: number;
  status: 'active' | 'depleted' | 'inactive';
}

interface PinnedAccountsProps {
  accounts: PinnedAccount[];
  selectedAccountId?: string;
  onSelectAccount?: (id: string) => void;
  isLoading?: boolean;
  lastSync?: Date | null;
  syncStatus?: SyncStatus;
}

export default function PinnedAccounts({
  accounts,
  selectedAccountId,
  onSelectAccount,
  isLoading,
  lastSync,
  syncStatus,
}: PinnedAccountsProps) {
  const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const uf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (accounts.length === 0) {
    return (
      <div className="glass accent-top reveal p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">ยังไม่มีบัญชีรับวันนี้</p>
          <SyncBadge lastSync={lastSync} status={syncStatus} />
        </div>
      </div>
    );
  }

  return (
    <div className="glass accent-top reveal overflow-hidden">
      <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-3">
        <h2 className="text-sm font-semibold tracking-[0.14em]">บัญชีรับ</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">{accounts.length}</span>
          <SyncBadge lastSync={lastSync} status={syncStatus} />
        </div>
      </div>

      <div className="divide-y divide-[color:var(--border)]">
        {accounts.map((acc) => {
          const on = selectedAccountId === acc.bankAccountId;
          return (
            <button
              key={acc.id}
              type="button"
              onClick={() => onSelectAccount?.(acc.bankAccountId)}
              disabled={isLoading}
              className={`w-full px-5 py-3 text-left disabled:opacity-50 ${on ? 'bg-[color:var(--bg-subtle)]' : 'hover:bg-[color:var(--bg-subtle)]'}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-sm">
                  {acc.bankName} <span className="font-mono text-gold">····{acc.last4}</span>
                </p>
                <span className={`pill ${acc.status === 'active' ? 'pill-wait' : 'pill-done'}`}>
                  {acc.status === 'active' ? 'pin' : acc.status}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-muted">
                {acc.transactionCount}  {nf.format(acc.totalThb)} THB  {uf.format(acc.totalUsdt)} USDT
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
