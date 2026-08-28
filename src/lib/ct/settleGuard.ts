import { matchPinnedBank, type PinnedBank } from '../banks';
import { normalizeBankCode } from '../botSecurity';
import { MAX_SLIP_THB } from './gate';

export const HIGH_VALUE_THB = 20_000;
export const OUTGOING_SUFFIX = '-OUT';

export type SettleSkip =
  | 'ALREADY_SETTLED'
  | 'NOT_LOCKED'
  | 'NO_AMOUNT'
  | 'AMOUNT_TOO_LARGE'
  | 'HIGH_VALUE'
  | 'PIN_MISMATCH'
  | 'NO_PIN';

export const SKIP_TH: Record<SettleSkip, string> = {
  ALREADY_SETTLED: 'โอนแล้ว',
  NOT_LOCKED: 'ยังไม่ล็อก',
  NO_AMOUNT: 'ยังไม่มียอด',
  AMOUNT_TOO_LARGE: 'ยอดเกินเพดาน',
  HIGH_VALUE: 'ยอดสูง ต้องยืนยัน',
  PIN_MISMATCH: 'บัญชีไม่ตรงหมุด',
  NO_PIN: 'ยังไม่หมุดบัญชีรับ',
};

export function payeeLast4(mask?: string | null): string | null {
  const d = String(mask ?? '').replace(/\D/g, '');
  return d.length >= 4 ? d.slice(-4) : d || null;
}

export function ledgerBase(ledgerRef: string): string {
  return String(ledgerRef || '').replace(/-OUT$/, '');
}

export function outgoingLedgerRef(ledgerRef: string): string {
  return `${ledgerBase(ledgerRef)}${OUTGOING_SUFFIX}`;
}

/** Incoming CE-… and outgoing CE-…-OUT must resolve to the same tape row. */
export function outgoingIndexKeys(ledgerRef: string): string[] {
  const base = ledgerBase(ledgerRef);
  if (!base) return [];
  return [base, `${base}${OUTGOING_SUFFIX}`];
}

export function pinMatchesForSettle(
  bank: string | null | undefined,
  last4: string | null | undefined,
  pins: PinnedBank[],
): boolean {
  const hit = matchPinnedBank(bank, last4, pins);
  if (!hit) return false;
  const code = normalizeBankCode(bank);
  if (code && normalizeBankCode(hit.bank_name) !== code) return false;
  return true;
}

export function settleBlockReason(
  p: {
    status: string;
    thb_in: number | null;
    should_send: number | null;
    bank: string | null;
    account_masked?: string | null;
    last4?: string | null;
  },
  pins: PinnedBank[],
  opts: { confirmHigh?: boolean; confirmMismatch?: boolean } = {},
): SettleSkip | null {
  if (p.status === 'SETTLED') return 'ALREADY_SETTLED';
  if (p.status !== 'LOCKED') return 'NOT_LOCKED';
  if (p.should_send == null || !Number.isFinite(p.should_send) || p.should_send <= 0) return 'NO_AMOUNT';
  const thb = Number(p.thb_in ?? 0);
  if (thb > MAX_SLIP_THB) return 'AMOUNT_TOO_LARGE';
  if (!opts.confirmHigh && thb >= HIGH_VALUE_THB) return 'HIGH_VALUE';
  if (!pins.length) return 'NO_PIN';
  const last4 = p.last4 ?? payeeLast4(p.account_masked);
  if (!opts.confirmMismatch && !pinMatchesForSettle(p.bank, last4, pins)) return 'PIN_MISMATCH';
  return null;
}

export function isOcrJunkAmount(thb: number | null | undefined): boolean {
  return thb != null && Number.isFinite(thb) && thb > MAX_SLIP_THB;
}
