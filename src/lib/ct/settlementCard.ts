/** CE VAULT — Settlement card model (financial truth only). */

export enum SettlementState {
  READY = 'READY',
  MATCHED = 'MATCHED',
  EXCESS = 'EXCESS',
  SHORT = 'SHORT',
  SETTLED = 'SETTLED',
}

export type SettlementDirection = 'IN' | 'OUT';

export type SettlementCardInput = {
  depositThb: number;
  depositCount: number;
  roomRate: number;
  sentUsdt?: number | null;
  direction?: SettlementDirection;
  state?: SettlementState;
  statusMessage?: string;
  confirmLocked?: boolean;
};

const EPS = 0.01;

function money2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export class SettlementCard {
  readonly depositThb: number;
  readonly depositCount: number;
  readonly roomRate: number;
  readonly sentUsdt: number | null;
  readonly direction: SettlementDirection;
  readonly confirmLocked: boolean;
  private readonly forcedState?: SettlementState;
  private readonly customStatus?: string;

  constructor(input: SettlementCardInput) {
    this.depositThb = money2(input.depositThb);
    this.depositCount = Math.max(0, Math.floor(Number(input.depositCount) || 0));
    this.roomRate = money2(input.roomRate);
    this.sentUsdt =
      input.sentUsdt == null || !Number.isFinite(Number(input.sentUsdt))
        ? null
        : money2(input.sentUsdt);
    this.direction = input.direction === 'OUT' ? 'OUT' : 'IN';
    this.confirmLocked = Boolean(input.confirmLocked);
    this.forcedState = input.state;
    this.customStatus = input.statusMessage?.trim() || undefined;
  }

  get requiredUsdt(): number {
    if (!(this.roomRate > 0)) return 0;
    return money2(this.depositThb / this.roomRate);
  }

  get difference(): number | null {
    if (this.sentUsdt == null) return null;
    return money2(this.sentUsdt - this.requiredUsdt);
  }

  get state(): SettlementState {
    if (this.forcedState) return this.forcedState;
    if (this.sentUsdt == null) return SettlementState.READY;
    const d = this.difference ?? 0;
    if (Math.abs(d) < EPS) return SettlementState.MATCHED;
    if (d > 0) return SettlementState.EXCESS;
    return SettlementState.SHORT;
  }

  get statusMessage(): string {
    if (this.customStatus) return this.customStatus;
    switch (this.state) {
      case SettlementState.READY:
        return 'รอส่ง USDT ตามยอดที่คำนวณ';
      case SettlementState.MATCHED:
        return 'ยอดตรงตามจำนวนที่ต้องเคลียร์';
      case SettlementState.EXCESS:
        return 'ส่งเกินจำนวนที่ต้องเคลียร์จริง';
      case SettlementState.SHORT:
        return 'ส่งน้อยกว่าจำนวนที่ต้องเคลียร์จริง';
      case SettlementState.SETTLED:
        return 'ปิดรายการแล้ว';
      default:
        return '';
    }
  }

  /** Never map EXCESS to profit-green */
  get statusAccent(): 'cyan' | 'gold' | 'purple' | 'dim' {
    switch (this.state) {
      case SettlementState.READY:
        return 'cyan';
      case SettlementState.MATCHED:
      case SettlementState.EXCESS:
      case SettlementState.SETTLED:
        return 'gold';
      case SettlementState.SHORT:
        return 'purple';
      default:
        return 'dim';
    }
  }

  validate(): string[] {
    const errors: string[] = [];
    if (!(this.depositThb > 0)) errors.push('• ยอดฝากต้องมากกว่า 0');
    if (!(this.roomRate > 0)) errors.push('• อัตราโต๊ะต้องมากกว่า 0');
    if (this.depositCount < 1) errors.push('• ต้องมีอย่างน้อย 1 รายการ');
    if (this.sentUsdt != null && this.sentUsdt < 0) errors.push('• ยอดส่ง USDT ต้องไม่ติดลบ');
    return errors;
  }

  canConfirm(): boolean {
    if (this.confirmLocked) return false;
    if (this.state === SettlementState.SETTLED) return false;
    if (this.validate().length) return false;
    return this.state === SettlementState.MATCHED || this.state === SettlementState.EXCESS;
  }

  withState(state: SettlementState): SettlementCard {
    return new SettlementCard({
      depositThb: this.depositThb,
      depositCount: this.depositCount,
      roomRate: this.roomRate,
      sentUsdt: this.sentUsdt,
      direction: this.direction,
      state,
      statusMessage: this.customStatus,
      confirmLocked: this.confirmLocked,
    });
  }

  withConfirmLocked(locked: boolean): SettlementCard {
    return new SettlementCard({
      depositThb: this.depositThb,
      depositCount: this.depositCount,
      roomRate: this.roomRate,
      sentUsdt: this.sentUsdt,
      direction: this.direction,
      state: this.forcedState,
      statusMessage: this.customStatus,
      confirmLocked: locked,
    });
  }
}

export function formatMoney2(n: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(money2(n));
}

export function formatDiffSigned(diff: number): string {
  const abs = formatMoney2(Math.abs(diff));
  if (Math.abs(diff) < EPS) return `+${abs} USDT`;
  return diff > 0 ? `+${abs} USDT` : `−${abs} USDT`;
}
