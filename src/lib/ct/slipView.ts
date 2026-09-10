/**
 * CE VAULT — Slip View (full data, no masking, no OCR status line)
 * Telegram HTML. Operator path: OCR → Extract → Calculate → Clear.
 */
import type { OutgoingMessage } from '../telegram';
import { escapeTelegramHtml } from '../botSecurity';
import { showAcct, thbCard, usdt, rateCode, displayLedger } from './format';

export type SlipClearanceStatus = 'CLEARED' | 'PENDING' | 'FAILED';

export type SlipViewData = {
  id: string;
  slipNumber: string;
  amount: number;
  currency: string;
  bank: string;
  account: string;
  accountName: string;
  dateLabel: string;
  time: string;
  reference: string;
  roomRate: number;
  expectedUsdt: number;
  sentUsdt: number;
  deltaUsdt: number;
  clearancePercent: number;
  settlementId: string;
  status: SlipClearanceStatus;
  short: string;
  /** When true, CONFIRM is enabled */
  canConfirm?: boolean;
};

function esc(s: unknown): string {
  return escapeTelegramHtml(s);
}

function money2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function progressBar(pct: number, len = 16): string {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const filled = Math.round((p / 100) * len);
  return `${'█'.repeat(filled)}${'░'.repeat(len - filled)} ${p.toFixed(0)}%`;
}

function deltaLabel(d: number): string {
  const v = money2(d);
  const abs = usdt(Math.abs(v));
  if (Math.abs(v) < 0.01) return `+${abs}`;
  return v > 0 ? `+${abs}` : `−${abs}`;
}

/** Build Telegram HTML slip card — full account/name, no OCR %. */
export function renderSlipView(slip: SlipViewData): OutgoingMessage {
  const amountStr = thbCard(slip.amount);
  const rateStr = rateCode(slip.roomRate);
  const expectedStr = usdt(slip.expectedUsdt);
  const sentStr = usdt(slip.sentUsdt);
  const deltaStr = deltaLabel(slip.deltaUsdt);
  const acct = showAcct(slip.account);
  const name = String(slip.accountName || '—').trim() || '—';

  const statusLine =
    slip.status === 'CLEARED'
      ? `✓ เคลียร์ครบ <b>${esc(sentStr)} USDT</b>`
      : slip.status === 'PENDING'
        ? '⏳ กำลังเคลียร์…'
        : '❌ เคลียร์ไม่สำเร็จ';

  const pre = [
    '╔══════════════════════╗',
    '║  ◈ CE VAULT          ║',
    `║  SLIP ${String(slip.slipNumber).padEnd(16)}║`,
    '╚══════════════════════╝',
    '',
    '┌──────────────────────┐',
    `│  ${amountStr} ${slip.currency}`.padEnd(23) + '│',
    '│                      │',
    `│  ธนาคาร: ${slip.bank}`,
    `│  บัญชี: ${acct}`,
    `│  ชื่อ: ${name}`,
    `│  วันที่: ${slip.dateLabel || '—'}`,
    `│  เวลา: ${slip.time || '—'}`,
    `│  Ref: ${slip.reference || '—'}`,
    '└──────────────────────┘',
  ].join('\n');

  const lines = [
    `<pre>${esc(pre)}</pre>`,
    '',
    '<b>↓ CLEARANCE ↓</b>',
    '',
    'ฝากเข้า',
    `<b>${esc(amountStr)} ${esc(slip.currency)}</b>`,
    '',
    'เรทห้อง',
    `<code>${esc(rateStr)}</code> THB / USDT`,
    '',
    'ยอดที่ต้องเคลียร์',
    `<b>${esc(expectedStr)} USDT</b>`,
    '',
    'ยอดส่งจริง',
    `<b>${esc(sentStr)} USDT</b>`,
    '',
    'ส่วนต่าง',
    `<b>${esc(deltaStr)} USDT</b>`,
    '',
    `<code>${esc(progressBar(slip.clearancePercent))}</code>`,
    '',
    statusLine,
    '',
    'Settlement',
    `<code>${esc(slip.settlementId || displayLedger(slip.id))}</code>`,
  ];

  const can = slip.canConfirm !== false && slip.status === 'CLEARED';
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  if (can) {
    rows.push([
      { text: '✓ CONFIRM', callback_data: `slip:lock:${slip.short}` },
      { text: '✎ EDIT', callback_data: `slip:edit:${slip.short}` },
    ]);
  } else if (slip.status === 'PENDING') {
    rows.push([{ text: '⏳ PROCESSING', callback_data: 'slip:noop' }]);
    rows.push([{ text: '✎ EDIT', callback_data: `slip:edit:${slip.short}` }]);
  } else {
    rows.push([
      { text: 'ลองใหม่', callback_data: `slip:retry:${slip.short}` },
      { text: '✎ EDIT', callback_data: `slip:edit:${slip.short}` },
    ]);
  }

  return {
    text: lines.join('\n'),
    reply_markup: { inline_keyboard: rows },
  };
}

export function buildSlipViewFromParts(input: {
  short: string;
  ledger: string;
  amount: number;
  currency?: string;
  bank: string;
  account: string | null | undefined;
  accountName: string | null | undefined;
  date?: string | null;
  time?: string | null;
  reference?: string | null;
  roomRate: number;
  sentUsdt?: number | null;
  status?: SlipClearanceStatus;
  canConfirm?: boolean;
}): SlipViewData {
  const amount = money2(input.amount);
  const roomRate = money2(input.roomRate);
  const expectedUsdt = roomRate > 0 ? money2(amount / roomRate) : 0;
  const sentRaw = input.sentUsdt;
  const sentUsdt =
    sentRaw == null || !Number.isFinite(Number(sentRaw)) ? expectedUsdt : money2(sentRaw);
  const deltaUsdt = money2(sentUsdt - expectedUsdt);
  const calcReady = amount > 0 && roomRate > 0;
  const status: SlipClearanceStatus =
    input.status ?? (calcReady ? 'CLEARED' : 'PENDING');
  const clearancePercent = calcReady ? 100 : amount > 0 ? 50 : 0;
  const slipNo = input.short ? `#${input.short}` : '#----';
  return {
    id: input.ledger,
    slipNumber: slipNo,
    amount,
    currency: input.currency || 'THB',
    bank: input.bank || '—',
    account: String(input.account || ''),
    accountName: String(input.accountName || ''),
    dateLabel: input.date || '',
    time: input.time || '',
    reference: input.reference || '',
    roomRate,
    expectedUsdt,
    sentUsdt,
    deltaUsdt,
    clearancePercent,
    settlementId: input.ledger.replace(/^#/, '').startsWith('CE-')
      ? `ST-${input.short}`
      : `ST-${input.short}`,
    status,
    short: input.short,
    canConfirm: input.canConfirm ?? calcReady,
  };
}
