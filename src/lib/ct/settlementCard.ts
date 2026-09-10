/** CE VAULT — Settlement card model (desk batch / room settle). */

export enum SettlementState {
  READY = 'READY',
  MATCHED = 'MATCHED',
  EXCESS = 'EXCESS',
  SHORT = 'SHORT',
  SETTLED = 'SETTLED',
}

export type SettlementCardInput = {
  depositThb: number;
  depositCount: number;
  roomRate: number;
  sentUsdt?: number | null;
  state?: SettlementState;
  statusMessage?: string;
};

export class SettlementCard {
  readonly depositThb: number;
  readonly depositCount: number;
  readonly roomRate: number;
  readonly sentUsdt: number | null;
  private readonly forcedState?: SettlementState;
  private readonly customStatus?: string;

  constructor(input: SettlementCardInput) {
    this.depositThb = Number(input.depositThb) || 0;
    this.depositCount = Math.max(0, Math.floor(Number(input.depositCount) || 0));
    this.roomRate = Number(input.roomRate) || 0;
    this.sentUsdt =
      input.sentUsdt == null || !Number.isFinite(Number(input.sentUsdt))
        ? null
        : Number(input.sentUsdt);
    this.forcedState = input.state;
    this.customStatus = input.statusMessage?.trim() || undefined;
  }

  get requiredUsdt(): number {
    if (!(this.roomRate > 0)) return 0;
    return Math.round((this.depositThb / this.roomRate) * 100) / 100;
  }

  get difference(): number | null {
    if (this.sentUsdt == null) return null;
    return Math.round((this.sentUsdt - this.requiredUsdt) * 100) / 100;
  }

  get state(): SettlementState {
    if (this.forcedState) return this.forcedState;
    if (this.sentUsdt == null) return SettlementState.READY;
    const d = this.difference ?? 0;
    if (Math.abs(d) < 0.01) return SettlementState.MATCHED;
    if (d > 0) return SettlementState.EXCESS;
    return SettlementState.SHORT;
  }

  get statusMessage(): string {
    if (this.customStatus) return this.customStatus;
    switch (this.state) {
      case SettlementState.READY:
        return 'รอส่ง USDT ตามยอดที่คำนวณ';
      case SettlementState.MATCHED:
        return 'ยอดตรง พร้อมยืนยัน';
      case SettlementState.EXCESS:
        return 'ส่งเกินยอดที่ต้องส่ง';
      case SettlementState.SHORT:
        return 'ส่งน้อยกว่ายอดที่ต้องส่ง';
      case SettlementState.SETTLED:
        return 'ปิดยอดแล้ว';
      default:
        return '';
    }
  }

  validate(): string[] {
    const errors: string[] = [];
    if (!(this.depositThb > 0)) errors.push('• ยอดฝากต้องมากกว่า 0');
    if (!(this.roomRate > 0)) errors.push('• อัตราโต๊ะต้องมากกว่า 0');
    if (this.depositCount < 1) errors.push('• ต้องมีอย่างน้อย 1 รายการ');
    return errors;
  }

  canConfirm(): boolean {
    if (this.state === SettlementState.SETTLED) return false;
    if (this.validate().length) return false;
    return this.state === SettlementState.MATCHED || this.state === SettlementState.EXCESS;
  }
}
