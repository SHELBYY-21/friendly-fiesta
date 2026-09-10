/**
 * CE VAULT — Settlement Slip Detail (verification layer)
 * OCR VERIFIED ≠ PAYMENT CLEARED
 * Full account/name for operators (no mask). Confidence only in DETAILS.
 */
import type { OutgoingMessage } from '../telegram';
import { escapeTelegramHtml } from '../botSecurity';
import { showAcct, thbCard, usdt, rateCode, displayLedger } from './format';

export type SlipPipelineStage =
  | 'RECEIVED'
  | 'OCR_PROCESSING'
  | 'OCR_VERIFIED'
  | 'MATCHING'
  | 'CALCULATION'
  | 'CLEARANCE'
  | 'AUDIT';

export type ClearanceLineStatus = 'MATCHED' | 'EXCESS' | 'SHORT' | 'PENDING' | 'FAILED';

export type SlipClearanceLine = {
  settlementId: string;
  depositThb: number;
  rate: number;
  expectedUsdt: number;
  clearedUsdt: number;
  deltaUsdt: number;
  status: ClearanceLineStatus;
};

export type SlipAudit = {
  ocrVerifiedAt?: string | null;
  matchedAt?: string | null;
  clearedAt?: string | null;
  operator?: string | null;
};

export type SlipViewModel = {
  slipId: string;
  short: string;
  amount: number;
  currency: string;
  bank: string;
  account: string;
  accountName: string;
  dateLabel: string;
  time: string;
  reference: string;
  confidence: number | null;
  duplicate: boolean;
  ocrOk: boolean;
  roomRate: number;
  lines: SlipClearanceLine[];
  audit: SlipAudit;
  stage: SlipPipelineStage;
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

function statusMark(s: ClearanceLineStatus): string {
  switch (s) {
    case 'MATCHED':
      return '✓ MATCHED';
    case 'EXCESS':
      return '↑ EXCESS';
    case 'SHORT':
      return '↓ SHORT';
    case 'FAILED':
      return '❌ FAILED';
    default:
      return '⏳ PENDING';
  }
}

/** Aggregate clearance from lines — never treat OCR alone as cleared. */
export function summarizeClearance(model: SlipViewModel): {
  clearedThb: number;
  totalThb: number;
  clearedUsdt: number;
  fully: boolean;
  partial: boolean;
  none: boolean;
  headline: ClearanceLineStatus | 'FULLY_CLEARED' | 'PARTIALLY_CLEARED' | 'NOT_CLEARED';
} {
  const totalThb = money2(model.amount);
  const clearedThb = money2(model.lines.reduce((a, l) => a + (l.clearedUsdt > 0 || l.status === 'MATCHED' || l.status === 'EXCESS' ? l.depositThb : 0), 0));
  const clearedUsdt = money2(model.lines.reduce((a, l) => a + l.clearedUsdt, 0));
  const anyCleared = model.lines.some((l) => l.clearedUsdt > 0 || l.status === 'MATCHED' || l.status === 'EXCESS');
  const fully = anyCleared && clearedThb + 0.01 >= totalThb && totalThb > 0;
  const partial = anyCleared && !fully;
  const none = !anyCleared;
  let headline: ReturnType<typeof summarizeClearance>['headline'] = 'NOT_CLEARED';
  if (fully) headline = 'FULLY_CLEARED';
  else if (partial) headline = 'PARTIALLY_CLEARED';
  else if (model.lines.length === 1) headline = model.lines[0].status;
  return { clearedThb, totalThb, clearedUsdt, fully, partial, none, headline };
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
  confidence?: number | null;
  roomRate: number;
  /** When true, OCR fields present — still NOT payment cleared */
  ocrOk?: boolean;
  duplicate?: boolean;
  /** Optional multi-settlement allocations; empty = calculated expected only (not cleared) */
  lines?: SlipClearanceLine[];
  /** If single expected USDT known but not yet accepted/cleared */
  expectedUsdt?: number | null;
  matchedSettlementId?: string | null;
  cleared?: boolean;
  audit?: SlipAudit;
  operator?: string | null;
}): SlipViewModel {
  const amount = money2(input.amount);
  const rate = money2(input.roomRate);
  const expected =
    input.expectedUsdt != null && Number.isFinite(input.expectedUsdt)
      ? money2(input.expectedUsdt)
      : rate > 0 && amount > 0
        ? money2(amount / rate)
        : 0;

  let lines = (input.lines || []).map((l) => ({
    ...l,
    depositThb: money2(l.depositThb),
    rate: money2(l.rate),
    expectedUsdt: money2(l.expectedUsdt),
    clearedUsdt: money2(l.clearedUsdt),
    deltaUsdt: money2(l.deltaUsdt),
  }));

  if (!lines.length && amount > 0 && rate > 0) {
    const sid = input.matchedSettlementId || `ST-${input.short}`;
    const cleared = Boolean(input.cleared);
    const clearedUsdt = cleared ? expected : 0;
    const delta = money2(clearedUsdt - expected);
    let status: ClearanceLineStatus = 'PENDING';
    if (cleared) {
      if (Math.abs(delta) < 0.01) status = 'MATCHED';
      else if (delta > 0) status = 'EXCESS';
      else status = 'SHORT';
    }
    lines = [
      {
        settlementId: sid,
        depositThb: amount,
        rate,
        expectedUsdt: expected,
        clearedUsdt,
        deltaUsdt: delta,
        status,
      },
    ];
  }

  const ocrOk = Boolean(input.ocrOk ?? (amount > 0));
  const anyCleared = lines.some((l) => l.clearedUsdt > 0 || l.status === 'MATCHED' || l.status === 'EXCESS');
  const stage: SlipPipelineStage = input.duplicate
    ? 'OCR_VERIFIED'
    : anyCleared
      ? 'CLEARANCE'
      : lines.length && rate > 0
        ? 'CALCULATION'
        : ocrOk
          ? 'OCR_VERIFIED'
          : 'OCR_PROCESSING';

  return {
    slipId: input.ledger.startsWith('SLP-') ? input.ledger : `SLP-${input.short}`,
    short: input.short,
    amount,
    currency: 'THB',
    bank: input.bank || '—',
    account: String(input.account || ''),
    accountName: String(input.accountName || ''),
    dateLabel: input.date || '',
    time: input.time || '',
    reference: input.reference || '',
    confidence: input.confidence ?? null,
    duplicate: Boolean(input.duplicate),
    ocrOk,
    roomRate: rate,
    lines,
    audit: {
      ocrVerifiedAt: input.audit?.ocrVerifiedAt ?? null,
      matchedAt: input.audit?.matchedAt ?? null,
      clearedAt: input.audit?.clearedAt ?? null,
      operator: input.audit?.operator ?? input.operator ?? null,
    },
    stage,
  };
}

const SEP = '━━━━━━━━━━━━━━━━━━━━';

/** Main short card — OCR layer + clearance summary (OCR ≠ CLEARED). */
export function renderSlipCard(model: SlipViewModel): OutgoingMessage {
  const sum = summarizeClearance(model);
  const acct = showAcct(model.account);
  const when = [model.dateLabel, model.time].filter(Boolean).join(' · ') || '—';

  const ocrHead = model.ocrOk ? '✓ OCR COMPLETE' : '◌ OCR PROCESSING';
  const lines: string[] = [
    '◈ <b>CE VAULT</b>',
    `<b>SLIP</b> · ${model.ocrOk ? 'OCR VERIFIED' : 'OCR'}`,
    ocrHead,
    SEP,
    'ยอดในสลิป',
    `<b>${esc(thbCard(model.amount))} ${esc(model.currency)}</b>`,
    'บัญชีปลายทาง',
    `<code>${esc(acct)}</code>`,
    model.accountName ? esc(model.accountName) : '',
    'วันที่ / เวลา',
    esc(when),
    SEP,
  ];

  if (model.duplicate) {
    lines.push('⚠ <b>DUPLICATE</b>');
    lines.push('สลิปซ้ำในระบบ');
    lines.push(SEP);
  }

  // CALCULATION always shown when rate known — not yet clearance
  if (model.roomRate > 0 && model.amount > 0) {
    lines.push('CALCULATION');
    lines.push(`<code>${esc(thbCard(model.amount))} ÷ ${esc(rateCode(model.roomRate))}</code>`);
    const exp = model.lines[0]?.expectedUsdt ?? money2(model.amount / model.roomRate);
    lines.push(`= <b>${esc(usdt(exp))} USDT</b>`);
    lines.push(SEP);
  } else {
    lines.push('CALCULATION');
    lines.push('รอเรทห้อง');
    lines.push(SEP);
  }

  // CLEARANCE — only real cleared amounts
  lines.push('<b>CLEARANCE</b>');
  if (sum.none) {
    lines.push('ยังไม่เคลียร์ยอด');
    lines.push('<i>OCR VERIFIED ≠ PAYMENT CLEARED</i>');
  } else if (model.lines.length > 1) {
    for (const l of model.lines) {
      lines.push(`<code>${esc(l.settlementId)}</code>`);
      lines.push(`${esc(thbCard(l.depositThb))} THB → <b>${esc(usdt(l.clearedUsdt))} USDT</b>`);
      lines.push(statusMark(l.status));
    }
    lines.push(SEP);
    lines.push(`เคลียร์แล้ว  <b>${esc(thbCard(sum.clearedThb))} / ${esc(thbCard(sum.totalThb))} THB</b>`);
    lines.push(sum.fully ? '✓ FULLY CLEARED' : '⚠ PARTIALLY CLEARED');
  } else {
    const l = model.lines[0];
    lines.push(`เคลียร์แล้ว`);
    lines.push(`<b>${esc(usdt(l.clearedUsdt))} USDT</b>`);
    lines.push(`เรทที่ใช้  <code>${esc(rateCode(l.rate))}</code>`);
    lines.push(`สถานะ  ${statusMark(l.status)}`);
    if (l.status === 'MATCHED') lines.push('ยอดตรงกับ Settlement');
    lines.push(`Settlement  <code>${esc(l.settlementId)}</code>`);
  }

  lines.push(SEP);
  lines.push('Slip ID');
  lines.push(`<code>${esc(model.slipId)}</code>`);

  const canAccept = model.ocrOk && model.roomRate > 0 && model.amount > 0 && !model.duplicate;
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  if (canAccept) {
    rows.push([
      { text: '✓ ACCEPT', callback_data: `slip:lock:${model.short}` },
      { text: '✎ REVIEW', callback_data: `slip:edit:${model.short}` },
    ]);
  } else {
    rows.push([{ text: '✎ REVIEW', callback_data: `slip:edit:${model.short}` }]);
  }
  rows.push([{ text: 'DETAILS', callback_data: `slip:details:${model.short}` }]);

  return {
    text: lines.filter((x) => x !== '').join('\n'),
    reply_markup: { inline_keyboard: rows },
  };
}

/** Expanded DETAILS — OCR / MATCH / CALC / CLEARANCE / AUDIT */
export function renderSlipDetails(model: SlipViewModel): OutgoingMessage {
  const sum = summarizeClearance(model);
  const acct = showAcct(model.account);
  const conf =
    model.confidence != null && Number.isFinite(model.confidence)
      ? `${Math.round(model.confidence * 10) / 10}%`
      : '—';
  const l0 = model.lines[0];
  const lines: string[] = [
    '◈ <b>SLIP DETAILS</b>',
    `<code>${esc(model.slipId)}</code>`,
    '',
    '<b>OCR</b>',
    SEP,
    `Confidence     ${esc(conf)}`,
    `Amount         ${esc(thbCard(model.amount))} THB`,
    `Account        <code>${esc(acct)}</code>`,
    `Name           ${esc(model.accountName || '—')}`,
    `Date           ${esc(model.dateLabel || '—')}`,
    `Time           ${esc(model.time || '—')}`,
    `Reference      <code>${esc(model.reference || '—')}</code>`,
    '',
    '<b>MATCH</b>',
    SEP,
  ];
  if (!model.lines.length) {
    lines.push('Settlement     —');
  } else {
    for (const l of model.lines) {
      lines.push(`Settlement     <code>${esc(l.settlementId)}</code>`);
      lines.push(`Deposit        ${esc(thbCard(l.depositThb))} THB`);
      lines.push(`Rate           ${esc(rateCode(l.rate))}`);
      lines.push(`Expected       ${esc(usdt(l.expectedUsdt))} USDT`);
      lines.push(`Cleared        ${esc(usdt(l.clearedUsdt))} USDT`);
      lines.push(`Status         ${statusMark(l.status)}`);
      lines.push('');
    }
  }
  lines.push('<b>RESULT</b>');
  lines.push(SEP);
  if (sum.none) {
    lines.push('ยังไม่ CLEARED');
    lines.push('<i>OCR VERIFIED ≠ PAYMENT CLEARED</i>');
  } else {
    lines.push(sum.fully ? '✓ FULLY CLEARED' : sum.partial ? '⚠ PARTIALLY CLEARED' : statusMark(l0?.status || 'PENDING'));
    if (l0) lines.push(`Delta          ${esc(deltaLabel(l0.deltaUsdt))} USDT`);
    lines.push(`Cleared THB    ${esc(thbCard(sum.clearedThb))} / ${esc(thbCard(sum.totalThb))}`);
  }
  lines.push('');
  lines.push('<b>AUDIT</b>');
  lines.push(SEP);
  lines.push(`OCR verified   ${esc(model.audit.ocrVerifiedAt || '—')}`);
  lines.push(`Matched        ${esc(model.audit.matchedAt || '—')}`);
  lines.push(`Cleared        ${esc(model.audit.clearedAt || '—')}`);
  lines.push(`Operator       ${esc(model.audit.operator || '—')}`);

  return {
    text: lines.join('\n'),
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✓ ACCEPT', callback_data: `slip:lock:${model.short}` },
          { text: '✎ REVIEW', callback_data: `slip:edit:${model.short}` },
        ],
        [{ text: 'BACK', callback_data: `slip:open:${model.short}` }],
      ],
    },
  };
}

/** @deprecated use renderSlipCard */
export function renderSlipView(model: SlipViewModel): OutgoingMessage {
  return renderSlipCard(model);
}

/** Compat helper used by copy.cardInReady */
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
  void input.canConfirm;
  // Important: sentUsdt / old CLEARED status must NOT imply payment cleared after OCR
  const cleared = Boolean(input.cleared);
  return buildSlipViewModel({
    short: input.short,
    ledger: input.ledger.startsWith('#') ? `SLP-${input.short}` : input.ledger,
    amount: input.amount,
    bank: input.bank,
    account: input.account,
    accountName: input.accountName,
    date: input.date,
    time: input.time,
    reference: input.reference,
    confidence: input.confidence,
    roomRate: input.roomRate,
    ocrOk: input.amount > 0,
    expectedUsdt: input.roomRate > 0 ? money2(input.amount / input.roomRate) : null,
    cleared,
    operator: input.operator,
  });
}

export { displayLedger };
