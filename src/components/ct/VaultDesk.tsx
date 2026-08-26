'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SummaryToday from '@/components/SummaryToday';
import PinnedAccounts, { type PinnedAccount } from '@/components/PinnedAccounts';
import { useVaultLive } from '@/lib/ct/realtime';
import { TransactionFlowCard, VaultHistoryTable } from '@/components/ct/TransactionFlow';

type TapeRow = {
  id: string;
  ledger: string | null;
  short: string;
  thb: number | null;
  usdt?: number | null;
  dueUsdt: number | null;
  sentUsdt: number | null;
  createdAt: string | null;
  dateStamp: string;
  time: string;
  pending: boolean;
  status: 'WAIT' | 'DONE';
  bank: string | null;
  last4: string | null;
  name?: string | null;
};

type VaultPayload = {
  ok: boolean;
  vault: {
    dateLabel: string;
    clock: string;
    inThb: number;
    inCount: number;
    outUsdt: number;
    outCount: number;
    requiredUsdt?: number;
    pendingUsdt: number;
    coinDelta?: number;
    feeUsdt?: number;
    desk: number | null;
    mkt: number | null;
    tape: TapeRow[];
  };
  rates: { desk: number; mkt: number | null };
  pins: Array<{ bank: string; last4: string; label: string | null }>;
  accounts?: Array<{ bank: string; last4: string; count: number; totalThb: number; totalUsdt: number }>;
  queue: Array<{ short_ref: string }>;
};

function money(n: number, d = 0) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function VaultDesk() {
  const [data, setData] = useState<VaultPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deskDraft, setDeskDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'today' | 'pending'>('today');
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const loadRef = useRef<() => Promise<void>>(async () => {});
  const live = useVaultLive(() => {
    void loadRef.current();
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/vault?mode=${mode}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'vault failed');
      const incoming: TapeRow[] = json.vault?.tape ?? [];
      if (!primed.current) {
        incoming.forEach((r) => seen.current.add(r.id));
        primed.current = true;
      } else {
        const neu = incoming.filter((r) => !seen.current.has(r.id)).map((r) => r.id);
        if (neu.length) {
          neu.forEach((id) => seen.current.add(id));
          setFlash(new Set(neu));
          setTimeout(() => setFlash(new Set()), 1400);
        }
      }
      setData(json);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'offline');
    }
  }, [mode]);
  loadRef.current = load;

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), live ? 30_000 : 8_000);
    return () => clearInterval(t);
  }, [load, live]);

  const saveDesk = async (e: React.FormEvent) => {
    e.preventDefault();
    const sellRate = Number(deskDraft);
    if (!Number.isFinite(sellRate) || sellRate <= 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/rate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sellRate }),
      });
      if (!res.ok) throw new Error('rate failed');
      setDeskDraft('');
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'rate failed');
    } finally {
      setSaving(false);
    }
  };

  const v = data?.vault;
  const tape = (v?.tape ?? []).filter((r) => (mode === 'pending' ? r.pending : true)).map((r) => ({
    ...r,
    dueUsdt: r.dueUsdt ?? r.usdt ?? null,
    sentUsdt: r.sentUsdt ?? null,
    dateStamp: r.dateStamp || '—',
    status: r.status ?? (r.pending ? 'WAIT' : 'DONE'),
  }));
  const due = v?.pendingUsdt ?? 0;
  const required = v?.requiredUsdt ?? due;
  const sent = v?.outUsdt ?? 0;
  const coin = v?.coinDelta ?? sent - required;
  const fee = v?.feeUsdt ?? 0;
  const desk = v?.desk ?? data?.rates.desk ?? 0;
  const mkt = v?.mkt ?? data?.rates.mkt ?? null;
  const pin = data?.pins?.[0];
  const accounts = data?.accounts ?? [];
  const pinCards: PinnedAccount[] = (accounts.length
    ? accounts
    : pin
      ? [{ bank: pin.bank, last4: pin.last4, count: 0, totalThb: 0, totalUsdt: 0 }]
      : []
  ).map((a, i) => ({
    id: `${a.bank}-${a.last4}-${i}`,
    bankAccountId: `${a.bank}-${a.last4}`,
    accountName: a.bank,
    bankName: a.bank,
    last4: a.last4,
    pinnedForDate: v?.dateLabel ?? '',
    transactionCount: a.count,
    totalThb: a.totalThb,
    totalUsdt: a.totalUsdt,
    status: 'active' as const,
  }));

  return (
    <div className="min-h-screen">
      <header className="nav dense-nav">
        <div className="flex min-w-0 items-center gap-3">
          <span className="mark-glow" aria-hidden>◈</span>
          <span className="text-xs tracking-[0.18em]">CT</span>
          <span className={`pill hidden sm:inline-flex ${live ? 'pill-done' : 'pill-wait'}`}>
            {live ? 'live' : 'poll'}
          </span>
          {due > 0 && (
            <span className="font-mono text-sm text-gold">due {money(due, 2)}</span>
          )}
          <span className="hidden text-xs text-faint sm:inline">
            {v ? `${v.dateLabel} ${v.clock}` : '—'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="seg">
            <button type="button" data-on={mode === 'today'} onClick={() => setMode('today')}>วันนี้</button>
            <button type="button" data-on={mode === 'pending'} onClick={() => setMode('pending')}>รอส่ง</button>
          </div>
          <form onSubmit={saveDesk} className="hidden items-center gap-1 md:flex">
            <input value={deskDraft} onChange={(e) => setDeskDraft(e.target.value)} placeholder="rate" inputMode="decimal" aria-label="desk rate" className="field w-20 px-2 text-sm" />
            <button type="submit" disabled={saving} className="keep px-3 text-xs">ตั้งเรท</button>
          </form>
        </div>
      </header>
      <div className="agent-rail" />

      <div className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <SummaryToday
          dateLabel={v ? `${v.dateLabel} ${v.clock}` : undefined}
          daily={{
            transactionCount: v?.inCount ?? 0,
            totalThbReceived: v?.inThb ?? 0,
            totalUsdtSent: sent,
            requiredUsdt: required,
            pendingUsdt: due,
            coinDelta: coin,
            feeUsdt: fee,
            inCount: v?.inCount ?? 0,
            outCount: v?.outCount ?? 0,
            waitCount: tape.filter((r) => r.pending).length,
          }}
          rates={{ sellRate: desk, marketRate: mkt ?? 0 }}
          lastSync={data ? new Date() : null}
          syncStatus={error ? 'error' : live ? 'live' : data ? 'syncing' : 'syncing'}
        />
        <PinnedAccounts accounts={pinCards} lastSync={data ? new Date() : null} syncStatus={error ? 'error' : live ? 'live' : 'syncing'} />
      </div>

      {error && <p className="px-4 py-2 text-sm text-danger">{error}</p>}

      <form onSubmit={saveDesk} className="flex gap-2 border-b border-[var(--line)] px-4 py-3 md:hidden">
        <input value={deskDraft} onChange={(e) => setDeskDraft(e.target.value)} placeholder="36.70" inputMode="decimal" aria-label="desk rate" className="field" />
        <button type="submit" disabled={saving} className="keep px-4 text-xs">ตั้งเรท</button>
      </form>

      <section className="grid gap-3 px-4 py-4 sm:grid-cols-2 xl:grid-cols-3">
        {tape.length === 0 ? (
          <p className="col-span-full py-8 text-center text-muted">วันนี้ยังไม่มีสลิป</p>
        ) : tape.slice(0, 24).map((row) => (
          <TransactionFlowCard key={row.id} row={row} flash={flash.has(row.id)} />
        ))}
      </section>

      <VaultHistoryTable
        rows={tape}
        dateLabel={v?.dateLabel ?? '—'}
        clock={v?.clock ?? '—'}
        flash={flash}
      />
    </div>
  );
}
