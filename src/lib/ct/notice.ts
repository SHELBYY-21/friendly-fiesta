import type { OutgoingMessage } from '../telegram';
import { RULE } from './tokens';
import { displayLedger, maskAcct, rateCode, thbInt, usdt } from './format';

export const NOTICE_ICON = {
  dup: '⚠️',
  queue: '📌',
  done: '✅',
  alert: '⚠️',
} as const;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function boldLedger(ledger: string | null | undefined): string {
  if (!ledger) return '\u2014';
  return `<b>${esc(displayLedger(ledger))}</b>`;
}

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
    `${icon}  <b>CT</b>`,
    `<i>${opts.title}</i>`,
    RULE,
    '<b>สรุป</b>',
    ...opts.summary,
  ];
  if (opts.rates?.length) blocks.push(RULE, '<b>อัตรา</b>', ...opts.rates);
  if (opts.details?.length) blocks.push(RULE, '<b>รายละเอียด</b>', ...opts.details);
  return blocks.join('\n');
}

export function moneyLine(thb: number | null | undefined, due: number | null | undefined): string {
  const left = thb == null ? '\u2014' : `${thbInt(thb)} THB`;
  const right = due == null ? '\u2014' : `${usdt(due)} U`;
  return `<b>${left}  →  ${right}</b>`;
}

export function rateLine(desk: number | null | undefined, mkt?: number | null): string {
  return `DESK  <code>${rateCode(desk)}</code>     MKT  <code>${rateCode(mkt ?? null)}</code>`;
}

export function payeeLine(bank?: string | null, last4?: string | null, name?: string | null): string[] {
  const rows = [scanRow('ผู้รับ', 'PAYEE', `${esc(bank || '\u2014')}  ${esc(maskAcct(last4))}`)];
  if (name) rows.push(scanRow('ชื่อ', 'NAME', esc(name)));
  return rows;
}

export function cardDuplicate(ledger?: string | null): OutgoingMessage {
  return {
    text: noticeCard({
      kind: 'dup',
      title: '⚠️ ซ้ำ — สลิปนี้มีในระบบแล้ว',
      summary: ['ไม่เปิดใบใหม่'],
      details: [scanRow('เลขที่', 'REF', ledger ? boldLedger(ledger) : '\u2014'), 'ใช้การ์ดเดิม'],
    }),
  };
}

export function cardAlreadyQueued(ledger: string): OutgoingMessage {
  return {
    text: noticeCard({
      kind: 'queue',
      title: '📌 คิว — สลิปใบนี้อยู่ในคิวแล้ว',
      summary: ['ไม่สร้างรายการซ้ำ'],
      details: [scanRow('เลขที่', 'REF', boldLedger(ledger)), 'ใช้ปุ่มบนการ์ดเดิม'],
    }),
  };
}
