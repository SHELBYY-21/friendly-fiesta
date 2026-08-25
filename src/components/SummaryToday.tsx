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
    inCount?: number;
    outCount?: number;
    waitCount?: number;
  };
  rates: {
    sellRate: number;
    marketRate: number;
  };
  lastSync?: Date | null;
  syncStatus?: SyncStatus;
}

function n(v: number, d: number) {
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function SummaryToday({
  dateLabel,
  account,
  daily,
  rates,
  lastSync,
  syncStatus,
}: SummaryTodayProps) {
  const inCount = daily.inCount ?? daily.transactionCount;
  const outCount = daily.outCount ?? 0;
  const wait = daily.waitCount ?? Math.max(0, inCount - outCount);
  const required = daily.requiredUsdt ?? 0;
  const pending = daily.pendingUsdt ?? Math.max(0, required - daily.totalUsdtSent);
  const coin = daily.coinDelta ?? daily.totalUsdtSent - required;
  const fee = daily.feeUsdt ?? 0;
  const avg = inCount > 0 ? daily.totalThbReceived / inCount : 0;
  const spread = rates.sellRate > 0 && rates.marketRate > 0 ? rates.sellRate - rates.marketRate : 0;
  const desk = rates.sellRate > 0 ? rates.sellRate : 0;
  const implied = desk > 0 ? daily.totalThbReceived / desk : 0;

  const rows: Array<{
    k: string;
    qty: string;
    value: number;
    decimals: 0 | 2;
    unit: string;
    note: string;
    tone?: 'gold' | 'cyan' | 'danger' | 'muted';
  }> = [
    { k: 'IN', qty: String(inCount), value: daily.totalThbReceived, decimals: 0, unit: 'THB', note: 'deposit locked' },
    { k: 'OUT', qty: String(outCount), value: daily.totalUsdtSent, decimals: 2, unit: 'USDT', note: 'settled' },
    { k: 'Required', qty: String(inCount), value: required, decimals: 2, unit: 'USDT', note: 'THB ÷ DESK', tone: 'gold' },
    { k: 'Sent', qty: String(outCount), value: daily.totalUsdtSent, decimals: 2, unit: 'USDT', note: 'actual out' },
    { k: 'Pending', qty: String(wait), value: pending, decimals: 2, unit: 'USDT', note: 'required − sent', tone: 'gold' },
    { k: 'Coin +/-', qty: coin >= 0 ? '+' : '−', value: coin, decimals: 2, unit: 'USDT', note: 'sent − required', tone: coin < 0 ? 'danger' : 'cyan' },
    { k: 'Fee', qty: '—', value: fee, decimals: 2, unit: 'USDT', note: fee ? 'ledger' : 'not stored', tone: 'muted' },
    { k: 'Avg ticket', qty: String(inCount), value: avg, decimals: 0, unit: 'THB', note: 'IN ÷ count', tone: 'muted' },
    { k: 'Spread', qty: desk ? n(desk, 2) : '—', value: spread, decimals: 2, unit: 'THB', note: 'DESK − MKT', tone: spread >= 0 ? 'cyan' : 'danger' },
    { k: 'Check', qty: desk ? n(desk, 2) : '—', value: implied, decimals: 2, unit: 'USDT', note: 'IN THB ÷ DESK now', tone: 'muted' },
  ];

  return (
    <div className="glass glass-hover accent-top reveal overflow-x-auto p-5" style={{ animationDelay: '0ms' }}>
      <div className="mb-3 flex items-center justify-between gap-3">
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

      <table className="tape">
        <thead>
          <tr>
            <th>Line</th>
            <th className="num">Qty</th>
            <th className="num">Amount</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k}>
              <td className="uppercase tracking-[0.08em] text-faint">{r.k}</td>
              <td className="num text-muted">{r.qty}</td>
              <td className={`num ${r.tone === 'gold' ? 'text-gold' : r.tone === 'cyan' ? 'text-cyan' : r.tone === 'danger' ? 'text-danger' : ''}`}>
                <CountUp value={r.value} decimals={r.decimals} suffix={` ${r.unit}`} />
              </td>
              <td className="text-faint">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex flex-wrap justify-between gap-2 rounded-lg bg-white/5 px-3 py-2 font-mono text-xs">
        <span>DESK {desk ? n(desk, 2) : '—'}</span>
        <span className="text-cyan">MKT {rates.marketRate > 0 ? n(rates.marketRate, 2) : '—'}</span>
        <span className="text-faint">{wait} wait · {outCount} done</span>
      </div>
    </div>
  );
}
