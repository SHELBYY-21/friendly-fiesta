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
  dailyLimitThb?: number | null;
  status: 'active' | 'depleted' | 'inactive';
}

export interface PinChoice {
  id: string;
  bankName: string;
  last4: string;
  label?: string | null;
}

interface PinnedAccountsProps {
  accounts: PinnedAccount[];
  catalog?: PinChoice[];
  selectedAccountId?: string;
  onSelectAccount?: (id: string) => void;
  onPin?: (accountId: string) => Promise<void> | void;
  pinning?: boolean;
  isLoading?: boolean;
  lastSync?: Date | null;
  syncStatus?: SyncStatus;
}

export default function PinnedAccounts({
  accounts,
  catalog = [],
  selectedAccountId,
  onSelectAccount,
  onPin,
  pinning,
  isLoading,
  lastSync,
  syncStatus,
}: PinnedAccountsProps) {
  const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const pinnedIds = new Set(accounts.map((a) => a.bankAccountId));
  const choices = catalog.filter((c) => /^\d{4}$/.test(c.last4) && !pinnedIds.has(c.id));

  if (accounts.length === 0) {
    return (
      <div className="glass accent-top reveal p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">ยังไม่มีบัญชีรับวันนี้</p>
          <SyncBadge lastSync={lastSync} status={syncStatus} />
        </div>
        {choices.length > 0 && onPin ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {choices.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={pinning || isLoading}
                onClick={() => void onPin(c.id)}
                className="keep px-3 py-2 text-xs"
              >
                ปัก {c.bankName} ····{c.last4}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted">ปักบัญชีรับแล้วสลิปจะเข้าคิวเอง</p>
        )}
      </div>
    );
  }

  return (
    <div className="glass accent-top reveal overflow-hidden">
      <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-3">
        <h2 className="text-sm font-semibold tracking-[0.14em]">วงเงินวันนี้</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">{accounts.length}</span>
          <SyncBadge lastSync={lastSync} status={syncStatus} />
        </div>
      </div>

      <div className="divide-y divide-[color:var(--border)]">
        {accounts.map((acc) => {
          const on = selectedAccountId === acc.bankAccountId;
          const cap = acc.dailyLimitThb;
          const left = cap != null ? Math.max(0, cap - acc.totalThb) : null;
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
                <span className={`pill ${acc.status === 'active' ? 'pill-wait' : 'pill-done'}`}>pin</span>
              </div>
              <p className="mt-1 font-mono text-xs text-muted">
                ใช้ไป {nf.format(acc.totalThb)} THB
                {cap != null ? ` \u00B7 วงเงิน ${nf.format(cap)} \u00B7 เหลือ ${nf.format(left ?? 0)}` : ' \u00B7 วงเงินยังไม่ตั้ง'}
              </p>
            </button>
          );
        })}
      </div>
      {choices.length > 0 && onPin ? (
        <div className="flex flex-wrap gap-2 border-t border-[color:var(--border)] px-5 py-3">
          {choices.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={pinning || isLoading}
              onClick={() => void onPin(c.id)}
              className="keep px-3 py-2 text-xs"
            >
              + {c.bankName} ····{c.last4}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
