/** CE VAULT settlement card — Telegram HTML. Box-drawing mockups do not render on mobile. */
import type { OutgoingMessage } from '../telegram';
import { btn, ik, usdt as fmtUsdt, thbCard, thbInt, rateCode, webAppBtn, miniAppUrl, esc } from './format';
import { brandLine, rule, progress, IN_DOT, OUT_DOT, OK, CASH, HOUR } from './tokens';
import { richSettlement } from './cardJson';
import { railLabel, type PayoutWallet } from './payoutWallet';
import {
  EPS,
  STATUS_CONFIG,
  canConfirmSettlement,
  requiredUsdt,
  settlementDiff,
  settlementState,
  signedDiffText,
  statusMessageOf,
  validateSettlement,
  type SettlementCard,
} from './settlementMath';

export type { SettlementCard, SettlementState } from './settlementMath';
export {
  EPS,
  STATUS_CONFIG,
  canConfirmSettlement,
  claimSettlementConfirm,
  requiredUsdt,
  resetSettlementConfirm,
  settlementDiff,
  settlementState,
  signedDiffText,
  statusMessageOf,
  validateSettlement,
} from './settlementMath';

function money(n: number, unit: 'THB' | 'USDT' | 'USDC'): string {
  const v = unit === 'THB' ? thbCard(n) : fmtUsdt(n);
  return `<b><code>${v} ${unit}</code></b>`;
}

function payoutLines(card: SettlementCard): string[] {
  const rail = card.rail;
  if (!rail && !card.fromAddress && !card.destAddress) return [];
  const unit = rail === 'sol-usdc' ? 'USDC' : 'USDT';
  const lines = ['', `${CASH} <b>รางโอนวันนี้</b>  (payout rail)`];
  if (rail) lines.push(`<code>${esc(railLabel(rail))}</code>`);
  if (card.fromLabel || card.fromAddress) {
    lines.push(`${OUT_DOT} <b>จากกระเป๋า</b>  (from)`);
    if (card.fromLabel) lines.push(esc(card.fromLabel));
    if (card.fromAddress) lines.push(`<code>${esc(card.fromAddress)}</code>`);
  }
  if (card.destAddress) {
    lines.push(`${IN_DOT} <b>ไปที่อยู่ลูกค้า</b>  (to)`);
    lines.push(`<code>${esc(card.destAddress)}</code>`);
  } else if (rail === 'sol-usdc') {
    lines.push('⚠️ ยังไม่มีที่อยู่ลูกค้า — ห้ามเซ็น (no dest)');
  }
  if (rail === 'manual-trc20') {
    lines.push(`โอนมือ ${unit} แล้วค่อยกดบันทึก`);
  }
  return lines;
}

export function applyPayout(card: SettlementCard, wallet: PayoutWallet | null | undefined): SettlementCard {
  if (!wallet) return card;
  return {
    ...card,
    rail: wallet.rail,
    fromLabel: wallet.label,
    fromAddress: wallet.fromAddress,
    destAddress: wallet.destAddress,
  };
}

export function buildSettlementText(card: SettlementCard): string {
  const state = settlementState(card);
  const need = requiredUsdt(card);
  const diff = settlementDiff(card);
  const badge = STATUS_CONFIG[state];
  const unit = card.rail === 'sol-usdc' ? 'USDC' : 'USDT';
  const sent = card.sentUsdt == null ? 'รอส่ง' : money(card.sentUsdt, unit);
  const signed = signedDiffText(diff, unit);
  const diffLine = signed ? `<b><code>${signed}</code></b>` : '`รอคำนวณ`';
  const step = state === 'SETTLED' ? 'done' : 'wait';
  const errors = validateSettlement(card);
  if (errors.length && state !== 'SETTLED') {
    return [
      brandLine(),
      '⚠️  <b>ข้อมูลไม่ถูกต้อง</b>  (check inputs)',
      rule(),
      ...errors.map((e) => esc(e)),
      '',
      'กรุณาตรวจสอบแล้วกรอกใหม่',
    ].join('\n');
  }
  const lines = [
    brandLine(),
    `${CASH}  <b>เคลียร์ยอด (SETTLEMENT)</b>`,
    progress(step),
    rule(),
    `${badge.icon} <code>${badge.chip}</code>  ${badge.th}`,
    '',
    `${IN_DOT} <b>ฝากรวม</b>  (deposit)`,
    money(card.depositThb, 'THB'),
    `<code>${card.depositCount} รายการ</code>`,
    '',
    `${OUT_DOT} <b>ยอดที่ต้องส่ง ${unit}</b>  (required)`,
    money(need, unit),
    `<code>(${thbInt(card.depositThb)} ÷ ${rateCode(card.roomRate)})</code>`,
    '',
    `${HOUR} <b>ส่งไปแล้ว</b>  (sent)`,
    sent,
    '',
    `${OK} <b>ส่วนต่าง</b>  (difference)`,
    diffLine,
    `<i>${esc(statusMessageOf(card))}</i>`,
    ...payoutLines(card),
  ];
  if (card.adminName) lines.push('', `<code>${esc(card.adminName)}</code>`);
  return lines.filter((x) => x !== '').join('\n');
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
  rows.push([webAppBtn('เปิด VAULT', miniAppUrl(state === 'SETTLED' ? 'done' : 'vault', {
    thb: card.depositThb,
    count: card.depositCount,
    rate: card.roomRate,
    sent: card.sentUsdt,
    state,
  }))]);
  return ik(rows);
}

export function cardSettlement(card: SettlementCard): OutgoingMessage {
  const state = settlementState(card);
  const need = requiredUsdt(card);
  const diff = settlementDiff(card);
  return {
    text: buildSettlementText(card),
    reply_markup: buildSettlementKeyboard(card),
    rich: richSettlement({
      depositThb: card.depositThb,
      depositCount: card.depositCount,
      required: need,
      sent: card.sentUsdt ?? null,
      state,
      rate: card.roomRate,
      diff,
      message: statusMessageOf(card),
      rail: card.rail ?? null,
      fromAddress: card.fromAddress ?? null,
      destAddress: card.destAddress ?? null,
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
