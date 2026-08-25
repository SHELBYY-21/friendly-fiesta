import type { OutgoingMessage } from '../telegram';
import {
  esc, ik, btn, urlBtn, displayLedger, maskAcct, thbInt, thbCard, usdt, rateCode, quoteBlock, deskUrl,
} from './format';

function msg(text: string, keyboard?: unknown): OutgoingMessage {
  return { text, reply_markup: keyboard };
}

function head(status: string, meta: string): string {
  return `◈  <b>CT</b>\n<i>[ ${status} ]  ${esc(meta)}</i>`;
}

function tape(step: 'scan' | 'in' | 'wait' | 'sent' | 'done'): string {
  const order = ['in', 'ocr', 'wait', 'sent', 'done'] as const;
  const on =
    step === 'scan' ? 'ocr' :
    step === 'in' ? 'ocr' :
    step === 'wait' ? 'wait' :
    step === 'sent' ? 'sent' : 'done';
  return order.map((s) => (s === on ? `<b>${s}</b>` : s)).join('  ');
}

export function skeletonScan(bank: string, last4: string): OutgoingMessage {
  return msg(`${head('SCAN', 'reading')}\n${tape('scan')}\n${esc(bank)}  ${esc(maskAcct(last4))}`);
}

export function skeletonRead(): OutgoingMessage {
  return msg(head('SCAN', 'matching pin'));
}

export function skeletonVault(): OutgoingMessage {
  return msg(head('VAULT', 'loading'));
}

export function skeletonSettle(ledger: string, usdtAmt: number): OutgoingMessage {
  return msg(`${head('SETTLED', 'writing out')}\n<code>${esc(displayLedger(ledger))}</code>\n${usdt(usdtAmt)} USDT`);
}

export function welcome(name: string): OutgoingMessage {
  return msg(
    [
      head('VAULT', name),
      '',
      'ส่งสลิป',
      'พิมพ์เรท  <code>36.65</code>',
      'keep เมื่อยอดถูก',
      '',
      `<a href="${deskUrl()}">desk</a>`,
    ].join('\n'),
  );
}

export function cardInReady(d: {
  review: boolean;
  thb: number;
  shouldSend: number;
  desk: number;
  mkt?: number | null;
  bank: string;
  last4: string;
  name: string | null;
  confidence: number;
  ledger: string;
  adminName: string;
  short: string;
  fresh?: boolean;
  time?: string;
}): OutgoingMessage {
  const meta = d.review ? `check  ${Math.round(d.confidence)}%` : `ready  ${Math.round(d.confidence)}%`;
  const hasDesk = d.desk > 0;
  const lines = [
    head('IN', meta),
    tape('in'),
    '',
    `<code>${esc(displayLedger(d.ledger))}</code>`,
    quoteBlock({ thb: d.thb, usdt: hasDesk ? d.shouldSend : 0, desk: d.desk, mkt: d.mkt ?? null }),
    '',
    `${esc(d.bank)}  ${esc(maskAcct(d.last4))}`,
    esc(d.name || '—'),
  ];
  if (d.time) lines.push(esc(d.time));
  if (d.fresh) lines.push(`new  ${esc(d.bank)}  ${esc(maskAcct(d.last4))}`);
  if (!hasDesk) lines.push('', 'พิมพ์เรท  <code>36.65</code>');
  const rows: Array<Array<Record<string, unknown>>> = [];
  if (hasDesk) rows.push([btn('keep', `slip:lock:${d.short}`, 'success')]);
  rows.push([btn('edit', `slip:edit:${d.short}`), btn('hold', `slip:hold:${d.short}`)]);
  rows.push([btn('undo', `slip:cancel:${d.short}`, 'danger')]);
  rows.push([urlBtn('desk', deskUrl())]);
  return msg(lines.join('\n'), ik(rows));
}

export function cardOcrWeak(d: {
  bank: string;
  last4: string;
  name: string | null;
  confidence: number;
  short: string;
  chips: number[];
}): OutgoingMessage {
  const chips = d.chips.slice(0, 2).map((n) => btn(`+${thbInt(n)}B`, `slip:amt:${d.short}:+${n}B`));
  const rows: Array<Array<ReturnType<typeof btn>>> = [];
  if (chips.length) rows.push(chips);
  rows.push([btn('retry', `slip:retry:${d.short}`), btn('undo', `slip:cancel:${d.short}`, 'danger')]);
  return msg(
    [
      head('IN', `weak  ${Math.round(d.confidence)}%`),
      '',
      `${esc(d.bank)}  ${esc(maskAcct(d.last4))}`,
      esc(d.name || '—'),
      '',
      '<code>+500B</code>',
    ].join('\n'),
    ik(rows),
  );
}

export function cardNeedUnit(d: { short: string }): OutgoingMessage {
  return msg(
    [
      head('IN', 'need unit'),
      '',
      '<code>+500B</code>',
      '<code>-13.6U</code>',
    ].join('\n'),
    ik([
      [btn('keep', `slip:unit:${d.short}:+B`, 'success'), btn('sent', `slip:unit:${d.short}:-U`, 'primary')],
      [btn('retry', `slip:cancel:${d.short}`, 'danger')],
    ]),
  );
}

export function cardPinMismatch(d: {
  slipBank: string;
  slipLast4: string;
  pinBank: string;
  pinLast4: string;
  confidence: number;
  short: string;
  lead: boolean;
}): OutgoingMessage {
  const rows: Array<Array<ReturnType<typeof btn>>> = [
    [btn('retry', `slip:retry:${d.short}`)],
    [btn('pin', 'pin:view')],
  ];
  if (d.lead) rows.push([btn('force', `slip:forceask:${d.short}`, 'danger')]);
  rows.push([btn('undo', `slip:cancel:${d.short}`, 'danger')]);
  return msg(
    [
      head('HOLD', `pin miss  ${Math.round(d.confidence)}%`),
      '',
      `slip  ${esc(d.slipBank)}  ${esc(maskAcct(d.slipLast4))}`,
      `pin   ${esc(d.pinBank)}  ${esc(maskAcct(d.pinLast4))}`,
    ].join('\n'),
    ik(rows),
  );
}

export function cardForceAsk(d: { short: string; ledger: string }): OutgoingMessage {
  return msg(
    `${head('HOLD', 'force pin')}\n<code>${esc(displayLedger(d.ledger))}</code>`,
    ik([
      [btn('keep', `slip:force:${d.short}`, 'danger')],
      [btn('undo', `slip:cancel:${d.short}`)],
    ]),
  );
}

export function cardLocked(d: {
  thb: number;
  shouldSend: number;
  desk: number;
  mkt?: number | null;
  ledger: string;
  adminName: string;
  time: string;
  short: string;
  canUndo: boolean;
  bank?: string;
  last4?: string;
  name?: string | null;
}): OutgoingMessage {
  const rows: Array<Array<Record<string, unknown>>> = [
    [btn('sent', `slip:settle:${d.short}`, 'primary')],
    [btn('edit', `slip:edit:${d.short}`), btn('hold', `slip:open:${d.short}`)],
  ];
  if (d.canUndo) rows.push([btn('undo', `slip:undo:${d.short}`, 'danger')]);
  else rows.push([btn('undo', `slip:delask:${d.short}`, 'danger')]);
  rows.push([urlBtn('desk', deskUrl())]);
  return msg(
    [
      head('LOCKED', 'รอส่ง'),
      tape('wait'),
      '',
      `<code>${esc(displayLedger(d.ledger))}</code>`,
      quoteBlock({ thb: d.thb, usdt: d.shouldSend, desk: d.desk, mkt: d.mkt ?? null }),
      '',
      d.bank ? `${esc(d.bank)}  ${esc(maskAcct(d.last4))}` : '',
      esc(d.name || d.adminName),
      '',
      'kept.',
    ].filter(Boolean).join('\n'),
    ik(rows),
  );
}

export function cardDeleteAsk(d: { ledger: string; thb: number; short: string }): OutgoingMessage {
  return msg(
    `${head('HOLD', 'delete?')}\n<code>${esc(displayLedger(d.ledger))}</code>\n${thbCard(d.thb)} THB`,
    ik([
      [btn('undo', `slip:delete:${d.short}`, 'danger')],
      [btn('keep', `slip:open:${d.short}`, 'success')],
    ]),
  );
}

export function cardSettled(d: {
  thb: number;
  usdtOut: number;
  desk: number;
  ledger: string;
  adminName: string;
  inTime: string;
  outTime: string;
  short: string;
}): OutgoingMessage {
  return msg(
    [
      head('SETTLED', 'clear'),
      '',
      `IN     ${thbCard(d.thb)} THB`,
      `OUT    <b>${usdt(d.usdtOut)} USDT</b>`,
      `DESK   <code>${rateCode(d.desk)}</code>`,
      '',
      `<code>${esc(displayLedger(d.ledger))}</code>`,
      `${esc(d.adminName)}  ${esc(d.inTime)} → ${esc(d.outTime)}`,
      '',
      'clear.',
    ].join('\n'),
    ik([
      [btn('hold', `slip:open:${d.short}`), btn('keep', `slip:copy:${d.short}`)],
      [btn('vault', 'vault:today')],
    ]),
  );
}

export function cardDetail(d: {
  ledger: string;
  thb: number;
  usdtOut: number | null;
  desk: number;
  mkt: number | null;
  usd: number | null;
  bank: string;
  last4: string;
  name: string | null;
  pinMatch: boolean;
  confidence: number | null;
  adminIn: string;
  inTime: string;
  outTime: string | null;
  adminOut: string | null;
  note: string | null;
  short: string;
}): OutgoingMessage {
  return msg(
    [
      head('IN', displayLedger(d.ledger)),
      '',
      `IN     ${thbCard(d.thb)} THB`,
      `OUT    ${d.usdtOut != null ? `${usdt(d.usdtOut)} USDT` : '—'}`,
      `DESK   <code>${rateCode(d.desk)}</code>   MKT <code>${rateCode(d.mkt)}</code>`,
      `${esc(d.bank)}  ${esc(maskAcct(d.last4))}`,
      esc(d.name || '—'),
      `pin    ${d.pinMatch ? 'match' : 'miss'}`,
      `ocr    ${d.confidence != null ? `${Math.round(d.confidence)}%` : '—'}`,
      esc(d.adminIn),
      `in     ${esc(d.inTime)}`,
      `out    ${d.outTime ? esc(d.outTime) : '—'}`,
    ].join('\n'),
    ik([
      [btn('edit', `slip:note:${d.short}`), btn('keep', `slip:copy:${d.short}`)],
      [btn('vault', 'vault:today')],
    ]),
  );
}

export function unitHelp(): OutgoingMessage {
  return msg(`${head('IN', 'unit')}\n<code>+500B</code>\n<code>-13.6U</code>`);
}

export type VaultRow = {
  thb?: number;
  usdt?: number;
  time: string;
  short: string;
  pending: boolean;
};

export function vaultBanner(d: {
  mode: 'today' | 'pending' | 'all';
  dateLabel: string;
  clock: string;
  inThb: number;
  inCount: number;
  inRows: VaultRow[];
  outUsdt: number;
  outCount: number;
  outRows: VaultRow[];
  pendingUsdt: number;
  desk: number | null;
  mkt: number | null;
  pendingShorts: string[];
}): OutgoingMessage {
  const meta = d.mode === 'pending' ? `wait  ${d.inRows.length}` : `${d.dateLabel}  ${d.clock}`;
  const lines = [head('VAULT', meta), ''];

  if (d.mode === 'pending') {
    if (!d.inRows.length) {
      lines.push('today is quiet');
    } else {
      d.inRows.slice(0, 5).forEach((r, i) => {
        const n = String(i + 1).padStart(2, '0');
        lines.push(`${n}     ${thbInt(r.thb ?? 0)} THB → ${usdt(r.usdt ?? 0)} U  <code>${esc(r.short)}</code>`);
      });
      lines.push('', `due    <b>${usdt(d.pendingUsdt)} USDT</b>`);
    }
    return msg(lines.join('\n'), vaultButtons(d.pendingShorts));
  }

  if (d.inCount === 0 && d.outCount === 0) {
    lines.push('today is quiet');
    lines.push('', `due    <b>0 USDT</b>`);
    lines.push(`DESK   <code>${rateCode(d.desk)}</code>        MKT <code>${rateCode(d.mkt)}</code>`);
    return msg(lines.join('\n'), vaultButtons(d.pendingShorts));
  }

  lines.push(`IN     <b>${thbInt(d.inThb)} THB</b>    ${d.inCount}`);
  d.inRows.slice(0, 5).forEach((r, i) => {
    const n = String(i + 1).padStart(2, '0');
    const flag = r.pending ? 'wait' : 'done';
    lines.push(`${n}     ${thbInt(r.thb ?? 0)}          ${esc(r.time)}  <code>${esc(r.short)}</code>   ${flag}`);
  });
  if (d.outCount > 0) {
    lines.push('', `OUT    <b>${usdt(d.outUsdt)} USDT</b>   ${d.outCount}`);
    d.outRows.slice(0, 5).forEach((r, i) => {
      const n = String(i + 1).padStart(2, '0');
      lines.push(`${n}     ${usdt(r.usdt ?? 0)}        ${esc(r.time)}  <code>${esc(r.short)}</code>`);
    });
  }
  lines.push('', `due    <b>${usdt(d.pendingUsdt)} USDT</b>`);
  lines.push(`DESK   <code>${rateCode(d.desk)}</code>        MKT <code>${rateCode(d.mkt)}</code>`);
  if (d.desk && d.mkt) {
    const p = Math.round(d.pendingUsdt * (d.desk - d.mkt));
    lines.push(`pnl    <b>${p >= 0 ? '+' : ''}${thbInt(p)}</b>`);
  }
  return msg(lines.join('\n'), vaultButtons(d.pendingShorts));
}

function vaultButtons(pendingShorts: string[]) {
  const rows: Array<Array<Record<string, unknown>>> = [
    [btn('wait', 'vault:pending'), btn('rate', 'vault:rateask'), btn('new', 'vault:newday')],
    [urlBtn('desk', deskUrl())],
  ];
  const refs = pendingShorts.slice(0, 2);
  if (refs.length) rows.unshift(refs.map((s) => btn(s, `slip:open:${s}`)));
  return ik(rows);
}

export function cardRecent(d: {
  adminLabel: string;
  rows: Array<{ thb: number; usdt: number; desk: number; time: string; short: string; pending: boolean }>;
  inThb: number;
  outUsdt: number;
  pendingUsdt: number;
}): OutgoingMessage {
  return vaultBanner({
    mode: 'today',
    dateLabel: 'TODAY',
    clock: d.adminLabel,
    inThb: d.inThb,
    inCount: d.rows.length,
    inRows: d.rows.map((r) => ({ thb: r.thb, usdt: r.usdt, time: r.time, short: r.short, pending: r.pending })),
    outUsdt: d.outUsdt,
    outCount: d.outUsdt > 0 ? 1 : 0,
    outRows: [],
    pendingUsdt: d.pendingUsdt,
    desk: d.rows[0]?.desk ?? null,
    mkt: null,
    pendingShorts: d.rows.filter((r) => r.pending).map((r) => r.short),
  });
}

export function pinView(items: Array<{ bank: string; last4: string }>): OutgoingMessage {
  const lines = [head('VAULT', 'pin'), ''];
  if (!items.length) lines.push('pin empty');
  else items.forEach((it) => lines.push(`${esc(it.bank)}  ${esc(maskAcct(it.last4))}`));
  return msg(lines.join('\n'));
}

export function askDeskRate(current?: number | null): OutgoingMessage {
  const now = current && current > 0 ? current.toFixed(2) : '—';
  return msg(
    [
      head('RATE', 'this room'),
      '',
      `DESK   <code>${now}</code>`,
      'พิมพ์เรทห้อง 20–80 เช่น <code>36.70</code>',
      'หรือ <code>/setrate 36.70</code>',
    ].join('\n'),
  );
}

export function deskRateSet(desk: number, mkt: number | null): OutgoingMessage {
  return msg(
    [
      head('RATE', 'kept'),
      '',
      `DESK   <code>${desk.toFixed(2)}</code>`,
      `MKT    <code>${mkt && mkt > 0 ? mkt.toFixed(2) : '—'}</code>`,
      'เรทนี้ใช้กับสลิปห้องนี้',
    ].join('\n'),
  );
}

export function expiredToastCard(): OutgoingMessage {
  return msg(`${head('VAULT', 'expired')}\nretry`);
}
