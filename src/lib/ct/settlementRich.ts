/** CE VAULT settlement card — TypeScript port of SettlementRichMessage.
 * Telegram HTML (not Markdown). Inline buttons use live CT callbacks.
 * Mini App opens via web_app URL. sendData only works from reply-keyboard launch.
 */
import type { OutgoingMessage } from '../telegram';
import { btn, ik, usdt as fmtUsdt, thbCard, thbInt, rateCode, webAppBtn, miniAppUrl } from './format';
import { brandLine, rule, progress, IN_DOT, OUT_DOT, OK, CASH, HOUR } from './tokens';
import { richSettlement } from './cardJson';

export type SettlementState = 'READY' | 'MATCHED' | 'EXCESS' | 'SHORT' | 'SETTLED';

export type SettlementCard = {
  depositThb: number;
  depositCount: number;
  roomRate: number;
  sentUsdt?: number | null;
  settled?: boolean;
  statusMessage?: string | null;
};

const EPS = 0.005;

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

export function canConfirmSettlement(card: SettlementCard): boolean {
  if (card.settled) return false;
  if (card.depositCount <= 0) return false;
  if (!card.roomRate || card.roomRate <= 0) return false;
  const state = settlementState(card);
  return state === 'READY' || state === 'MATCHED' || state === 'EXCESS' || state === 'SHORT';
}

export function validateSettlement(card: SettlementCard): string[] {
  const errors: string[] = [];
  if (!card.roomRate || card.roomRate <= 0) errors.push('ยังไม่ได้ตั้งเรทห้อง (no desk rate)');
  if (card.depositCount <= 0) errors.push('ยังไม่มีรายการรอโอน (queue empty)');
  if (!(card.depositThb > 0) && card.depositCount > 0) errors.push('ยอดฝากไม่ถูกต้อง (bad deposit)');
  return errors;
}

const BADGE: Record<SettlementState, { dot: string; chip: string; th: string }> = {
  READY: { dot: '🔵', chip: 'READY', th: 'รอโอน' },
  MATCHED: { dot: '🟢', chip: 'MATCHED', th: 'ยอดตรง' },
  EXCESS: { dot: '🔴', chip: 'EXCESS', th: 'ส่งเกิน' },
  SHORT: { dot: '🔴', chip: 'SHORT', th: 'ส่งขาด' },
  SETTLED: { dot: '🟢', chip: 'SETTLED', th: 'โอนสำเร็จ' },
};

function money(n: number, unit: 'THB' | 'USDT'): string {
  const v = unit === 'THB' ? thbCard(n) : fmtUsdt(n);
  return `<b><code>${v} ${unit}</code></b>`;
}

export function buildSettlementText(card: SettlementCard): string {
  const state = settlementState(card);
  const need = requiredUsdt(card);
  const diff = settlementDiff(card);
  const badge = BADGE[state];
  const sent = card.sentUsdt == null ? 'รอส่ง' : money(card.sentUsdt, 'USDT');
  let diffLine = '`รอคำนวณ`';
  if (diff != null) {
    const sign = diff > EPS ? '+' : diff < -EPS ? '−' : '';
    diffLine = `<b><code>${sign}${fmtUsdt(Math.abs(diff))} USDT</code></b>`;
  }
  const step = state === 'SETTLED' ? 'done' : 'wait';
  const lines = [
    brandLine(),
    `${CASH}  <b>เคลียร์ยอด (SETTLEMENT)</b>`,
    progress(step),
    rule(),
    `${badge.dot} <code>${badge.chip}</code>  ${badge.th}`,
    '',
    `${IN_DOT} <b>ฝากรวม</b>  (deposit)`,
    money(card.depositThb, 'THB'),
    `<code>${card.depositCount} รายการ</code>`,
    '',
    `${OUT_DOT} <b>ยอดที่ต้องส่ง USDT</b>  (required)`,
    money(need, 'USDT'),
    `<code>(${thbInt(card.depositThb)} ÷ ${rateCode(card.roomRate)})</code>`,
    '',
    `${HOUR} <b>ส่งไปแล้ว</b>  (sent)`,
    sent,
    '',
    `${OK} <b>ส่วนต่าง</b>  (difference)`,
    diffLine,
    card.statusMessage ? `<i>${escapeLite(card.statusMessage)}</i>` : '',
  ];
  const errors = validateSettlement(card);
  if (errors.length) {
    lines.push('', '⚠️ <b>ข้อผิดพลาด</b>');
    for (const e of errors) lines.push(`• ${escapeLite(e)}`);
  }
  return lines.filter((x) => x !== '').join('\n');
}

function escapeLite(s: string): string {
  return s.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
}

export function buildSettlementKeyboard(card: SettlementCard) {
  const rows: Array<Array<Record<string, unknown>>> = [];
  const state = settlementState(card);
  if (state === 'SETTLED') {
    rows.push([btn('โอนสำเร็จ', 'vault:today', 'success')]);
  } else if (canConfirmSettlement(card)) {
    rows.push([
      btn('บันทึกส่งรวม', 'vault:batch', 'danger'),
      btn('ยกเลิก', 'vault:today', 'primary'),
    ]);
  } else {
    rows.push([btn('ดูยอด', 'vault:today', 'primary')]);
  }
  rows.push([
    btn('ดูรายละเอียด', 'vault:pending'),
    btn('กลับ VAULT', 'vault:today'),
  ]);
  rows.push([webAppBtn('เปิด VAULT', miniAppUrl(state === 'SETTLED' ? 'done' : 'vault'))]);
  return ik(rows);
}

export function cardSettlement(card: SettlementCard): OutgoingMessage {
  const state = settlementState(card);
  return {
    text: buildSettlementText(card),
    reply_markup: buildSettlementKeyboard(card),
    rich: richSettlement({
      depositThb: card.depositThb,
      depositCount: card.depositCount,
      required: requiredUsdt(card),
      sent: card.sentUsdt ?? null,
      state,
      rate: card.roomRate,
    }),
  };
}

export const SETTLEMENT_WEBAPP_ACTIONS = new Set([
  'vault:batch',
  'vault:today',
  'vault:pending',
  'settlement_confirm',
  'settlement_cancel',
  'settlement_done',
  'settlement_details',
  'vault_menu',
]);

export function mapSettlementAction(action: string): string | null {
  const a = (action || '').trim();
  if (a === 'settlement_confirm') return 'vault:batch';
  if (a === 'settlement_cancel' || a === 'settlement_done' || a === 'vault_menu') return 'vault:today';
  if (a === 'settlement_details') return 'vault:pending';
  if (a === 'vault:batch' || a === 'vault:today' || a === 'vault:pending') return a;
  return null;
}
