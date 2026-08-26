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
  const order = ['อ่านสลิป', 'ตรวจยอด', 'รอโอน', 'ส่งแล้ว', 'เสร็จ'] as const;
  const on =
    step === 'scan' ? 'อ่านสลิป' :
    step === 'in' ? 'ตรวจยอด' :
    step === 'wait' ? 'รอโอน' :
    step === 'sent' ? 'ส่งแล้ว' : 'เสร็จ';
  return order.map((s) => (s === on ? `<b>${s}</b>` : s)).join('  ');
}

export function skeletonScan(bank: string, last4: string): OutgoingMessage {
  return msg(`${head('กำลังอ่าน', 'กรุณารอสักครู่')}\n${tape('scan')}\n${esc(bank)}  ${esc(maskAcct(last4))}`);
}

export function skeletonRead(): OutgoingMessage {
  return msg(head('กำลังอ่าน', 'กำลังเทียบกับบัญชีรับวันนี้'));
}

export function skeletonVault(): OutgoingMessage {
  return msg(head('สรุปยอด', 'กำลังโหลด'));
}

export function skeletonSettle(ledger: string, usdtAmt: number): OutgoingMessage {
  return msg(`${head('โอนแล้ว', 'กำลังบันทึกยอดออก')}\n<code>${esc(displayLedger(ledger))}</code>\n${usdt(usdtAmt)} USDT`);
}

export function welcome(name: string): OutgoingMessage {
  return msg(
    [
      head('สรุปยอด', `สวัสดีคุณ ${name}`),
      '',
      'กรุณาใช้ปุ่มด้านล่างได้เลยครับ',
      '1. หมุดบัญชีรับของวันนี้',
      '2. ตั้งอัตราห้อง เช่น <code>36.70</code>',
      '3. ส่งรูปสลิป',
      '4. เมื่อยอดถูกต้อง กด <b>ยืนยัน</b> จากนั้นกด <b>บันทึกส่ง</b>',
    ].join('\n'),
  );
}

export function menuCard(): OutgoingMessage {
  return settingsCard({
    desk: null,
    mkt: null,
    pins: [],
    admins: [],
  });
}

export function settingsCard(d: {
  desk: number | null;
  mkt: number | null;
  pins: Array<{ bank: string; last4: string }>;
  admins: Array<{ name: string; role: string }>;
}): OutgoingMessage {
  const pinLine = d.pins.length
    ? d.pins.map((p) => `${esc(p.bank)} ${esc(maskAcct(p.last4))}`).join('\n')
    : 'ยังไม่มีบัญชีรับวันนี้ครับ';
  const adminLine = d.admins.length
    ? d.admins.map((a) => `${esc(a.name)}  ${esc(a.role)}`).join('\n')
    : '—';
  return msg(
    [
      head('ตั้งค่า', 'ห้องนี้'),
      '',
      `อัตราห้อง   <code>${rateCode(d.desk)}</code>`,
      `ตลาด        <code>${rateCode(d.mkt)}</code>`,
      pinLine,
      '',
      'ผู้ดูแลระบบ',
      adminLine,
      '',
      'ตั้งอัตรา: กดปุ่มอัตรา แล้วพิมพ์ตัวเลขอย่างเดียว เช่น <code>36.70</code>',
      'หรือพิมพ์ <code>/setrate 36.70</code>',
      'เพิ่มผู้ดูแล: กดปุ่มเพิ่มผู้ดูแล แล้วส่ง Telegram ID',
      'หรือพิมพ์ <code>/admin 5676959274</code>',
    ].join('\n'),
    ik([
      [btn('อัตรา', 'vault:rateask'), btn('บัญชีรับ', 'pin:view'), btn('เพิ่มผู้ดูแล', 'admin:add')],
      [btn('วันใหม่', 'vault:newday'), urlBtn('เปิดโต๊ะ', deskUrl())],
    ]),
  );
}

export function askAdminId(): OutgoingMessage {
  return msg(
    [
      head('ตั้งค่า', 'เพิ่มผู้ดูแลระบบ'),
      '',
      'กรุณาส่ง Telegram ID เป็นตัวเลขอย่างเดียวครับ',
      'ตัวอย่าง <code>5676959274</code>',
      'ตรวจสอบไอดีได้ที่ @userinfobot',
      'ข้อความอื่นในกลุ่มจะไม่ถูกอ่านเป็นไอดี',
    ].join('\n'),
  );
}

export function adminAdded(id: number, name: string): OutgoingMessage {
  return msg(`${head('ตั้งค่า', 'เพิ่มผู้ดูแลแล้ว')}\n<code>${id}</code>  ${esc(name)}\nบันทึกเรียบร้อยครับ`);
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
  const meta = d.review
    ? `กรุณาตรวจสอบ  ความมั่นใจ ${Math.round(d.confidence)}%`
    : `พร้อมบันทึก  ความมั่นใจ ${Math.round(d.confidence)}%`;
  const hasDesk = d.desk > 0;
  const lines = [
    head('เงินเข้า', meta),
    tape('in'),
    '',
    `<code>${esc(displayLedger(d.ledger))}</code>`,
    quoteBlock({ thb: d.thb, usdt: hasDesk ? d.shouldSend : 0, desk: d.desk, mkt: d.mkt ?? null }),
    '',
    `${esc(d.bank)}  ${esc(maskAcct(d.last4))}`,
    esc(d.name || '—'),
  ];
  if (d.time) lines.push(esc(d.time));
  if (d.fresh) lines.push(`บัญชีใหม่  ${esc(d.bank)}  ${esc(maskAcct(d.last4))}`);
  if (!hasDesk) lines.push('', 'กรุณาตั้งอัตราห้องก่อน เช่น <code>36.65</code>');
  const rows: Array<Array<Record<string, unknown>>> = [];
  if (hasDesk) rows.push([btn('ยืนยัน', `slip:lock:${d.short}`, 'success')]);
  rows.push([btn('แก้ไข', `slip:edit:${d.short}`), btn('พักรายการ', `slip:hold:${d.short}`)]);
  rows.push([btn('ยกเลิก', `slip:cancel:${d.short}`, 'danger')]);
  rows.push([urlBtn('เปิดโต๊ะ', deskUrl())]);
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
  rows.push([btn('ลองใหม่', `slip:retry:${d.short}`), btn('ยกเลิก', `slip:cancel:${d.short}`, 'danger')]);
  return msg(
    [
      head('แจ้งเตือน', `อ่านสลิปไม่ชัด  ความมั่นใจ ${Math.round(d.confidence)}%`),
      '',
      `${esc(d.bank)}  ${esc(maskAcct(d.last4))}`,
      esc(d.name || '—'),
      '',
      'กรุณายืนยันยอด เช่น <code>+500B</code>',
    ].join('\n'),
    ik(rows),
  );
}

export function cardNeedUnit(d: { short: string }): OutgoingMessage {
  return msg(
    [
      head('เงินเข้า', 'กรุณาระบุหน่วยเงิน'),
      '',
      'ตัวอย่างยอดเข้า  <code>+500B</code>',
      'ตัวอย่างยอดออก  <code>-13.6U</code>',
    ].join('\n'),
    ik([
      [btn('ยืนยันบาท', `slip:unit:${d.short}:+B`, 'success'), btn('ยืนยันUSDT', `slip:unit:${d.short}:-U`, 'primary')],
      [btn('ลองใหม่', `slip:cancel:${d.short}`, 'danger')],
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
    [btn('ลองใหม่', `slip:retry:${d.short}`)],
    [btn('บัญชีรับ', 'pin:view')],
  ];
  if (d.lead) rows.push([btn('บังคับ', `slip:forceask:${d.short}`, 'danger')]);
  rows.push([btn('ยกเลิก', `slip:cancel:${d.short}`, 'danger')]);
  return msg(
    [
      head('แจ้งเตือน', `บัญชีไม่ตรงกับบัญชีรับวันนี้  ความมั่นใจ ${Math.round(d.confidence)}%`),
      '',
      `บัญชีรับบนสลิป  ${esc(d.slipBank)}  ${esc(maskAcct(d.slipLast4))}`,
      `บัญชีรับของเรา   ${esc(d.pinBank)}  ${esc(maskAcct(d.pinLast4))}`,
    ].join('\n'),
    ik(rows),
  );
}

export function cardForceAsk(d: { short: string; ledger: string }): OutgoingMessage {
  return msg(
    `${head('แจ้งเตือน', 'ยืนยันบังคับรับรายการ')}\n<code>${esc(displayLedger(d.ledger))}</code>\nกรุณายืนยันหากต้องการบันทึกทั้งที่บัญชีไม่ตรงครับ`,
    ik([
      [btn('บังคับบันทึก', `slip:force:${d.short}`, 'danger')],
      [btn('ยกเลิก', `slip:cancel:${d.short}`)],
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
    [btn('บันทึกส่ง', `slip:settle:${d.short}`, 'primary')],
    [btn('แก้ไข', `slip:edit:${d.short}`), btn('พักรายการ', `slip:open:${d.short}`)],
  ];
  if (d.canUndo) rows.push([btn('ยกเลิก', `slip:undo:${d.short}`, 'danger')]);
  else rows.push([btn('ยกเลิก', `slip:delask:${d.short}`, 'danger')]);
  rows.push([urlBtn('เปิดโต๊ะ', deskUrl())]);
  return msg(
    [
      head('รอโอน', 'รอบันทึกการส่ง USDT'),
      tape('wait'),
      '',
      `<code>${esc(displayLedger(d.ledger))}</code>`,
      quoteBlock({ thb: d.thb, usdt: d.shouldSend, desk: d.desk, mkt: d.mkt ?? null }),
      '',
      d.bank ? `${esc(d.bank)}  ${esc(maskAcct(d.last4))}` : '',
      esc(d.name || d.adminName),
      '',
      'บันทึกยอดเข้าเรียบร้อยแล้วครับ',
    ].filter(Boolean).join('\n'),
    ik(rows),
  );
}

export function cardDeleteAsk(d: { ledger: string; thb: number; short: string }): OutgoingMessage {
  return msg(
    `${head('แจ้งเตือน', 'ยืนยันลบรายการ')}\n<code>${esc(displayLedger(d.ledger))}</code>\n${thbCard(d.thb)} THB\nกรุณายืนยันหากต้องการลบรายการนี้ครับ`,
    ik([
      [btn('ลบรายการ', `slip:delete:${d.short}`, 'danger')],
      [btn('เก็บไว้', `slip:open:${d.short}`, 'success')],
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
      head('โอนแล้ว', 'รายการเสร็จสมบูรณ์'),
      '',
      `เงินเข้า     ${thbCard(d.thb)} THB`,
      `เงินออก     <b>${usdt(d.usdtOut)} USDT</b>`,
      `อัตราโต๊ะ   <code>${rateCode(d.desk)}</code>`,
      '',
      `<code>${esc(displayLedger(d.ledger))}</code>`,
      `${esc(d.adminName)}  ${esc(d.inTime)} → ${esc(d.outTime)}`,
      '',
      'โอนครบแล้วครับ',
    ].join('\n'),
    ik([
      [btn('ดูรายการ', `slip:open:${d.short}`), btn('คัดลอกเลขที่', `slip:copy:${d.short}`)],
      [btn('ดูยอด', 'vault:today')],
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
      head('รายการ', displayLedger(d.ledger)),
      '',
      `เงินเข้า     ${thbCard(d.thb)} THB`,
      `เงินออก     ${d.usdtOut != null ? `${usdt(d.usdtOut)} USDT` : '—'}`,
      `อัตราโต๊ะ   <code>${rateCode(d.desk)}</code>   ตลาด <code>${rateCode(d.mkt)}</code>`,
      `${esc(d.bank)}  ${esc(maskAcct(d.last4))}`,
      esc(d.name || '—'),
      `บัญชีรับ    ${d.pinMatch ? 'ตรงกัน' : 'ไม่ตรง'}`,
      `ความมั่นใจ  ${d.confidence != null ? `${Math.round(d.confidence)}%` : '—'}`,
      esc(d.adminIn),
      `เวลาเข้า     ${esc(d.inTime)}`,
      `เวลาออก     ${d.outTime ? esc(d.outTime) : '—'}`,
    ].join('\n'),
    ik([
      [btn('หมายเหตุ', `slip:note:${d.short}`), btn('คัดลอกเลขที่', `slip:copy:${d.short}`)],
      [btn('ดูยอด', 'vault:today')],
    ]),
  );
}

export function unitHelp(): OutgoingMessage {
  return msg(`${head('เงินเข้า', 'หน่วยเงิน')}\nยอดเข้า  <code>+500B</code>\nยอดออก  <code>-13.6U</code>`);
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
  const meta = d.mode === 'pending' ? `รอโอน  ${d.inRows.length} รายการ` : `${d.dateLabel}  ${d.clock}`;
  const lines = [head('สรุปยอด', meta), ''];

  if (d.mode === 'pending') {
    if (!d.inRows.length) {
      lines.push('ขณะนี้ยังไม่มีสลิปที่ค้างโอนครับ');
    } else {
      d.inRows.slice(0, 5).forEach((r, i) => {
        const n = String(i + 1).padStart(2, '0');
        lines.push(`${n}     ${thbInt(r.thb ?? 0)} THB → ${usdt(r.usdt ?? 0)} U  <code>${esc(r.short)}</code>`);
      });
      lines.push('', `ยอดที่ต้องใช้  <b>${usdt(d.pendingUsdt)} USDT</b>`);
    }
    return msg(lines.join('\n'), vaultButtons(d.pendingShorts));
  }

  if (d.inCount === 0 && d.outCount === 0) {
    lines.push('วันนี้ยังไม่มีสลิปครับ');
    lines.push('', `ยอดที่ต้องใช้  <b>0 USDT</b>`);
    lines.push(`อัตราโต๊ะ   <code>${rateCode(d.desk)}</code>`);
    lines.push(`ตลาด        <code>${rateCode(d.mkt)}</code>`);
    return msg(lines.join('\n'), vaultButtons(d.pendingShorts));
  }

  lines.push(`เงินเข้า     <b>${thbInt(d.inThb)} THB</b>    ${d.inCount} รายการ`);
  d.inRows.slice(0, 5).forEach((r, i) => {
    const n = String(i + 1).padStart(2, '0');
    const flag = r.pending ? 'รอโอน' : 'เสร็จ';
    lines.push(`${n}     ${thbInt(r.thb ?? 0)}          ${esc(r.time)}  <code>${esc(r.short)}</code>   ${flag}`);
  });
  if (d.outCount > 0) {
    lines.push('', `เงินออก     <b>${usdt(d.outUsdt)} USDT</b>   ${d.outCount} รายการ`);
    d.outRows.slice(0, 5).forEach((r, i) => {
      const n = String(i + 1).padStart(2, '0');
      lines.push(`${n}     ${usdt(r.usdt ?? 0)}        ${esc(r.time)}  <code>${esc(r.short)}</code>`);
    });
  }
  lines.push('', `ยอดที่ต้องใช้  <b>${usdt(d.pendingUsdt)} USDT</b>`);
  lines.push(`อัตราโต๊ะ   <code>${rateCode(d.desk)}</code>`);
  lines.push(`ตลาด        <code>${rateCode(d.mkt)}</code>`);
  if (d.desk && d.mkt) {
    const p = Math.round(d.pendingUsdt * (d.desk - d.mkt));
    lines.push(`ส่วนต่าง     <b>${p >= 0 ? '+' : ''}${thbInt(p)}</b>`);
  }
  return msg(lines.join('\n'), vaultButtons(d.pendingShorts));
}

function vaultButtons(pendingShorts: string[]) {
  const rows: Array<Array<Record<string, unknown>>> = [
    [btn('รอส่ง', 'vault:pending'), btn('อัตรา', 'vault:rateask'), btn('ตั้งค่า', 'vault:set')],
    [urlBtn('เปิดโต๊ะ', deskUrl())],
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
  const lines = [head('บัญชีรับ', 'บัญชีรับของวันนี้'), ''];
  if (!items.length) {
    lines.push('ยังไม่มีบัญชีรับวันนี้ครับ');
    lines.push('กรุณาวางข้อความหมุดจากไลน์ได้เลย');
    lines.push('หรือพิมพ์ <code>/pin BBL 0989887823</code>');
    return msg(lines.join('\n'));
  }
  items.forEach((it, i) => {
    lines.push(`${i + 1}  ${esc(it.bank)}  ${esc(maskAcct(it.last4))}`);
  });
  lines.push('', 'กรุณากดยกเลิกบัญชี หากบัญชีนี้ไม่มีการใช้งานแล้ว');
  const unpins = items.slice(0, 3).map((_, i) => btn(`ยกเลิกบัญชี ${i + 1}`, `pin:unpin:${i + 1}`));
  return msg(lines.join('\n'), ik([unpins]));
}

export function askDeskRate(current?: number | null): OutgoingMessage {
  const now = current && current > 0 ? current.toFixed(2) : 'ยังไม่ตั้ง';
  return msg(
    [
      head('อัตราแลกเปลี่ยน', 'อัตราสำหรับห้องนี้'),
      '',
      `อัตราปัจจุบัน  <code>${now}</code>`,
      'กรุณาพิมพ์ตัวเลขอย่างเดียว เช่น <code>36.70</code>',
      'ข้อความอื่นในกลุ่มจะไม่ถูกอ่านเป็นอัตรา',
    ].join('\n'),
  );
}

export function deskRateSet(desk: number, mkt: number | null): OutgoingMessage {
  return msg(
    [
      head('อัตราแลกเปลี่ยน', 'บันทึกแล้ว'),
      '',
      `อัตราโต๊ะ (Desk)   <code>${desk.toFixed(2)}</code>  บาท / USDT`,
      `ตลาด              <code>${mkt && mkt > 0 ? mkt.toFixed(2) : '—'}</code>`,
      'สลิปใบใหม่จะใช้อัตรานี้ ส่วนสลิปเก่าจะไม่ถูกนำมาคิดคำนวณ',
    ].join('\n'),
  );
}

export function expiredToastCard(): OutgoingMessage {
  return msg(`${head('สรุปยอด', 'หมดอายุ')}\nปุ่มนี้หมดอายุแล้วครับ กรุณาส่งสลิปใหม่ หรือกดยอดวันนี้`);
}
