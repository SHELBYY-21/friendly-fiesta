import type { OutgoingMessage } from '../telegram';
import { displayLedger, showAcct, rateCode, thbCard, usdt } from './format';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const SEP = '━━━━━━━━━━━━━━━━━━━━';

export function boldLedger(ledger: string | null | undefined): string {
  if (!ledger) return '—';
  return `<code>${esc(displayLedger(ledger))}</code>`;
}

export type QueuedSlipInfo = {
  ledger: string;
  short?: string | null;
  thb?: number | null;
  usdt?: number | null;
  desk?: number | null;
  bank?: string | null;
  account?: string | null;
  name?: string | null;
  status?: string | null;
};

function slipButtons(short?: string | null): OutgoingMessage['reply_markup'] {
  const s = (short || '').toUpperCase();
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  if (s) {
    rows.push([
      { text: 'OPEN', callback_data: `slip:open:${s}` },
      { text: 'DETAILS', callback_data: `slip:details:${s}` },
    ]);
  }
  rows.push([{ text: 'VAULT', callback_data: 'vault:today' }]);
  return { inline_keyboard: rows };
}

export function cardDuplicate(ledger?: string | null, extra?: QueuedSlipInfo): OutgoingMessage {
  const info = extra || { ledger: ledger || '' };
  const lines = [
    '◈ <b>CE VAULT</b>',
    '<b>SLIP</b> · DUPLICATE',
    '⚠ สลิปนี้มีในระบบแล้ว',
    SEP,
    'สรุป',
    'ไม่เปิดใบใหม่ — ใช้รายการเดิม',
    SEP,
  ];
  if (info.thb != null && info.thb > 0) {
    lines.push('ยอดในสลิป');
    lines.push(`<b>${esc(thbCard(info.thb))} THB</b>`);
  }
  if (info.usdt != null && info.usdt > 0) {
    lines.push(`ต้องส่ง  <b>${esc(usdt(info.usdt))} USDT</b>`);
    if (info.desk) lines.push(`เรท  <code>${esc(rateCode(info.desk))}</code>`);
  }
  if (info.bank || info.account) {
    lines.push(`${esc(info.bank || '—')}  <code>${esc(showAcct(info.account))}</code>`);
  }
  if (info.name) lines.push(esc(info.name));
  lines.push(SEP);
  lines.push('Slip / REF');
  lines.push(boldLedger(info.ledger || ledger));
  lines.push('');
  lines.push('กด <b>OPEN</b> เพื่อกลับการ์ดเดิม');
  return {
    text: lines.filter(Boolean).join('\n'),
    reply_markup: slipButtons(info.short),
  };
}

export function cardAlreadyQueued(ledger: string, extra?: QueuedSlipInfo): OutgoingMessage {
  const info = { ledger, ...extra };
  const st = (info.status || 'IN_QUEUE').replace(/_/g, ' ');
  const lines = [
    '◈ <b>CE VAULT</b>',
    '<b>SLIP</b> · ALREADY QUEUED',
    '◆ สลิปใบนี้อยู่ในคิวแล้ว',
    SEP,
    'OCR / QUEUE',
    '✓ จับคู่รายการเดิมแล้ว',
    'ไม่สร้างรายการซ้ำ',
    SEP,
  ];
  if (info.thb != null && info.thb > 0) {
    lines.push('ยอดในสลิป');
    lines.push(`<b>${esc(thbCard(info.thb))} THB</b>`);
  }
  if (info.desk && info.thb) {
    lines.push('CALCULATION');
    lines.push(`<code>${esc(thbCard(info.thb))} ÷ ${esc(rateCode(info.desk))}</code>`);
    if (info.usdt != null) lines.push(`= <b>${esc(usdt(info.usdt))} USDT</b>`);
    lines.push('<i>OCR VERIFIED ≠ PAYMENT CLEARED</i>');
    lines.push(SEP);
  }
  if (info.bank || info.account) {
    lines.push('บัญชีปลายทาง');
    lines.push(`<code>${esc(showAcct(info.account))}</code>`);
    if (info.bank) lines.push(esc(info.bank));
    if (info.name) lines.push(esc(info.name));
    lines.push(SEP);
  }
  lines.push('สถานะคิว');
  lines.push(`<code>${esc(st)}</code>`);
  lines.push('Slip ID / REF');
  lines.push(boldLedger(info.ledger));
  lines.push('');
  lines.push('กด <b>OPEN</b> / <b>DETAILS</b> บนการ์ดนี้');
  return {
    text: lines.filter(Boolean).join('\n'),
    reply_markup: slipButtons(info.short),
  };
}

/** Keep legacy helpers used elsewhere */
export const NOTICE_ICON = {
  dup: '⚠️',
  queue: '📌',
  done: '✅',
  alert: '⚠️',
} as const;

export function scanRow(labelTh: string, labelEn: string, value: string): string {
  return `${labelTh}  <i>${labelEn}</i>\n${value}`;
}

export function noticeCard(opts: {
  kind: keyof typeof NOTICE_ICON;
  title: string;
  summary: string[];
  rates?: string[];
  details?: string[];
}): string {
  const icon = NOTICE_ICON[opts.kind];
  const blocks: string[] = [
    `${icon}  <b>CE</b>`,
    `<i>${opts.title}</i>`,
    SEP,
    '<b>สรุป</b>',
    ...opts.summary,
  ];
  if (opts.rates?.length) blocks.push(SEP, '<b>อัตรา</b>', ...opts.rates);
  if (opts.details?.length) blocks.push(SEP, '<b>รายละเอียด</b>', ...opts.details);
  return blocks.join('\n');
}

export function moneyLine(thb: number | null | undefined, due: number | null | undefined): string {
  const left = thb == null ? '—' : `${thbCard(thb)} THB`;
  const right = due == null ? '—' : `${usdt(due)} U`;
  return `<b>${left}  →  ${right}</b>`;
}

export function rateLine(desk: number | null | undefined, mkt?: number | null): string {
  return `DESK  <code>${rateCode(desk)}</code>     MKT  <code>${rateCode(mkt ?? null)}</code>`;
}

export function payeeLine(bank?: string | null, last4?: string | null, name?: string | null): string[] {
  const rows = [scanRow('ผู้รับ', 'PAYEE', `${esc(bank || '—')}  ${esc(showAcct(last4))}`)];
  if (name) rows.push(scanRow('ชื่อ', 'NAME', esc(name)));
  return rows;
}
