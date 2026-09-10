/**
 * CE VAULT — Slip View (Final Design)
 * Full data, no mask. No OCR status on main card.
 * UX: OCR → Extract → Calculate → Clear
 */
import type { OutgoingMessage } from '../telegram';
import { escapeTelegramHtml } from '../botSecurity';
import { showAcct, thbCard, usdt, rateCode } from './format';

export type SlipClearanceStatus = 'CLEARED' | 'PENDING' | 'FAILED';

export type SlipClearanceLine = {
  settlementId: string;
  depositThb: number;
  rate: number;
  expectedUsdt: number;
  clearedUsdt: number;
  deltaUsdt: number;
  status: 'MATCHED' | 'EXCESS' | 'SHORT' | 'PENDING' | 'FAILED';
};

export type SlipViewModel = {
  slipId: string;
  short: string;
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
  lines: SlipClearanceLine[];
  confidence: number | null;
  operator: string | null;
};

function esc(s: unknown): string {
  return escapeTelegramHtml(s);
}

function money2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function deltaLabel(d: number): string {
  const v = money2(d);
  const abs = usdt(Math.abs(v));
  if (Math.abs(v) < 0.01) return `+${abs}`;
  return v > 0 ? `+${abs}` : `−${abs}`;
}

function progressBar(pct: number, len = 16): string {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const filled = Math.round((p / 100) * len);
  return `${'█'.repeat(filled)}${'░'.repeat(len - filled)} ${p.toFixed(0)}%`;
}

export function buildSlipViewModel(input: {
  short: string;
  ledger: string;
  amount: number;
  bank: string;
  account?: string | null;
  accountName?: string | null;
  date?: string | null;
  time?: string | null;
  reference?: string | null;
  roomRate: number;
  expectedUsdt?: number | null;
  sentUsdt?: number | null;
  /** Calc-ready → CLEARED for CONFIRM (not payment settled) */
  cleared?: boolean;
  confidence?: number | null;
  operator?: string | null;
  matchedSettlementId?: string | null;
  lines?: SlipClearanceLine[];
  ocrOk?: boolean;
  duplicate?: boolean;
  audit?: { ocrVerifiedAt?: string | null; matchedAt?: string | null; clearedAt?: string | null; operator?: string | null };
}): SlipViewModel {
  void input.ocrOk;
  void input.duplicate;
  void input.audit;
  const amount = money2(input.amount);
  const roomRate = money2(input.roomRate);
  const expectedUsdt =
    input.expectedUsdt != null && Number.isFinite(Number(input.expectedUsdt))
      ? money2(Number(input.expectedUsdt))
      : roomRate > 0 && amount > 0
        ? money2(amount / roomRate)
        : 0;
  const calcReady = amount > 0 && roomRate > 0 && expectedUsdt > 0;
  // Final Design: after Calculate, treat as CLEARED (ready to CONFIRM)
  const status: SlipClearanceStatus = !calcReady
    ? 'PENDING'
    : input.cleared === false
      ? 'PENDING'
      : 'CLEARED';
  const sentUsdt =
    input.sentUsdt != null && Number.isFinite(Number(input.sentUsdt))
      ? money2(Number(input.sentUsdt))
      : status === 'CLEARED'
        ? expectedUsdt
        : 0;
  const deltaUsdt = money2(sentUsdt - expectedUsdt);
  const settlementId = input.matchedSettlementId || `ST-${input.short}`;
  const slipNumber = `#${input.short}`;
  const lines =
    input.lines && input.lines.length
      ? input.lines
      : calcReady
        ? [
            {
              settlementId,
              depositThb: amount,
              rate: roomRate,
              expectedUsdt,
              clearedUsdt: sentUsdt,
              deltaUsdt,
              status:
                Math.abs(deltaUsdt) < 0.01
                  ? ('MATCHED' as const)
                  : deltaUsdt > 0
                    ? ('EXCESS' as const)
                    : ('SHORT' as const),
            },
          ]
        : [];

  return {
    slipId: input.ledger.startsWith('SLP-') ? input.ledger : `SLP-${input.short}`,
    short: input.short,
    slipNumber,
    amount,
    currency: 'THB',
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
    clearancePercent: status === 'CLEARED' ? 100 : amount > 0 ? 50 : 0,
    settlementId,
    status,
    lines,
    confidence: input.confidence ?? null,
    operator: input.operator ?? null,
  };
}

/** Final Design main card — matches YOUNGBOSS example output. */
export function renderSlipView(model: SlipViewModel): OutgoingMessage {
  const amountStr = thbCard(model.amount);
  const rateStr = rateCode(model.roomRate);
  const expectedStr = usdt(model.expectedUsdt);
  const sentStr = usdt(model.sentUsdt);
  const deltaStr = deltaLabel(model.deltaUsdt);
  const acct = showAcct(model.account);
  const name = (model.accountName || '—').trim() || '—';
  const dateStr = model.dateLabel || '—';
  const timeStr = model.time || '—';
  const ref = model.reference || '—';

  const box = [
    '╔══════════════════════╗',
    '║  ◈ CE VAULT          ║',
    `║  SLIP ${String(model.slipNumber).padEnd(16)}║`,
    '╚══════════════════════╝',
    '',
    '┌──────────────────────┐',
    `│  ${amountStr} ${model.currency}`,
    '│',
    `│  ธนาคาร: ${model.bank}`,
    `│  บัญชี: ${acct}`,
    `│  ชื่อ: ${name}`,
    `│  วันที่: ${dateStr}`,
    `│  เวลา: ${timeStr}`,
    `│  Ref: ${ref}`,
    '└──────────────────────┘',
  ].join('\n');

  const lines: string[] = [
    `<pre>${esc(box)}</pre>`,
    '',
    '<b>↓ CLEARANCE ↓</b>',
    '',
    'ฝากเข้า',
    `<b>${esc(amountStr)} ${esc(model.currency)}</b>`,
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
    `<code>${esc(progressBar(model.clearancePercent))}</code>`,
    '',
  ];

  if (model.status === 'CLEARED') {
    lines.push(`✓ เคลียร์ครบ <b>${esc(sentStr)} USDT</b>`);
  } else if (model.status === 'PENDING') {
    lines.push('⏳ กำลังเคลียร์…');
  } else {
    lines.push('❌ เคลียร์ไม่สำเร็จ');
  }

  lines.push('');
  lines.push('Settlement');
  lines.push(`<code>${esc(model.settlementId)}</code>`);

  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  if (model.status === 'CLEARED') {
    rows.push([
      { text: '✓ CONFIRM', callback_data: `slip:lock:${model.short}` },
      { text: '✎ EDIT', callback_data: `slip:edit:${model.short}` },
    ]);
  } else {
    rows.push([{ text: '⏳ PROCESSING', callback_data: 'slip:noop' }]);
    rows.push([{ text: '✎ EDIT', callback_data: `slip:edit:${model.short}` }]);
  }
  rows.push([{ text: 'DETAILS', callback_data: `slip:details:${model.short}` }]);

  return {
    text: lines.join('\n'),
    reply_markup: { inline_keyboard: rows },
  };
}

export function renderSlipCard(model: SlipViewModel): OutgoingMessage {
  return renderSlipView(model);
}

/** DETAILS — confidence only here (not on main card). */
export function renderSlipDetails(model: SlipViewModel): OutgoingMessage {
  const conf =
    model.confidence != null && Number.isFinite(model.confidence)
      ? `${Math.round(model.confidence * 10) / 10}%`
      : '—';
  const acct = showAcct(model.account);
  const text = [
    '◈ <b>SLIP DETAILS</b>',
    `<code>${esc(model.slipId)}</code>`,
    '',
    '<b>EXTRACT</b>',
    `Amount         ${esc(thbCard(model.amount))} THB`,
    `Account        <code>${esc(acct)}</code>`,
    `Name           ${esc(model.accountName || '—')}`,
    `Bank           ${esc(model.bank)}`,
    `Date           ${esc(model.dateLabel || '—')}`,
    `Time           ${esc(model.time || '—')}`,
    `Ref            <code>${esc(model.reference || '—')}</code>`,
    `Confidence     ${esc(conf)}`,
    '',
    '<b>CLEARANCE</b>',
    `Rate           ${esc(rateCode(model.roomRate))}`,
    `Expected       ${esc(usdt(model.expectedUsdt))} USDT`,
    `Sent           ${esc(usdt(model.sentUsdt))} USDT`,
    `Delta          ${esc(deltaLabel(model.deltaUsdt))} USDT`,
    `Status         ${esc(model.status)}`,
    `Settlement     <code>${esc(model.settlementId)}</code>`,
    '',
    `Operator       ${esc(model.operator || '—')}`,
  ].join('\n');

  return {
    text,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✓ CONFIRM', callback_data: `slip:lock:${model.short}` },
          { text: '✎ EDIT', callback_data: `slip:edit:${model.short}` },
        ],
        [{ text: 'BACK', callback_data: `slip:open:${model.short}` }],
      ],
    },
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
  status?: string;
  canConfirm?: boolean;
  confidence?: number | null;
  operator?: string | null;
  cleared?: boolean;
}): SlipViewModel {
  void input.currency;
  void input.status;
  void input.canConfirm;
  return buildSlipViewModel({
    short: input.short,
    ledger: input.ledger,
    amount: input.amount,
    bank: input.bank,
    account: input.account,
    accountName: input.accountName,
    date: input.date,
    time: input.time,
    reference: input.reference,
    roomRate: input.roomRate,
    expectedUsdt: input.roomRate > 0 ? money2(input.amount / input.roomRate) : null,
    sentUsdt: input.sentUsdt,
    cleared: input.cleared !== false,
    confidence: input.confidence,
    operator: input.operator,
  });
}

export function summarizeClearance(model: SlipViewModel): {
  clearedThb: number;
  totalThb: number;
  clearedUsdt: number;
  fully: boolean;
  partial: boolean;
  none: boolean;
} {
  const totalThb = model.amount;
  const clearedUsdt = model.sentUsdt;
  const fully = model.status === 'CLEARED';
  return {
    clearedThb: fully ? totalThb : 0,
    totalThb,
    clearedUsdt,
    fully,
    partial: false,
    none: !fully,
  };
}
