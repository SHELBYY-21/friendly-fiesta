'use client';

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
}

function StatusIcon({ status }: { status: PinnedAccount['status'] }) {
  switch (status) {
    case 'active':
      return <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />;
    case 'depleted':
      return <span className="h-2 w-2 rounded-full bg-amber-400" />;
    case 'inactive':
      return <span className="h-2 w-2 rounded-full bg-gray-600" />;
  }
}

export default function PinnedAccounts({
  accounts,
  selectedAccountId,
  onSelectAccount,
  isLoading,
}: PinnedAccountsProps) {
  const nf = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });

  if (accounts.length === 0) {
    return (
      <div className="glass accent-top reveal p-5" style={{ animationDelay: '80ms' }}>
        <p className="text-sm text-[color:var(--muted)]">ยังไม่มีบัญชีที่ปักหมุด</p>
      </div>
    );
  }

  return (
    <div className="glass accent-top reveal overflow-hidden" style={{ animationDelay: '80ms' }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <span>📌</span> Pinned Accounts
        </h2>
        <span className="text-xs text-[color:var(--muted)]">{accounts.length}</span>
      </div>

      {/* Account List */}
      <div className="divide-y divide-[color:var(--border)]">
        {accounts.map((acc, idx) => (
          <button
            key={acc.id}
            onClick={() => onSelectAccount?.(acc.bankAccountId)}
            disabled={isLoading}
            className={`w-full px-5 py-3 text-left transition-colors ${
              selectedAccountId === acc.bankAccountId
                ? 'bg-white/8 ring-l-2 ring-[color:var(--brand-1)]'
                : 'row-glow hover:bg-white/5'
            } disabled:opacity-50`}
            style={{ animationDelay: `${160 + idx * 40}ms` }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <StatusIcon status={acc.status} />
                  <span className="font-medium text-white">{acc.accountName}</span>
                  <span className="text-xs text-[color:var(--muted)]">
                    {acc.bankName} •••• {acc.last4}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-[color:var(--muted)]">
                  {acc.transactionCount} tx • {nf.format(acc.totalThb)} ฿ • {nf.format(acc.totalUsdt)} USDT
                </p>
              </div>
              {selectedAccountId === acc.bankAccountId && <span className="ml-2 text-lg">✓</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
