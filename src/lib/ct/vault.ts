import { supabaseAdmin } from '../supabaseAdmin';
import { opsRates } from './rates';
import { bannerDate, clockBkk, shortOf, ymdBkk } from './format';
import { vaultBanner, cardRecent, type VaultRow } from './copy';
import type { OutgoingMessage } from '../telegram';

function midnightIso(): string {
  const now = new Date();
  const bkk = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  bkk.setHours(0, 0, 0, 0);
  const offset = now.getTime() - new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })).getTime();
  return new Date(bkk.getTime() + offset).toISOString();
}

export async function loadVault(chatId?: number | null, mode: 'today' | 'pending' | 'all' = 'today') {
  const cut = midnightIso();
  let insQ = supabaseAdmin
      .from('transactions')
      .select('id, ledger_ref, created_at, thb_amount, usdt_amount, sell_rate, status, chat_id, receiver_name, receiver_bank, receiver_last4')
      .eq('type', 'THB_DEPOSIT')
      .gte('created_at', cut)
      .order('created_at', { ascending: false });
  let outsQ = supabaseAdmin
      .from('transactions')
      .select('ledger_ref, created_at, usdt_amount')
      .eq('type', 'USDT_SEND')
      .gte('created_at', cut)
      .order('created_at', { ascending: false });
  if (chatId != null) {
    insQ = insQ.eq('chat_id', chatId);
    outsQ = outsQ.eq('chat_id', chatId);
  }
  const [{ data: ins }, { data: outs }, rates] = await Promise.all([
    insQ,
    outsQ,
    opsRates(chatId ?? 0),
  ]);

  const outByRef = new Map<string, { usdt: number; at: string }>();
  for (const o of outs ?? []) {
    const k = String(o.ledger_ref || '');
    if (!k || outByRef.has(k)) continue;
    outByRef.set(k, { usdt: Number(o.usdt_amount), at: o.created_at });
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false });

  const inRows: VaultRow[] = [];
  let inThb = 0;
  let owed = 0;
  let feeUsdt = 0;
  for (const r of ins ?? []) {
    const thb = Number(r.thb_amount);
    const should = Number(r.usdt_amount);
    const settled = outByRef.has(String(r.ledger_ref || ''));
    inThb += thb;
    owed += should;
    feeUsdt += Number((r as any).fee_usdt || 0);
    inRows.push({
      thb,
      usdt: should,
      time: fmt(r.created_at),
      short: shortOf(String(r.ledger_ref || '----')),
      pending: !settled,
    });
  }

  const outRows: VaultRow[] = (outs ?? []).map((o) => ({
    usdt: Number(o.usdt_amount),
    time: fmt(o.created_at),
    short: shortOf(String(o.ledger_ref || '----')),
    pending: false,
  }));
  const outUsdt = outRows.reduce((s, r) => s + (r.usdt ?? 0), 0);
  const requiredUsdt = Math.round(owed * 100) / 100;
  const pendingUsdt = Math.max(0, Math.round((owed - outUsdt) * 100) / 100);
  const coinDelta = Math.round((outUsdt - owed) * 100) / 100;
  const pendingShorts = inRows.filter((r) => r.pending).map((r) => r.short);

  const viewRows = mode === 'pending' ? inRows.filter((r) => r.pending) : inRows;

  return {
    mode,
    dateLabel: bannerDate(),
    clock: clockBkk(),
    inThb,
    inCount: inRows.length,
    inRows: viewRows,
    outUsdt,
    outCount: outRows.length,
    outRows,
    requiredUsdt,
    pendingUsdt,
    coinDelta,
    feeUsdt: Math.round(feeUsdt * 100) / 100,
    desk: rates.desk || null,
    mkt: rates.mkt,
    pendingShorts,
    ymd: ymdBkk(),
    tape: (ins ?? []).map((r) => {
      const settled = outByRef.has(String(r.ledger_ref || ''));
      return {
        id: r.id,
        ledger: r.ledger_ref,
        short: shortOf(String(r.ledger_ref || '----')),
        thb: Number(r.thb_amount),
        usdt: Number(r.usdt_amount),
        time: fmt(r.created_at),
        pending: !settled,
        bank: r.receiver_bank ?? null,
        name: r.receiver_name ?? null,
        last4: r.receiver_last4 ?? null,
      };
    }),
  };
}

export async function renderVault(chatId: number, mode: 'today' | 'pending' | 'all' = 'today'): Promise<OutgoingMessage> {
  const data = await loadVault(chatId, mode);
  return vaultBanner(data);
}

export async function renderRecent(chatId: number, adminLabel: string): Promise<OutgoingMessage> {
  const data = await loadVault(chatId, 'today');
  return cardRecent({
    adminLabel,
    rows: data.inRows.slice(0, 5).map((r) => ({
      thb: r.thb ?? 0,
      usdt: r.usdt ?? 0,
      desk: data.desk ?? 0,
      time: r.time,
      short: r.short,
      pending: r.pending,
    })),
    inThb: data.inThb,
    outUsdt: data.outUsdt,
    pendingUsdt: data.pendingUsdt,
  });
}
