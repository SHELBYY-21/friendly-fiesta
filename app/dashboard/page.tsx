'use client';

// ============================================================
// หน้า Dashboard หลัก (CE Vault)
// - transactions ล่าสุด + admins (holding) + เรตล่าสุด
// - การ์ดสรุป: กำไรรวม / avg fee / เรตปัจจุบัน / จำนวนธุรกรรม + holding ต่อแอดมิน
// - Realtime: transactions + admins
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import StatsOverview from '@/components/StatsOverview';
import AdminHoldings from '@/components/AdminHoldings';
import TransactionsTable from '@/components/TransactionsTable';
import SummaryToday, { type SummaryTodayProps } from '@/components/SummaryToday';
import PinnedAccounts, { type PinnedAccount } from '@/components/PinnedAccounts';
import RecentSlips, { type RecentSlip } from '@/components/RecentSlips';
import ApiMonitor, { type ApiEndpoint } from '@/components/ApiMonitor';
import AdminConsole from '@/components/admin/AdminConsole';
import ErrorBoundary from '@/components/ErrorBoundary';
import SyncBadge, { type SyncStatus } from '@/components/SyncBadge';
import BotMonitor from '@/components/BotMonitor';
import type { Admin, Transaction } from '@/types/transactions';

const API_ENDPOINTS: ApiEndpoint[] = [
  { id: 'health', name: 'System Health', url: '/api/health', icon: '❤', category: 'core', description: 'Supabase + env check' },
  { id: 'circle', name: 'Circle USDC', url: '/api/circle/health', icon: '⭕', category: 'external', description: 'Circle payment API' },
  { id: 'market', name: 'Market Rate', url: '/api/market-rate', icon: '📈', category: 'external', description: 'Binance TH USDT rate' },
  { id: 'summary', name: 'Summary Today', url: '/api/dashboard/summary-today?accountId=probe', icon: '📊', category: 'dashboard' },
  { id: 'pinned', name: 'Pinned Accounts', url: '/api/dashboard/pinned-accounts?chatId=0', icon: '📌', category: 'dashboard' },
  { id: 'slips', name: 'Recent Slips', url: '/api/dashboard/recent-slips?limit=1', icon: '🧾', category: 'dashboard' },
  { id: 'export', name: 'Export CSV', url: '/api/export', icon: '⬇', category: 'dashboard' },
  { id: 'telegram', name: 'Telegram Webhook', url: 'https://api.telegram.org', icon: '💬', category: 'external', description: 'Telegram Bot API' },
];

const FEE_WARNING_THRESHOLD = 3;

interface RateRow {
  sell_rate: number;
  market_usdt_rate: number;
}

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [rate, setRate] = useState<RateRow | null>(null);
  const [liveMarket, setLiveMarket] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // CE EMPIRE additions
  const [selectedAccountId, setSelectedAccountId] = useState<string>();
  const [selectedSlipId, setSelectedSlipId] = useState<string>();
  const [summaryToday, setSummaryToday] = useState<SummaryTodayProps | null>(null);
  const [pinnedAccounts, setPinnedAccounts] = useState<PinnedAccount[]>([]);
  const [recentSlips, setRecentSlips] = useState<RecentSlip[]>([]);

  // Last-sync timestamps per data section
  const [syncTimes, setSyncTimes] = useState<{
    main: Date | null;
    market: Date | null;
    pinned: Date | null;
    slips: Date | null;
    summary: Date | null;
  }>({ main: null, market: null, pinned: null, slips: null, summary: null });

  const [syncStatuses, setSyncStatuses] = useState<{
    main: SyncStatus;
    market: SyncStatus;
    pinned: SyncStatus;
    slips: SyncStatus;
    summary: SyncStatus;
  }>({ main: 'syncing', market: 'syncing', pinned: 'syncing', slips: 'syncing', summary: 'syncing' });

  async function load() {
    setSyncStatuses((s) => ({ ...s, main: 'syncing' }));
    const [tx, ad, rt] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, admins(name)')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('admins').select('*').order('name', { ascending: true }),
      supabase
        .from('rates')
        .select('sell_rate, market_usdt_rate')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setTransactions((tx.data as Transaction[]) ?? []);
    setAdmins((ad.data as Admin[]) ?? []);
    setRate((rt.data as RateRow) ?? null);
    setLoading(false);
    setSyncTimes((s) => ({ ...s, main: new Date() }));
    setSyncStatuses((s) => ({ ...s, main: tx.error ? 'error' : 'live' }));
  }

  async function loadMarketRate() {
    setSyncStatuses((s) => ({ ...s, market: 'syncing' }));
    try {
      const res = await fetch('/api/market-rate', { cache: 'no-store' });
      const json = await res.json();
      if (json?.marketUsdtRate) setLiveMarket(Number(json.marketUsdtRate));
      setSyncTimes((s) => ({ ...s, market: new Date() }));
      setSyncStatuses((s) => ({ ...s, market: 'live' }));
    } catch {
      setSyncStatuses((s) => ({ ...s, market: 'error' }));
    }
  }

  async function loadPinnedAccounts() {
    setSyncStatuses((s) => ({ ...s, pinned: 'syncing' }));
    try {
      const tx = transactions.find((t) => (t as any).chat_id);
      const chatId = tx ? (tx as any).chat_id : null;
      if (!chatId) {
        setSyncStatuses((s) => ({ ...s, pinned: 'live' }));
        return;
      }
      const res = await fetch(`/api/dashboard/pinned-accounts?chatId=${chatId}`, { cache: 'no-store' });
      const json = await res.json();
      if (!json.error && json.data) {
        setPinnedAccounts(json.data);
      }
      setSyncTimes((s) => ({ ...s, pinned: new Date() }));
      setSyncStatuses((s) => ({ ...s, pinned: json.error ? 'error' : 'live' }));
    } catch {
      setSyncStatuses((s) => ({ ...s, pinned: 'error' }));
    }
  }

  async function loadRecentSlips() {
    setSyncStatuses((s) => ({ ...s, slips: 'syncing' }));
    try {
      const res = await fetch('/api/dashboard/recent-slips?limit=10', { cache: 'no-store' });
      const json = await res.json();
      if (!json.error && json.data) {
        setRecentSlips(json.data);
      }
      setSyncTimes((s) => ({ ...s, slips: new Date() }));
      setSyncStatuses((s) => ({ ...s, slips: json.error ? 'error' : 'live' }));
    } catch {
      setSyncStatuses((s) => ({ ...s, slips: 'error' }));
    }
  }

  async function loadSummaryToday() {
    if (!selectedAccountId) {
      setSummaryToday(null);
      return;
    }
    setSyncStatuses((s) => ({ ...s, summary: 'syncing' }));
    try {
      const res = await fetch(`/api/dashboard/summary-today?accountId=${selectedAccountId}`, { cache: 'no-store' });
      const json = await res.json();
      if (!json.error && json.data) {
        setSummaryToday(json.data);
      }
      setSyncTimes((s) => ({ ...s, summary: new Date() }));
      setSyncStatuses((s) => ({ ...s, summary: json.error ? 'error' : 'live' }));
    } catch {
      setSyncStatuses((s) => ({ ...s, summary: 'error' }));
    }
  }

  useEffect(() => {
    load();
    loadMarketRate();
    loadPinnedAccounts();
    loadRecentSlips();
    const poll = setInterval(loadMarketRate, 30_000); // เรตตลาดสดทุก 30 วิ

    const channel = supabase
      .channel('ce-vault-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        load();
        loadPinnedAccounts();
        loadRecentSlips();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admins' }, () => load())
      .subscribe();
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, []);

  // Load summary when account selected
  useEffect(() => {
    loadSummaryToday();
  }, [selectedAccountId]);

  const stats = useMemo(() => {
    const deposits = transactions.filter((t) => t.type === 'THB_DEPOSIT');
    const totalNetProfitThb = deposits.reduce((s, t) => s + Number(t.net_profit_thb), 0);
    const totalFeeUsdt = deposits.reduce((s, t) => s + Number(t.fee_usdt), 0);
    const withFee = deposits.filter((t) => Number(t.fee_percent));
    const averageFeePercent =
      withFee.length === 0
        ? 0
        : withFee.reduce((s, t) => s + Number(t.fee_percent), 0) / withFee.length;
    return { totalNetProfitThb, totalFeeUsdt, averageFeePercent, txCount: transactions.length };
  }, [transactions]);

  // กำไรแยกห้อง (group by chat_id) — เรียงกำไรมากสุดก่อน
  const rooms = useMemo(() => {
    const map = new Map<string, { name: string; count: number; thb: number; usdt: number; profit: number }>();
    for (const t of transactions) {
      if (t.type !== 'THB_DEPOSIT') continue;
      const cid = (t as any).chat_id;
      const key = String(cid ?? 'legacy');
      const name = (t as any).room_name || (cid ? `ห้อง ${String(cid).slice(-5)}` : 'ไม่ระบุห้อง (เก่า)');
      const cur = map.get(key) ?? { name, count: 0, thb: 0, usdt: 0, profit: 0 };
      cur.count += 1;
      cur.thb += Number(t.thb_amount || 0);
      cur.usdt += Number(t.usdt_amount || 0);
      cur.profit += Number(t.net_profit_thb || 0);
      if (!cur.name && name) cur.name = name;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.profit - a.profit);
  }, [transactions]);

  const nf = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });

  // Export CSV จากข้อมูลที่โหลดแล้ว (client-side — ไม่แตะ secret/endpoint)
  function exportCsv() {
    const cols = ['ledger_ref', 'created_at', 'room_name', 'thb_amount', 'usdt_amount', 'buy_rate', 'sell_rate', 'net_profit_thb', 'receiver_name', 'receiver_bank', 'receiver_last4'];
    const cell = (v: any) => {
      if (v == null) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = transactions
      .filter((t) => t.type === 'THB_DEPOSIT')
      .map((t) => [cell((t as any).admins?.name), ...cols.map((c) => cell((t as any)[c]))].join(','));
    const csv = '﻿' + [['staff', ...cols].join(','), ...rows].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `ce-vault-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="reveal flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-3xl font-bold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-lg shadow-lg shadow-emerald-500/30">
              ⬢
            </span>
            <span className="gradient-text">CE Vault</span>
          </h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Premium AI Fintech Command Center · อัปเดตแบบเรียลไทม์
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-white/5 px-3.5 py-1.5 text-xs font-medium text-[color:var(--text)] backdrop-blur transition hover:bg-white/10"
          >
            ⬇ Export CSV
          </button>
          <SyncBadge lastSync={syncTimes.main} status={syncStatuses.main} />
        </div>
      </header>

      {/* Admin Console — no-code control panel */}
      <div className="mt-6">
        <ErrorBoundary label="Admin Console">
          <AdminConsole />
        </ErrorBoundary>
      </div>

      {/* Summary Today — conditional on account selection */}
      {summaryToday && selectedAccountId && (
        <div className="mt-6">
          <ErrorBoundary label="Summary Today">
            <SummaryToday {...summaryToday} lastSync={syncTimes.summary} syncStatus={syncStatuses.summary} />
          </ErrorBoundary>
        </div>
      )}

      {/* Pinned Accounts selector */}
      <div className="mt-6">
        <ErrorBoundary label="Pinned Accounts">
          <PinnedAccounts
            accounts={pinnedAccounts}
            selectedAccountId={selectedAccountId}
            onSelectAccount={setSelectedAccountId}
            isLoading={loading}
            lastSync={syncTimes.pinned}
            syncStatus={syncStatuses.pinned}
          />
        </ErrorBoundary>
      </div>

      <div className="mt-6">
        <ErrorBoundary label="Stats Overview">
          <StatsOverview
            totalNetProfitThb={stats.totalNetProfitThb}
            totalFeeUsdt={stats.totalFeeUsdt}
            averageFeePercent={stats.averageFeePercent}
            txCount={stats.txCount}
            feeWarningThreshold={FEE_WARNING_THRESHOLD}
            currentSellRate={rate?.sell_rate ?? null}
            currentMarketRate={liveMarket ?? rate?.market_usdt_rate ?? null}
            marketIsLive={liveMarket != null}
            lastSync={syncTimes.market}
            syncStatus={syncStatuses.market}
          />
        </ErrorBoundary>
      </div>

      {/* กำไรแยกห้อง (Top Rooms) */}
      {rooms.length > 0 && (
        <div className="glass reveal mt-6 p-5" style={{ animationDelay: '160ms' }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide text-[color:var(--text)]">
              🏠 กำไรแยกห้อง <span className="text-[color:var(--muted)]">({rooms.length})</span>
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[color:var(--muted)]">เรียงกำไรมากสุด</span>
              <SyncBadge lastSync={syncTimes.main} status={syncStatuses.main} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[440px] text-sm">
              <thead>
                <tr className="text-left text-xs text-[color:var(--muted)]">
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">ห้อง</th>
                  <th className="pb-2 text-right font-medium">รายการ</th>
                  <th className="pb-2 text-right font-medium">THB</th>
                  <th className="pb-2 text-right font-medium">USDT</th>
                  <th className="pb-2 text-right font-medium">กำไร ฿</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r, i) => (
                  <tr key={r.name + i} className="border-t border-[color:var(--border)]">
                    <td className="py-2 text-[color:var(--muted)]">{i + 1}</td>
                    <td className="py-2 font-medium">{r.name}</td>
                    <td className="py-2 text-right tabular-nums">{r.count}</td>
                    <td className="py-2 text-right tabular-nums">{nf.format(r.thb)}</td>
                    <td className="py-2 text-right tabular-nums">{nf.format(r.usdt)}</td>
                    <td className={`py-2 text-right font-semibold tabular-nums ${r.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {r.profit >= 0 ? '+' : ''}{nf.format(r.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ErrorBoundary label="Admin Holdings">
            <AdminHoldings admins={admins} lastSync={syncTimes.main} syncStatus={syncStatuses.main} />
          </ErrorBoundary>
        </div>
        <div className="lg:col-span-2">
          {loading ? (
            <div className="glass reveal p-12 text-center text-[color:var(--muted)]">
              <span className="inline-block animate-pulse">กำลังโหลด…</span>
            </div>
          ) : (
            <ErrorBoundary label="Transactions Table">
              <TransactionsTable
                transactions={transactions}
                feeWarningThreshold={FEE_WARNING_THRESHOLD}
                lastSync={syncTimes.main}
                syncStatus={syncStatuses.main}
              />
            </ErrorBoundary>
          )}
        </div>
      </div>

      {/* Recent Slips */}
      <div className="mt-6">
        <ErrorBoundary label="Recent Slips">
          <RecentSlips
            slips={recentSlips}
            selectedSlipId={selectedSlipId}
            onSelectSlip={setSelectedSlipId}
            isLive={liveMarket != null}
            lastSync={syncTimes.slips}
            syncStatus={syncStatuses.slips}
          />
        </ErrorBoundary>
      </div>

      {/* API Monitor & Control Panel */}
      <div className="mt-6">
        <ErrorBoundary label="API Monitor">
          <ApiMonitor endpoints={API_ENDPOINTS} autoRefreshMs={30_000} />
        </ErrorBoundary>
      </div>

      {/* Bot Monitor — activity, messages, settings, AI insights */}
      <div className="mt-6">
        <ErrorBoundary label="Bot Monitor">
          <BotMonitor />
        </ErrorBoundary>
      </div>
    </main>
  );
}
