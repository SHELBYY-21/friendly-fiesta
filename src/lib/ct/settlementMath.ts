/** Settlement math + status copy. No Node/Telegram imports — safe for the desk UI. */

export type SettlementState = 'READY' | 'MATCHED' | 'EXCESS' | 'SHORT' | 'SETTLED';
export type SettlementRail = 'sol-usdc' | 'manual-trc20';

export type SettlementCard = {
  depositThb: number;
  depositCount: number;
  roomRate: number;
  sentUsdt?: number | null;
  settled?: boolean;
  statusMessage?: string | null;
  adminName?: string | null;
  rail?: SettlementRail | null;
  fromLabel?: string | null;
  fromAddress?: string | null;
  destAddress?: string | null;
};

export const EPS = 0.005;
const CONFIRM_GAP_MS = 2000;
const lastConfirm = new Map<string, number>();

export const STATUS_CONFIG: Record<
  SettlementState,
  { icon: string; chip: string; th: string; message: string }
> = {
  READY: { icon: '⏳', chip: 'READY', th: 'รอส่ง', message: 'กรุณาส่งตามจำนวนที่คำนวณ (send the required amount)' },
  MATCHED: { icon: '✓', chip: 'MATCHED', th: 'ยอดตรง', message: 'ยอดตรงตามจำนวนที่ต้องเคลียร์ (matched)' },
  EXCESS: { icon: '↑', chip: 'EXCESS', th: 'ส่งเกิน', message: 'ส่งเกินจำนวนที่ต้องเคลียร์ (over sent)' },
  SHORT: { icon: '↓', chip: 'SHORT', th: 'ส่งขาด', message: 'ส่งน้อยกว่าจำนวนที่ต้องเคลียร์ (short)' },
  SETTLED: { icon: '✅', chip: 'SETTLED', th: 'ปิดรายการแล้ว', message: 'รายการนี้ปิดการแก้ไขแล้ว (closed)' },
};

export function requiredUsdt(card: SettlementCard): number {
  if (!card.roomRate || card.roomRate <= 0) return 0;
  return Math.round((card.depositThb / card.roomRate) * 100) / 100;
}

export function settlementDiff(card: SettlementCard): number | null {
  if (card.sentUsdt == null) return null;
  return Math.round((card.sentUsdt - requiredUsdt(card)) * 100) / 100;
}

export function settlementState(card: SettlementCard): SettlementState {
  if (card.settled) return 'SETTLED';
  const diff = settlementDiff(card);
  if (diff == null) return 'READY';
  if (Math.abs(diff) <= EPS) return 'MATCHED';
  return diff > 0 ? 'EXCESS' : 'SHORT';
}

export function statusMessageOf(card: SettlementCard): string {
  const custom = (card.statusMessage || '').trim();
  if (custom) return custom;
  return STATUS_CONFIG[settlementState(card)].message;
}

export function canConfirmSettlement(card: SettlementCard): boolean {
  if (card.settled) return false;
  if (card.depositCount <= 0) return false;
  if (!card.roomRate || card.roomRate <= 0) return false;
  if (!(card.depositThb > 0)) return false;
  return true;
}

export function validateSettlement(card: SettlementCard): string[] {
  const errors: string[] = [];
  if (!(card.depositThb > 0) && card.depositCount > 0) errors.push('❌ ยอดฝากต้องมากกว่า 0');
  if (!card.roomRate || card.roomRate <= 0) errors.push('❌ เรทห้องต้องมากกว่า 0');
  if (card.depositCount <= 0) errors.push('❌ ยังไม่มีรายการรอโอน (queue empty)');
  if (card.sentUsdt != null && card.sentUsdt < 0) errors.push('❌ ยอดที่ส่งต้องเป็นตัวเลขบวก');
  return errors;
}

export function claimSettlementConfirm(key: string, now = Date.now()): boolean {
  const id = String(key || '').trim();
  if (!id) return false;
  const prev = lastConfirm.get(id) ?? 0;
  if (now - prev < CONFIRM_GAP_MS) return false;
  lastConfirm.set(id, now);
  return true;
}

export function resetSettlementConfirm(key?: string): void {
  if (key) lastConfirm.delete(key);
  else lastConfirm.clear();
}

/** Always two decimals with an explicit + or −. Zero is +0.00. */
export function signedDiffText(diff: number | null, unit = 'USDT'): string | null {
  if (diff == null) return null;
  const sign = diff < -EPS ? '-' : '+';
  return `${sign}${(Math.round(Math.abs(diff) * 100) / 100).toFixed(2)} ${unit}`;
}
