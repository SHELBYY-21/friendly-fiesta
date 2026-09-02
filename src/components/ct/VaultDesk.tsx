'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SummaryToday from '@/components/SummaryToday';
import PinnedAccounts, { type PinnedAccount } from '@/components/PinnedAccounts';
import { useVaultLive } from '@/lib/ct/realtime';
import { QueueTape } from '@/components/ct/TransactionFlow';
import StaffPlaybook from '@/components/ct/StaffPlaybook';
import DeskApiPanel from '@/components/ct/DeskApiPanel';

type TapeRow = {
  id: string;
  ledger: string | null;
  short: string;
  thb: number | null;
  usdt?: number | null;
  expectedUsdt?: number | null;
  dueUsdt: number | null;
  sentUsdt: number | null;
  createdAt: string | null;
  dateStamp: string;
  time: string;
  pending: boolean;
  status: string;
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
  pins: Array<{ id?: string; bank: string; last4: string; last4s?: string[]; label: string | null }>;
  accounts?: Array<{ id?: string; bank: string; last4: string; count: number; totalThb: number; totalUsdt: number }>;
};

function money(n: number, d = 0) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function VaultDesk() {
  const [data, setData] = useState<VaultPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deskDraft, setDeskDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [settling, setSettling] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [monitor, setMonitor] = useState(false);
  const [catalog, setCatalog] = useState<Array<{ id: string; bankName: string; last4: string; label?: string | null }>>([]);
  const [mode, setMode] = useState<'today' | 'pending'>('pending');
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const loadRef = useRef<() => Promise<void>>(async () => {});
  const live = useVaultLive(() => { void loadRef.current(); });

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

  useEffect(() => {
    fetch('/api/admin/bank-accounts', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setCatalog(Array.isArray(j.data) ? j.data : []))
      .catch(() => setCatalog([]));
  }, []);

  const pinAccount = async (bankAccountId: string) => {
    if (pinning) return;
    setPinning(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboard/pin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bankAccountId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.error || 'pin failed');
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'pin failed');
    } finally {
      setPinning(false);
    }
  };

  const keepSlip = async (row: Pick<TapeRow, 'short' | 'thb'>) => {
    setError(null);
    const thb = Number(row.thb || 0);
    if (thb >= 20_000) {
      const ok = typeof window === 'undefined' || window.confirm(`ยอด ${thb.toLocaleString('en-US')} THB สูง — บังคับเข้าคิว?`);
      if (!ok) throw new Error('ยกเลิก KEEP ยอดสูง');
    }
    const res = await fetch('/api/dashboard/keep', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ short: row.short, force: true, confirmHigh: thb >= 20_000 }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) {
      const msg = String(json.error || 'keep failed');
      setError(msg);
      throw new Error(msg);
    }
    await load();
  };

  const settleQueue = async () => {
    if (settling) return;
    setSettling(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboard/settle', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.error || 'settle failed');
      if (Array.isArray(json.skipped) && json.skipped.length) {
        const parts = json.skipped.map((s: { short: string; reason: string }) => `${s.short} ${s.reason}`);
        setError(`ข้าม ${parts.join(' · ')}`);
      }
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'settle failed');
    } finally {
      setSettling(false);
    }
  };

  const resetCycle = async () => {
    if (resetting) return;
    if (typeof window !== 'undefined' && !window.confirm('เริ่มรอบใหม่? คิวเดิมถูกพักไว้ ไม่ลบ ไม่โอน USDT')) return;
    setResetting(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboard/reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.error || 'reset failed');
      setMode('today');
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'reset failed');
    } finally {
      setResetting(false);
    }
  };

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
    expectedUsdt: r.expectedUsdt ?? r.usdt ?? null,
    dueUsdt: r.dueUsdt ?? r.usdt ?? null,
    sentUsdt: r.sentUsdt ?? null,
    dateStamp: r.dateStamp || '\u2014',
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
    id: a.id ?? `${a.bank}-${a.last4}-${i}`,
    bankAccountId: a.id ?? `${a.bank}-${a.last4}`,
    accountName: a.bank,
    bankName: a.bank,
    last4: a.last4,
    pinnedForDate: v?.dateLabel ?? '',
    transactionCount: a.count,
    totalThb: a.totalThb,
    totalUsdt: a.totalUsdt,
    status: 'active' as const,
  }));
  const waitDue = tape
    .filter((r) => r.status === 'WAIT' || r.status === 'QUEUE' || r.status === 'SENT' || r.status === 'LOCK')
    .reduce((s, r) => s + (r.dueUsdt ?? r.expectedUsdt ?? r.usdt ?? 0), 0);
  const settleDue = Math.max(due, Math.round(waitDue * 100) / 100);

  return (
    <div className="desk-board">
      <header className="nav dense-nav">
        <div className="flex min-w-0 items-center gap-3">
          <span className="mark-glow" aria-hidden>CT</span>
          <span className="ops-title">โต๊ะปฏิบัติการ</span>
          <span className={`pill hidden sm:inline-flex ${live ? 'pill-done' : 'pill-wait'}`}>
            {live ? 'สด' : 'รีเฟรช'}
          </span>
          <span className="flex gap-1">
            {(['today', 'pending'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={'qd-pill' + (mode === m ? ' is-on' : '')}
                onClick={() => setMode(m)}
              >
                {m === 'today' ? 'วันนี้' : 'ค้าง'}
              </button>
            ))}
          </span>
          <button
            type="button"
            className={'qd-pill' + (monitor ? ' is-on' : '')}
            onClick={() => setMonitor((v) => !v)}
          >
            มอนิเตอร์
          </button>
          {settleDue > 0 && (
            <span className="font-mono text-sm text-gold">ต้องโอน {money(settleDue, 2)}</span>
          )}
        </div>
      </header>
      <div className="agent-rail" />
      {error && <div className="noc-alert" role="alert">{error}</div>}
      <StaffPlaybook />
      <DeskApiPanel open={monitor} onClose={() => setMonitor(false)} />
      <div className="scan-ring" aria-hidden><span>{live ? 'scan live' : 'scan poll'}</span></div>
      <div className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <SummaryToday
          dateLabel={v ? `${v.dateLabel} ${v.clock}` : undefined}
          daily={{
            transactionCount: v?.inCount ?? 0,
            totalThbReceived: v?.inThb ?? 0,
            totalUsdtSent: sent,
            requiredUsdt: required,
            pendingUsdt: settleDue,
            coinDelta: coin,
            feeUsdt: fee,
            inCount: v?.inCount ?? 0,
            outCount: v?.outCount ?? 0,
            waitCount: tape.filter((r) => r.pending).length,
            errCount: tape.filter((r) => r.status === 'ERR' || r.status === 'ERROR').length,
          }}
          rates={{ sellRate: desk, marketRate: mkt ?? 0 }}
          lastSync={data ? new Date() : null}
          syncStatus={error ? 'error' : live ? 'live' : data ? 'syncing' : 'syncing'}
        />
        <div className="desk-pin">
          <PinnedAccounts accounts={pinCards} catalog={catalog} onPin={pinAccount} pinning={pinning} lastSync={data ? new Date() : null} syncStatus={error ? 'error' : live ? 'live' : 'syncing'} />
        </div>
      </div>
      {error && <p className="sr-only">{error}</p>}
      <form onSubmit={saveDesk} className="flex gap-2 border-b border-[var(--line)] px-4 py-3">
        <input value={deskDraft} onChange={(e) => setDeskDraft(e.target.value)} placeholder="เรทขาย เช่น 36.70" inputMode="decimal" aria-label="เรทโต๊ะ" className="field" />
        <button type="submit" disabled={saving} className="keep px-4 text-xs">ตั้งเรท</button>
        <button type="button" disabled={resetting} className="keep px-4 text-xs" onClick={() => void resetCycle()}>
          {resetting ? '…' : 'เริ่มรอบใหม่'}
        </button>
      </form>
      <QueueTape
        rows={tape}
        dateLabel={v?.dateLabel ?? '\u2014'}
        clock={v?.clock ?? '\u2014'}
        waiting={tape.filter((r) => r.status === 'WAIT' || r.status === 'QUEUE' || r.status === 'SENT' || r.status === 'LOCK').reduce((s, r) => s + (r.expectedUsdt ?? r.usdt ?? 0), 0)}
        sent={sent}
        due={settleDue}
        flash={flash}
        onSettle={settleQueue}
        settling={settling}
        onKeep={(row) => keepSlip(row)}
      />
    </div>
  );
}
