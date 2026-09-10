/**
 * CE VAULT — Settlement Rich Message (Telegram)
 * Port of SettlementRichMessage: formatted card + inline buttons.
 * Uses HTML parse_mode via existing OutgoingMessage / sendMessage.
 */
import type { OutgoingMessage } from '../telegram';
import { escapeTelegramHtml } from '../botSecurity';
import { SettlementCard, SettlementState } from './settlementCard';

const SEP = '━━━━━━━━━━━━━━━━━━';
const nf = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });
const money = (n: number) => nf.format(Number(n) || 0);

function mono(s: string): string {
  return `<code>${escapeTelegramHtml(s)}</code>`;
}

function amount(n: number, currency: string): string {
  return `<b>${mono(`${money(n)} ${currency}`)}</b>`;
}

function statusBadge(state: SettlementState): { icon: string; label: string } {
  switch (state) {
    case SettlementState.READY:
      return { icon: '🔵', label: '⏳ READY' };
    case SettlementState.MATCHED:
      return { icon: '🟡', label: '✓ MATCHED' };
    case SettlementState.EXCESS:
      return { icon: '🟡', label: '↑ EXCESS' };
    case SettlementState.SHORT:
      return { icon: '🟣', label: '↓ SHORT' };
    case SettlementState.SETTLED:
      return { icon: '🟢', label: '✅ SETTLED' };
    default:
      return { icon: '⚪', label: String(state) };
  }
}

export type SettlementRichMessageConfig = {
  disableWebPreview?: boolean;
};

export class SettlementRichMessage {
  readonly card: SettlementCard;
  readonly config: SettlementRichMessageConfig;

  constructor(card: SettlementCard, config: SettlementRichMessageConfig = {}) {
    this.card = card;
    this.config = { disableWebPreview: true, ...config };
  }

  buildMessageText(): string {
    const { card } = this;
    const badge = statusBadge(card.state);
    const required = card.requiredUsdt;
    const diff = card.difference;

    const sentStr =
      card.sentUsdt == null ? mono('รอส่ง') : amount(card.sentUsdt, 'USDT');

    let diffStr = mono('รอคำนวณ');
    if (diff != null) {
      const sign = diff >= 0 ? '+' : '−';
      diffStr = `<b>${mono(`${sign}${money(Math.abs(diff))} USDT`)}</b>`;
    }

    const lines: string[] = [
      `◈ <b>${escapeTelegramHtml('CE VAULT — SETTLEMENT')}</b>`,
      `<i>(Settlement Card)</i>`,
      '',
      `${badge.icon} ${mono(badge.label)}`,
      SEP,
      `💰 ${escapeTelegramHtml('ฝากรวม')} (Deposit)`,
      amount(card.depositThb, 'THB'),
      mono(`${card.depositCount} รายการ`),
      SEP,
      `📊 ${escapeTelegramHtml('ยอดที่ต้องส่ง USDT')} (Due)`,
      amount(required, 'USDT'),
      mono(`(${money(card.depositThb)} ÷ ${card.roomRate.toFixed(2)})`),
      SEP,
      `📤 ${escapeTelegramHtml('ส่งไปแล้ว')} (Sent)`,
      sentStr,
      SEP,
      `📈 ${escapeTelegramHtml('ส่วนต่าง')} (Diff)`,
      diffStr,
      mono(card.statusMessage),
    ];

    const errors = card.validate();
    if (errors.length) {
      lines.push(SEP);
      lines.push(`⚠️ <b>${escapeTelegramHtml('ข้อผิดพลาด')}</b>`);
      for (const e of errors) lines.push(escapeTelegramHtml(e));
    }

    return lines.join('\n');
  }

  buildKeyboard(): OutgoingMessage['reply_markup'] {
    const { card } = this;
    const rows: Array<Array<{ text: string; callback_data: string }>> = [];

    if (card.state === SettlementState.SETTLED) {
      rows.push([{ text: '✅ DONE', callback_data: 'settlement:done' }]);
    } else {
      const can = card.canConfirm();
      rows.push([
        {
          text: can ? '✅ CONFIRM' : '⏳ PROCESSING',
          callback_data: can ? 'settlement:confirm' : 'settlement:noop',
        },
        { text: '❌ ยกเลิก', callback_data: 'settlement:cancel' },
      ]);
    }

    rows.push([
      { text: '📊 ดูรายละเอียด', callback_data: 'settlement:details' },
      { text: '🔙 กลับ VAULT', callback_data: 'qa:vault' },
    ]);

    return { inline_keyboard: rows };
  }

  buildMessage(): OutgoingMessage {
    return {
      text: this.buildMessageText(),
      reply_markup: this.buildKeyboard(),
    };
  }
}

export function settlementRichMessage(input: {
  depositThb: number;
  depositCount: number;
  roomRate: number;
  sentUsdt?: number | null;
  state?: SettlementState;
  statusMessage?: string;
}): OutgoingMessage {
  const card = new SettlementCard(input);
  return new SettlementRichMessage(card).buildMessage();
}
