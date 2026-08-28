export type TxState =
  | 'SCAN'
  | 'MATCH'
  | 'LOCK'
  | 'WAIT'
  | 'SENT'
  | 'DONE'
  | 'ERROR';

export type OpsError = {
  code: string;
  cause: string;
  action: string;
};

const ALLOWED: Record<TxState, TxState[]> = {
  SCAN: ['MATCH', 'ERROR'],
  MATCH: ['LOCK', 'ERROR'],
  LOCK: ['WAIT', 'ERROR'],
  WAIT: ['SENT', 'ERROR'],
  SENT: ['DONE', 'ERROR'],
  DONE: [],
  ERROR: ['SCAN', 'MATCH', 'LOCK', 'WAIT'],
};

export const OPS_ERRORS: Record<string, OpsError> = {
  PIN_MISMATCH: {
    code: 'PIN_MISMATCH',
    cause: 'เลขบัญชีผู้รับไม่ตรงบัญชีที่หมุดไว้',
    action: 'ตรวจหมุดบัญชี หรือกดบังคับถ้าเป็นบัญชีเรา',
  },
  NO_AMOUNT: {
    code: 'NO_AMOUNT',
    cause: 'อ่านยอด THB จากสลิปไม่ได้',
    action: 'พิมพ์ยอด เช่น +1000B แล้วลองใหม่',
  },
  OCR_WEAK: {
    code: 'OCR_WEAK',
    cause: 'รูปไม่ชัด หรือ OCR มั่นใจต่ำ',
    action: 'ส่งรูปใหม่ที่คมกว่า หรือกรอกยอดเอง',
  },
  DUPLICATE: {
    code: 'DUPLICATE',
    cause: 'สลิปนี้บันทึกแล้ว',
    action: 'เปิดรายการเดิมจาก REF ห้ามบันทึกซ้ำ',
  },
  NO_DESK_RATE: {
    code: 'NO_DESK_RATE',
    cause: 'ยังไม่มีอัตราโต๊ะของห้องนี้',
    action: 'ตั้งเรทด้วย /setrate หรือปุ่มตั้งเรท',
  },
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    cause: 'ผู้กดไม่มีสิทธิ์แอดมิน',
    action: 'ให้หัวหน้าห้องเพิ่มด้วย /admin <id>',
  },
  SETTLE_FAILED: {
    code: 'SETTLE_FAILED',
    cause: 'บันทึกส่ง USDT ไม่ครบทุก REF ในก้อน',
    action: 'เปิดคิว ตรวจ REF ที่ค้าง แล้วกดส่งรวมอีกครั้ง',
  },
};

export function opsError(code: string, extra?: string): OpsError {
  const base = OPS_ERRORS[code] ?? {
    code,
    cause: extra || 'ระบบประมวลผลรายการนี้ไม่สำเร็จ',
    action: 'เปิดรายการจาก REF แล้วลองใหม่',
  };
  return extra && OPS_ERRORS[code] ? { ...base, cause: `${base.cause} — ${extra}` } : base;
}

export function canTransition(from: TxState, to: TxState): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function stateFromSlip(input: {
  gate?: string | null;
  slipStatus?: string | null;
  expectedUsdt: number | null;
  sentUsdt: number | null;
}): TxState {
  const sent = input.sentUsdt ?? 0;
  const expected = input.expectedUsdt ?? 0;
  if ((input.slipStatus || '').includes('ERR') || input.gate === 'BLOCK') return 'ERROR';
  if (input.gate === 'PIN_MISMATCH' || input.slipStatus === 'PIN_MISMATCH') return 'ERROR';
  if (input.gate === 'OCR_WEAK' || input.slipStatus === 'OCR_WEAK') return 'ERROR';
  if (sent > 0 && expected > 0 && sent + 1e-9 >= expected) return 'DONE';
  if (sent > 0) return 'SENT';
  if (input.slipStatus === 'SETTLED') return 'DONE';
  if (input.slipStatus === 'HOLD' || input.slipStatus === 'DELETED') return 'ERROR';
  if (input.slipStatus === 'LOCKED' || input.slipStatus === 'IN_READY') return 'WAIT';
  if (input.gate === 'IN_READY' || input.gate === 'IN_READY_REVIEW') return 'LOCK';
  if (input.gate === 'NEED_UNIT') return 'SCAN';
  return 'WAIT';
}

export function statusChip(s: TxState): string {
  if (s === 'DONE') return 'DONE';
  if (s === 'SENT') return 'SENT';
  if (s === 'ERROR') return 'ERR';
  if (s === 'WAIT' || s === 'LOCK') return 'WAIT';
  return s;
}

export function dueUsdt(expected: number | null, sent: number | null): number | null {
  if (expected == null) return null;
  return Math.max(0, Math.round((expected - (sent ?? 0)) * 100) / 100);
}
