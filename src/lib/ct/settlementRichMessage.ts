/**
 * CE VAULT — Settlement Rich Message (Telegram HTML)
 * Allowed buttons only: IN · OUT · CONFIRM · SETTLED · DONE · BACK
 */
import type { OutgoingMessage } from '../telegram';
import { escapeTelegramHtml } from '../botSecurity';
import {
  SettlementCard,
  SettlementState,
  formatDiffSigned,
  formatMoney2,
  type SettlementDirection,
} from './settlementCard';

const SEP = '━━━━━━━━━━━━━━━━━━';

type Btn = { text: string; callback_data: string };

function mono(s: string): string {
  return `<code>${escapeTelegramHtml(s)}</code>`;
}

function amount(n: number, currency: string): string {
  return `<b>${mono(`${formatMoney2(n)} ${currency}`)}</b>`;
}

function statusLine(state: SettlementState): string {
  switch (state) {
    case SettlementState.READY:
      return `🔵 ${mono('⏳ READY')}`;
    case SettlementState.MATCHED:
      return `🟡 ${mono('✓ MATCHED')}`;
    case SettlementState.EXCESS:
      return `🟡 ${mono('↑ EXCESS')}`;
    case SettlementState.SHORT:
      return `🟣 ${mono('↓ SHORT')}`;
    case SettlementState.SETTLED:
      return `🟢 ${mono('✅ SETTLED')}`;
    default:
      return mono(String(state));
  }
}

export type SettlementUiPhase =
  | 'pick_direction'
  | 'await_deposit'
  | 'await_rate'
  | 'await_sent'
  | 'review'
  | 'confirming'
  | 'settled';

export class SettlementRichMessage {
  readonly card: SettlementCard;
  readonly phase: SettlementUiPhase;
  readonly shakeHint: boolean;

  constructor(
    card: SettlementCard,
    opts: { phase?: SettlementUiPhase; shakeHint?: boolean } = {},
  ) {
    this.card = card;
    this.phase = opts.phase ?? (card.state === SettlementState.SETTLED ? 'settled' : 'review');
    this.shakeHint = Boolean(opts.shakeHint);
  }

  buildMessageText(): string {
    const { card } = this;
    const required = card.requiredUsdt;
    const diff = card.difference;
    const sentStr = card.sentUsdt == null ? mono('รอส่ง') : amount(card.sentUsdt, 'USDT');
    const diffStr = diff == null ? mono('รอคำนวณ') : `<b>${mono(formatDiffSigned(diff))}</b>`;

    const lines: string[] = [
      `◈ <b>${escapeTelegramHtml('CE VAULT — SETTLEMENT')}</b>`,
      `<i>(Settlement Card)</i>`,
      '',
      statusLine(card.state),
      mono(card.direction === 'OUT' ? 'ทิศทาง OUT' : 'ทิศทาง IN'),
      SEP,
      `💰 ${escapeTelegramHtml('ฝากรวม')}`,
      amount(card.depositThb, 'THB'),
      mono(`${card.depositCount} รายการ`),
      SEP,
      `📊 ${escapeTelegramHtml('ยอดที่ต้องส่ง USDT')}`,
      amount(required, 'USDT'),
      mono(`${formatMoney2(card.depositThb)} ÷ ${formatMoney2(card.roomRate)}`),
      SEP,
      `📤 ${escapeTelegramHtml('ส่งไปแล้ว')}`,
      sentStr,
      SEP,
      `📈 ${escapeTelegramHtml('ส่วนต่าง')}`,
      diffStr,
      mono(card.statusMessage),
    ];

    if (this.shakeHint || card.validate().length) {
      lines.push(SEP);
      lines.push(`⚠️ <b>${escapeTelegramHtml('ข้อผิดพลาด')}</b>`);
      for (const e of card.validate()) lines.push(escapeTelegramHtml(e));
      if (!card.validate().length && this.shakeHint) {
        lines.push(escapeTelegramHtml('• ข้อมูลไม่พร้อมยืนยัน'));
      }
    }

    if (this.phase === 'confirming') {
      lines.push(SEP);
      lines.push(mono('กำลังยืนยัน…'));
    }

    return lines.join('\n');
  }

  /** Only allowed buttons from Design Engineer prompt */
  buildKeyboard(): OutgoingMessage['reply_markup'] {
    const { card, phase } = this;
    const rows: Btn[][] = [];

    if (phase === 'pick_direction') {
      rows.push([
        { text: 'IN', callback_data: 'settleui:in' },
        { text: 'OUT', callback_data: 'settleui:out' },
      ]);
      rows.push([{ text: 'BACK', callback_data: 'settleui:back' }]);
      return { inline_keyboard: rows };
    }

    if (phase === 'settled' || card.state === SettlementState.SETTLED) {
      rows.push([{ text: 'DONE', callback_data: 'settleui:done' }]);
      rows.push([{ text: 'BACK', callback_data: 'settleui:back' }]);
      return { inline_keyboard: rows };
    }

    if (phase === 'confirming' || card.confirmLocked) {
      rows.push([{ text: '⏳ CONFIRM', callback_data: 'settleui:noop' }]);
      rows.push([{ text: 'BACK', callback_data: 'settleui:back' }]);
      return { inline_keyboard: rows };
    }

    // review / await_* — primary actions only
    const can = card.canConfirm();
    rows.push([
      {
        text: can ? 'CONFIRM' : 'CONFIRM',
        callback_data: can ? 'settleui:confirm' : 'settleui:noop',
      },
    ]);
    if (can) {
      rows.push([{ text: 'SETTLED', callback_data: 'settleui:settled' }]);
    }
    rows.push([
      { text: 'IN', callback_data: 'settleui:in' },
      { text: 'OUT', callback_data: 'settleui:out' },
    ]);
    rows.push([{ text: 'BACK', callback_data: 'settleui:back' }]);
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
  direction?: SettlementDirection;
  state?: SettlementState;
  statusMessage?: string;
  confirmLocked?: boolean;
  phase?: SettlementUiPhase;
  shakeHint?: boolean;
}): OutgoingMessage {
  const card = new SettlementCard(input);
  return new SettlementRichMessage(card, {
    phase: input.phase,
    shakeHint: input.shakeHint,
  }).buildMessage();
}

/** Example Telegram payloads for design QA */
export function settlementExamples(): Record<string, OutgoingMessage> {
  return {
    ready: settlementRichMessage({
      depositThb: 10000,
      depositCount: 3,
      roomRate: 36.7,
      sentUsdt: null,
      phase: 'await_sent',
    }),
    matched: settlementRichMessage({
      depositThb: 10000,
      depositCount: 3,
      roomRate: 36.7,
      sentUsdt: 272.48,
      phase: 'review',
    }),
    excess: settlementRichMessage({
      depositThb: 10000,
      depositCount: 3,
      roomRate: 36.7,
      sentUsdt: 272.6,
      phase: 'review',
    }),
    short: settlementRichMessage({
      depositThb: 10000,
      depositCount: 3,
      roomRate: 36.7,
      sentUsdt: 272.0,
      phase: 'review',
    }),
    settled: settlementRichMessage({
      depositThb: 10000,
      depositCount: 3,
      roomRate: 36.7,
      sentUsdt: 272.48,
      state: SettlementState.SETTLED,
      phase: 'settled',
    }),
  };
}
