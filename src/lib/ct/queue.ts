import { recordIncoming, recordOutgoing } from '../transactions';
import { supabaseAdmin } from '../supabaseAdmin';
import { getRoom } from '../botSessions';
import { opsRates } from './rates';
import { shouldSend } from './format';
import { listLockedToday, patchSlip, type PendingSlip } from './store';
import { dueUsdt } from './state';
import type { Admin } from '@/types/transactions';

export const BATCH_THB = 10_000;

export interface DueSummary {
  count: number;
  thb: number;
  expected: number;
  sent: number;
  due: number;
  usdt: number;
  target: number;
  remain: number;
  ready: boolean;
  refs: string[];
  batchId: string | null;
}

function payeeLast4(mask?: string | null) {
  const d = String(mask ?? '').replace(/\D/g, '');
  return d.length >= 4 ? d.slice(-4) : d || null;
}

export function batchProgress(thb: number, target = BATCH_THB) {
  const t = Math.max(0, Number(thb) || 0);
  return {
    thb: t,
    target,
    remain: Math.max(0, Math.round((target - t) * 100) / 100),
    ready: t + 1e-9 >= target,
  };
}

export function newBatchId(): string {
  return `B-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

export async function dueSummary(chatId: number): Promise<DueSummary> {
  const rows = await listLockedToday(chatId);
  const thb = Math.round(rows.reduce((s, r) => s + (r.thb_in ?? 0), 0) * 100) / 100;
  const expected = Math.round(rows.reduce((s, r) => s + (r.should_send ?? 0), 0) * 100) / 100;
  return {
    count: rows.length,
    expected,
    sent: 0,
    due: dueUsdt(expected, 0) ?? expected,
    usdt: expected,
    refs: rows.map((r) => r.short_ref),
    batchId: null,
    ...batchProgress(thb),
  };
}

export async function commitIncomingLock(
  p: PendingSlip,
  opts: { chatId: number; userId: number; admin: Admin; force: boolean; queued: boolean },
): Promise<PendingSlip> {
  if (p.status === 'LOCKED' || p.status === 'SETTLED') return p;
  if (!opts.force && !p.pin_match) throw new Error('PIN_MISMATCH');
  if (p.thb_in == null || p.thb_in <= 0) throw new Error('NO_AMOUNT');
  const desk = p.desk_rate && p.desk_rate > 0
    ? p.desk_rate
    : (await opsRates(opts.chatId)).desk;
  if (!desk || desk <= 0) throw new Error('NO_DESK_RATE');
  const owed = shouldSend(p.thb_in, desk);
  const room = await getRoom(opts.chatId);
  const last4 = payeeLast4(p.account_masked);
  const r = await recordIncoming({
    adminTelegramId: opts.userId,
    chatId: opts.chatId,
    thb: p.thb_in,
    sellRate: desk,
    marketRate: p.mkt_rate || desk,
    roomName: room.name,
    ledgerRef: p.ledger_ref,
    ocrConfidence: p.ocr_confidence,
    slipImageUrl: p.slip_url,
    slipFingerprint: p.slip_fingerprint,
    bankAccountId: p.bank_account_id,
    receiver: { name: p.name, bank: p.bank, last4 },
  });
  if (r.transactionId && (p.name || p.bank || last4)) {
    await supabaseAdmin.from('transactions').update({
      receiver_name: p.name,
      receiver_bank: p.bank,
      receiver_last4: last4,
    }).eq('id', r.transactionId);
  }
  return patchSlip(p.id, {
    status: 'LOCKED',
    tx_id: r.transactionId,
    should_send: owed,
    desk_rate: desk,
    undo_until: new Date(Date.now() + 30_000).toISOString(),
    pin_match: opts.force ? p.pin_match : true,
    note: opts.queued ? 'QUEUE' : p.note,
  });
}

export async function settleAllDue(chatId: number, userId: number): Promise<DueSummary> {
  const rows = await listLockedToday(chatId);
  const batchId = newBatchId();
  let sent = 0;
  const refs: string[] = [];
  for (const p of rows) {
    if (!p.should_send || p.status !== 'LOCKED') continue;
    try {
      await recordOutgoing({
        adminTelegramId: userId,
        chatId,
        usdt: p.should_send,
        ledgerRef: p.ledger_ref,
        slipImageUrl: p.slip_url,
      });
      await patchSlip(p.id, {
        status: 'SETTLED',
        undo_until: null,
        note: `BATCH:${batchId}`,
      });
      sent += p.should_send;
      refs.push(p.short_ref);
    } catch (e) {
      console.warn('settle row failed', p.short_ref, e);
    }
  }
  const thb = Math.round(rows.reduce((s, r) => s + (r.thb_in ?? 0), 0) * 100) / 100;
  const expected = Math.round(rows.reduce((s, r) => s + (r.should_send ?? 0), 0) * 100) / 100;
  sent = Math.round(sent * 100) / 100;
  return {
    count: refs.length,
    expected,
    sent,
    due: dueUsdt(expected, sent) ?? 0,
    usdt: sent,
    refs,
    batchId,
    ...batchProgress(thb),
    remain: 0,
    ready: false,
  };
}

export function canAutoQueue(gate: string, thb: number | null, desk: number): boolean {
  return (gate === 'IN_READY' || gate === 'IN_READY_REVIEW') && thb != null && thb > 0 && desk > 0;
}
