// ============================================================
// CE VAULT — Fintech Enterprise Telegram UI
// TH + EN terminology, live status theme, safe HTML, WebM/Lottie-ready states.
// ============================================================
import { randomBytes } from 'crypto';
import type { OutgoingMessage } from './telegram';
import { escapeTelegramHtml } from './botSecurity';

const APP_RAW = (process.env.APP_URL || '').replace(/\/$/, '');
const APP = APP_RAW.startsWith('https://') && !APP_RAW.includes('localhost') ? APP_RAW : '';
const FEE_WARN = Number(process.env.FEE_WARNING_THRESHOLD || 3);

// ═══════════════ Design tokens (Fintech: โทนเข้ม, accent เดียว, ตัวเลข monospace) ═══════════════
const MARK = '⬢';
const BRAND = `${MARK} <b>CE VAULT</b> <i>· Secure Ledger</i>`;
const THIN = '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄';
// accent เส้นเดียว + จุดสีบอกสถานะ (แทนบล็อกเขียวรัวๆ ให้อ่านง่ายขึ้น)
const GRAD_INDIGO = '🔷 ━━━━━━━━━━━━━';
const GRAD_GOLD   = '🟡 ━━━━━━━━━━━━━';
const GRAD_GREEN  = '🟢 ━━━━━━━━━━━━━';
const GRAD_RED    = '🔴 ━━━━━━━━━━━━━';
const SIG = `<i>${MARK} CE VAULT · Verified Financial Operations</i>`;

const nf = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });
const money = (n: number) => nf.format(Number(n) || 0);
const pct = (n: number) => `${(Number(n) || 0).toFixed(2)}%`;

const SEP = '\n' + THIN + '\n';
export const escapeHtml = escapeTelegramHtml;

function mono(s: string | number | null | undefined): string {
  if (s == null) return '<code>—</code>';
  return `<code>${escapeHtml(s)}</code>`;
}
function bigAmount(n: number | null | undefined, currency = 'THB'): string {
  if (n == null) return `<b><code>—</code></b>`;
  return `<b><code>${money(n)} ${currency}</code></b>`;
}

function safe(value: string | number | null | undefined, fallback = '—'): string {
  if (value == null || value === '') return fallback;
  return escapeHtml(value);
}

type LiveStatus =
  | 'verified'
  | 'validated'
  | 'processing'
  | 'queued'
  | 'pending'
  | 'matched'
  | 'confirmed'
  | 'recorded'
  | 'settled'
  | 'completed'
  | 'failed';

const STATUS: Record<LiveStatus, string> = {
  verified: '🔍 <b>ตรวจสอบแล้ว (Verified)</b>',
  validated: '🛡 <b>ผ่านการตรวจสอบ (Validated)</b>',
  processing: '🔵 <b>กำลังประมวลผล (Processing)</b>',
  queued: '⚪ <b>เข้าคิว (Queued)</b>',
  pending: '🟡 <b>รอดำเนินการ (Pending)</b>',
  matched: '🟢 <b>ข้อมูลตรงกัน (Matched)</b>',
  confirmed: '✅ <b>ยืนยันแล้ว (Confirmed)</b>',
  recorded: '⚡ <b>บันทึกสำเร็จ (Recorded)</b>',
  settled: '🟢 <b>ชำระเสร็จ (Settled)</b>',
  completed: '🎉 <b>เสร็จสมบูรณ์ (Completed)</b>',
  failed: '🔴 <b>ล้มเหลว (Failed)</b>',
};

function statusLine(status: LiveStatus): string {
  return STATUS[status];
}

// ตาราง monospace จัดคอลัมน์ตัวเลขให้ตรงกัน (label ASCII, value ชิดขวา)
function table(rows: [string, string][], width = 15): string {
  const body = rows
    .map(([k, v]) => escapeHtml(k.padEnd(6) + String(v).padStart(width - 6)))
    .join('\n');
  return `<pre>${body}</pre>`;
}

// Ledger ID: #CE-YYYYMMDD-XXXX (XXXX = 4 ตัวแรกของ uuid) — ค้นย้อนหลังง่าย
export function refCode(txId: string): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const tail = (txId || '').replace(/-/g, '').slice(0, 4).toUpperCase() || '----';
  return `CE-${ymd}-${tail}`;
}

// Ledger ID ใหม่สำหรับดีล (สร้างตอนรับสลิป ก่อนมี txId) — คงที่ตลอดดีล
export function newLedgerRef(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = randomBytes(4).toString('hex').toUpperCase();
  return `CE-${ymd}-${rand}`;
}

// แถบ progress 5 ขั้น: รับสลิป → OCR → รอ USDT → ส่งเหรียญ → เสร็จ
type Step = 1 | 2 | 3 | 4 | 5;
function progress(current: Step): string {
  const steps = ['รับสลิป', 'Vision OCR', 'รอ USDT', 'ยืนยัน', 'เสร็จ'];
  return steps
    .map((label, i) => {
      const n = (i + 1) as Step;
      const icon = n < current ? '✅' : n === current ? '🟡' : '▫️';
      return `${icon} ${label}`;
    })
    .join('  ');
}

// tier badge ตามกำไร %
function profitTier(pctVal: number): string {
  if (pctVal >= 5) return '🏆 <b>EXCELLENT</b>';
  if (pctVal >= 2) return '💎 <b>GREAT</b>';
  if (pctVal >= 0) return '✨ <b>GOOD</b>';
  if (pctVal >= -2) return '⚠️ <b>WATCH</b>';
  return '🔻 <b>LOSS</b>';
}

// ปุ่ม inline — edit/delete เป็น callback (ใช้ได้กับทุก URL), ปุ่มลิงก์ต้อง https
function buttons(transactionId?: string): unknown {
  const rows: any[][] = [];
  if (transactionId) {
    rows.push([
      { text: '⚡ แก้ไข (Edit)', callback_data: `edit:${transactionId}` },
      { text: '🗑 ลบรายการ (Delete)', callback_data: `del:${transactionId}` },
    ]);
  }
  if (APP) {
    if (transactionId)
      rows.push([{ text: '🔎 รายละเอียด (Details) →', url: `${APP}/dashboard/transactions/${transactionId}` }]);
    rows.push([{ text: '📊 แดชบอร์ด (Dashboard)', url: `${APP}/dashboard` }]);
  }
  return rows.length ? { inline_keyboard: rows } : undefined;
}

// ═══════════════ Welcome / Onboarding ═══════════════
export function welcomeRegistered(name: string): OutgoingMessage {
  const safeName = escapeHtml(name);
  return {
    text:
      `${GRAD_INDIGO}\n` +
      `${BRAND}\n` +
      `${GRAD_INDIGO}\n` +
      `🔐 <b>ยืนยันตัวตนแล้ว (Authenticated)</b> · ${safeName}\n` +
      `${THIN}\n` +
      `🟢 <b>เข้า (IN)</b> · ส่งสลิป → Vision OCR → ตรวจบัญชี Pin → <code>/save_slip</code>\n` +
      `🔴 <b>ออก (OUT)</b> · ส่งหลักฐาน USDT → ตรวจยอด → <code>-13.6U</code>\n` +
      `📈 <b>เรทขาย (Sell Rate)</b> · <code>/rate</code> หรือ <code>/rate 35.5</code>\n` +
      `${THIN}\n` +
      `${SIG}`,
    reply_markup: buttons(),
  };
}

export function askName(): OutgoingMessage {
  return {
    text:
      `${GRAD_INDIGO}\n` +
      `${BRAND}\n` +
      `${GRAD_INDIGO}\n` +
      `🔐 <b>ตั้งค่าเจ้าหน้าที่ (Operator Setup)</b>\n` +
      `${THIN}\n` +
      `พิมพ์ชื่อที่ต้องการให้ระบบแสดง เช่น <code>แอดมิน A</code>\n` +
      `${SIG}`,
  };
}

export function registered(name: string): OutgoingMessage {
  const safeName = escapeHtml(name);
  return {
    text:
      `${GRAD_GREEN}\n` +
      `${statusLine('confirmed')}\n` +
      `${GRAD_GREEN}\n` +
      `👤 <b>เจ้าหน้าที่ (Operator)</b> · ${safeName}\n` +
      `${THIN}\n` +
      `📌 ตั้ง <b>บัญชีรับวันนี้ (Today's Receiving Accounts)</b> ด้วย <code>/pin</code> แล้วส่งสลิป\n` +
      `${SIG}`,
    reply_markup: buttons(),
  };
}

// ═══════════════ Upload progress (multi-step edit animation) ═══════════════
export function uploading(step = 0): OutgoingMessage {
  // แถบวิ่ง 4 เฟรม — bridge/webhook edit ต่อกันจะดูเหมือน progress bar
  const frames = ['🟨⬜⬜⬜⬜', '🟨🟨⬜⬜⬜', '🟨🟨🟨⬜⬜', '🟩🟩🟩🟩🟩'];
  const labels = [
    'กำลังอัปโหลด (Uploading)',
    'กำลังประมวลผล (Processing)',
    'กำลังตรวจสอบ (Validating)',
    'พร้อมดำเนินการ (Ready)',
  ];
  const states: LiveStatus[] = ['queued', 'processing', 'validated', 'verified'];
  return {
    text:
      `${BRAND}\n${THIN}\n` +
      `${statusLine(states[Math.min(step, 3)])}\n` +
      `${frames[Math.min(step, 3)]}\n` +
      `<i>${labels[Math.min(step, 3)]}...</i>`,
  };
}

export interface SlipReadyData {
  type: 'THB_DEPOSIT' | 'USDT_SEND';
  thb?: number | null;
  date?: string | null;
  time?: string | null;
  last4?: string | null;
  bank?: string | null;
  receiverName?: string | null;
  confidence?: number | null;    // ความมั่นใจ OCR 0-100
  chatRate?: number | null;      // เรตต่อกลุ่มที่ตั้งไว้
  historyLine?: string | null;   // บรรทัด Receiver History (จาก receiverBrief)
}

// แสดงความมั่นใจ OCR + สัญญาณเตือน
function confidenceLine(c?: number | null): string {
  if (c == null) return '';
  const dot = c >= 90 ? '🟢' : c >= 75 ? '🟡' : '🔴';
  return `${dot} <b>ความแม่นยำ (Confidence)</b> · ${mono(c.toFixed(1) + '%')}`;
}

export function slipReady(d: SlipReadyData): OutgoingMessage {
  if (d.type === 'USDT_SEND') {
    return {
      text:
        `${GRAD_GOLD}\n${BRAND}\n` +
        `${statusLine('pending')}\n` +
        `${progress(3)}\n${THIN}\n` +
        `🚀 <b>ส่ง USDT (Send USDT)</b> · ยืนยันยอดออก เช่น <code>-11U</code>`,
    };
  }

  // THB_DEPOSIT
  const conf = d.confidence ?? null;
  const gotAmount = d.thb != null && d.thb > 0;
  const lowConf = conf != null && conf < 90;

  // header สะท้อนความจริง: อ่านยอดไม่ได้ / ความมั่นใจต่ำ / สำเร็จ
  const header = !gotAmount
    ? '⚠️ <b>อ่านยอดไม่ชัด (OCR Unclear)</b>'
    : lowConf
      ? '⚠️ <b>อ่านไม่ชัด (OCR Unclear)</b>'
      : '🔍 <b>Vision OCR ตรวจสอบแล้ว (Verified)</b>';

  const detail: string[] = [];
  if (gotAmount) detail.push(`💵 <b>ยอดเงิน (Amount)</b> · ${bigAmount(d.thb!, 'THB')}`);
  if (d.receiverName) detail.push(`👤 <b>ผู้รับ (Receiver)</b> · ${mono(d.receiverName)}`);
  if (d.last4 || d.bank)
    detail.push(`🏦 <b>ธนาคาร (Bank)</b> · ${mono(d.bank ?? '—')}  🔢 <b>เลขท้าย (Last 4)</b> · ${mono(d.last4 ?? '—')}`);
  if (d.date) detail.push(`📆 <b>วันที่ (Date)</b> · ${mono(d.date)}`);
  if (d.time) detail.push(`📅 <b>เวลา (Time)</b> · ${mono(d.time)}`);
  const cLine = confidenceLine(conf);
  if (cLine) detail.push(cLine);

  const canAuto = !!(d.chatRate && gotAmount);
  const usdtAuto = canAuto ? d.thb! / d.chatRate! : 0;

  let ask: string;
  if (!gotAmount) {
    // OCR อ่านยอดไม่ได้ → ต้องให้พิมพ์ยอด+เรตเอง (ห้าม fallback 5000)
    ask = `ตรวจยอดแล้วใช้ <code>/save_slip +500B</code>`;
  } else if (canAuto) {
    ask =
      `🧮 <code>${money(d.thb!)} ÷ ${money(d.chatRate!)} = ${money(usdtAuto)} USDT</code>\n` +
      `ตรวจข้อมูลแล้วใช้ <code>/save_slip</code>`;
  } else {
    ask = `ตั้งเรตด้วย <code>/rate 36.65</code> แล้วใช้ <code>/save_slip</code>`;
  }

  return {
    text:
      `${!gotAmount || lowConf ? GRAD_RED : GRAD_GREEN}\n` +
      `${BRAND}\n${header}\n` +
      `${progress(2)}\n${THIN}\n` +
      (detail.length ? detail.join('\n') + `\n${THIN}\n` : '') +
      (gotAmount && lowConf ? `⚠️ <i>Confidence ต่ำกว่า 90% — ต้องตรวจยอดและบัญชีก่อนยืนยัน</i>\n${THIN}\n` : '') +
      ask +
      (d.historyLine ? `\n${d.historyLine}` : ''),
  };
}

// ═══════════════ รูปแบบการพิมพ์ยอด (ระบุชัดเจน ไม่ให้บอทเดา) ═══════════════
const FORMAT_HINT =
  `🟢 <b>+500B</b>   เข้า <i>(THB IN)</i>\n` +
  `🔴 <b>-13.6U</b>  ออก <i>(USDT OUT)</i>\n` +
  `<i>รวมกันได้ · เขียนเต็มก็ได้:</i>  <code>+500B -13.6U</code>  ·  <code>+500THB -13.6USDT</code>`;

/** เลขลอยๆ ไม่ระบุสกุล → บอทไม่เดา ขอรูปแบบที่ชัดเจน */
export function amountFormatHelp(): OutgoingMessage {
  return {
    text:
      `${GRAD_GOLD}\n` +
      `⚠️ <b>รูปแบบยอดไม่ถูกต้อง (Invalid Amount Format)</b>\n` +
      `${THIN}\n` +
      `ระบบไม่เดายอด — ต้องใส่เครื่องหมาย + / − และสกุล B / U\n` +
      `${THIN}\n` +
      FORMAT_HINT,
  };
}

/** ทิศทางผิด (เช่น -500B หรือ +300U) */
export function wrongDirection(cur: 'THB' | 'USDT'): OutgoingMessage {
  const msg =
    cur === 'THB'
      ? `ยอด<b>บาท</b>ในดีลนี้คือเงิน<b>เข้า</b> → ใช้ <code>+500B</code>`
      : `ยอด<b>USDT</b>ในดีลนี้คือเหรียญ<b>ออก</b> → ใช้ <code>-13.6U</code>`;
  return {
    text: `${GRAD_RED}\n⚠️ <b>ทิศทางไม่ถูกต้อง (Invalid Direction)</b>\n${THIN}\n${msg}`,
  };
}

/** ตั้งยอดบาทแล้ว รอ USDT */
export function thbSetWaitUsdt(thb: number): OutgoingMessage {
  return {
    text:
      `${statusLine('recorded')}\n` +
      `💵 <b>ยอดเงิน (Amount)</b> · ${bigAmount(thb, 'THB')}\n` +
      `${THIN}\n` +
      `⌛ <b>รอ USDT (Waiting USDT)</b> · ส่งหลักฐานหรือพิมพ์ <code>-13.6U</code>`,
  };
}

/** มี USDT แต่ยังไม่รู้ยอดบาท */
export function needThb(): OutgoingMessage {
  return {
    text:
      `${GRAD_GOLD}\n` +
      `⚠️ <b>ยังไม่ทราบยอดเงิน (Amount Required)</b>\n` +
      `${THIN}\n` +
      `อ่านจากสลิปไม่ได้ — พิมพ์ยอดบาทด้วย เช่น <code>+500B -13.6U</code>`,
  };
}

// ═══════════════ v8: บันทึกทันที (การ์ดสั้น ไม่รกแชท) ═══════════════

/** สร้างเทมเพลตรายการล่าสุด (ready-to-send) จาก RecentPair[] */
export function recentListTemplate(pairs: any[], adminMentions?: string): OutgoingMessage {
  if (!pairs || pairs.length === 0) {
    return { text: `${GRAD_INDIGO}\n${BRAND}\n${THIN}\n🧾 <b>รายการล่าสุด (Recent Transactions)</b>\n<i>ยังไม่มีรายการ</i>` };
  }
  const header = `${GRAD_INDIGO}\n${BRAND}\n🧾 <b>รายการล่าสุด (Recent Transactions)</b> · ${pairs.length}\n${THIN}\n`;
  const lines = pairs.map((p, i) => {
    const state = p.gapMin == null ? '🟡 Pending' : `🟢 Settled · ${Number(p.gapMin) || 0}m`;
    return `\n${i + 1}. ${mono(p.time)} · ${bigAmount(p.thb, 'THB')} → ${bigAmount(p.usdt, 'USDT')} · <i>${state}</i>`;
  });
  const footer = `${SEP}👤 <b>ผู้ดูแล (Operator)</b> · ${adminMentions || '<i>Unassigned</i>'}`;
  const hint = `${SEP}<i>ตัวอย่าง:</i> <code>/confirm 1 119.05</code> · Reply เพื่อดำเนินการ`;
  return { text: header + lines.join('') + footer + hint };
}

/** Live workflow cards (single live message lifecycle) */
export function liveInitial(ledgerRef: string, adminName?: string): OutgoingMessage {
  return {
    text:
      `${BRAND}\n${THIN}\n` +
      `${statusLine('processing')}\n` +
      `🧾 <b>อ้างอิง (Reference)</b> · ${mono(ledgerRef)}` +
      `${adminName ? `\n👤 <b>ผู้ดูแล (Operator)</b> · ${mono(adminName)}` : ''}`,
  };
}

export function liveOcrUpdate(opts: {
  ledgerRef: string;
  thb?: number | null;
  receiver?: string | null;
  bank?: string | null;
  time?: string | null;
  confidence?: number | null;
  sellRate?: number | null;
  marketRate?: number | null;
  shouldSend?: number | null;
}): OutgoingMessage {
  const parts: string[] = [];
  parts.push(BRAND);
  parts.push('⌛ <b>รอ USDT (Waiting USDT)</b>');
  parts.push(THIN);
  parts.push(`🧾 <b>อ้างอิง (Reference)</b> · ${mono(opts.ledgerRef)}`);
  parts.push(`💵 <b>ยอดเงิน (Amount)</b> · ${opts.thb != null ? bigAmount(opts.thb, 'THB') : mono('—')}`);
  if (opts.receiver) parts.push(`👤 <b>ผู้รับ (Receiver)</b> · ${mono(opts.receiver)}`);
  if (opts.bank) parts.push(`🏦 <b>ธนาคาร (Bank)</b> · ${mono(opts.bank)}`);
  if (opts.time) parts.push(`📅 <b>เวลา (Time)</b> · ${mono(opts.time)}`);
  if (opts.confidence != null) parts.push(`🎯 <b>ความแม่นยำ (Confidence)</b> · ${mono(opts.confidence.toFixed(1) + '%')}`);
  if (opts.sellRate != null) {
    parts.push(`📈 <b>เรทขาย (Sell Rate)</b> · ${mono(opts.sellRate)}`);
    parts.push(`📉 <b>เรทซื้อ (Buy Rate)</b> · ${mono(opts.marketRate ?? '—')}`);
  }
  if (opts.shouldSend != null) parts.push(`🎯 <b>ต้องส่ง (Should Send)</b> · ${bigAmount(opts.shouldSend, 'USDT')}`);
  return { text: parts.join('\n') };
}

export function liveCompleted(opts: {
  ledgerRef: string;
  thb: number;
  usdt: number;
  profitThb: number;
  remaining: number;
  todayTotalThb?: number;
}): OutgoingMessage {
  const s = `${BRAND}\n${statusLine('completed')}\n${THIN}\n` +
    `🧾 <b>อ้างอิง (Reference)</b> · ${mono(opts.ledgerRef)}\n` +
    `🟢 <b>เข้า (IN)</b> · ${bigAmount(opts.thb, 'THB')}\n` +
    `🔴 <b>ออก (OUT)</b> · ${bigAmount(opts.usdt, 'USDT')}\n` +
    `💰 <b>กำไร (Profit)</b> · ${bigAmount(opts.profitThb, 'THB')}\n` +
    `⌛ <b>คงเหลือ (Remaining)</b> · ${bigAmount(opts.remaining, 'USDT')}\n` +
    `${opts.todayTotalThb != null ? `📊 <b>สรุปวันนี้ (Today Summary)</b> · ${bigAmount(opts.todayTotalThb, 'THB')}` : ''}`;
  return { text: s };
}

export function liveRefreshPlaceholder(transactionId: string): OutgoingMessage {
  return {
    text: `${BRAND}\n${THIN}\n${statusLine('processing')}\n🔄 <b>กำลังซิงก์ข้อมูล (Syncing)</b>\n📂 <b>รายการ (Transaction)</b> · ${mono(transactionId)}`,
  };
}

export function info(detail: string): OutgoingMessage {
  return {
    text: `${GRAD_INDIGO}\n${BRAND}\n${THIN}\nℹ️ ${escapeHtml(detail)}`,
  };
}

export function incomingRecorded(d: {
  transactionId: string;
  ledgerRef: string;
  thb: number;
  usdtOwed: number;
  sellRate: number;
  adminName: string;
  bank?: string | null;
  last4?: string | null;
  confidence?: number | null;
  /** รายการเข้าวันนี้ทั้งหมด (หลังบันทึกรายนี้แล้ว) */
  todayIncoming?: { time: string; date: string; thb: number }[];
  todayTotalThb?: number;
}): OutgoingMessage {
  const conf = d.confidence != null ? ` · 🎯 ${d.confidence.toFixed(0)}%` : '';
  const list = d.todayIncoming ?? [];
  const total = d.todayTotalThb ?? d.thb;
  const lines = list
    .map((e, i) => `${i + 1}. ${safe(e.time)} ${safe(e.date)} · ${money(e.thb)} THB`)
    .join('\n');

  return {
    text:
      `${statusLine('recorded')}\n` +
      `🟢 <b>เข้า (IN)</b> · ${bigAmount(d.thb, 'THB')}${conf}\n` +
      `🎯 <b>ต้องส่ง (Should Send)</b> · ${bigAmount(d.usdtOwed, 'USDT')}\n` +
      `📈 <b>เรทขาย (Sell Rate)</b> · ${mono(d.sellRate)} THB / USDT\n` +
      (d.last4 ? `🏦 <b>ธนาคาร (Bank)</b> · ${mono(d.bank)}  🔢 <b>เลขท้าย (Last 4)</b> · ${mono(d.last4)}\n` : '') +
      `🧾 <b>อ้างอิง (Reference)</b> · ${mono(d.ledgerRef)}\n` +
      `👤 <b>ผู้ดูแล (Operator)</b> · ${mono(d.adminName)}\n` +
      `📈 <b>ปริมาณวันนี้ (Today Volume)</b> · ${bigAmount(total, 'THB')}\n` +
      (lines ? `${lines}\n` : '') +
      `⌛ <i>รอหลักฐาน USDT และยอดรูปแบบ -13.6U</i>`,
    reply_markup: buttons(d.transactionId),
  };
}

export function outgoingRecorded(d: {
  transactionId: string;
  ledgerRef: string;
  usdt: number;
  adminName: string;
  shouldSendUsdt: number;
  remainingUsdt: number;
}): OutgoingMessage {
  const done = d.remainingUsdt <= 0.009;
  const over = Math.max(0, -d.remainingUsdt);
  const short = Math.max(0, d.remainingUsdt);
  return {
    text:
      `${done ? statusLine('settled') : statusLine('pending')}\n` +
      `🔴 <b>ออก (OUT)</b> · ${bigAmount(d.usdt, 'USDT')}\n` +
      `🎯 <b>ต้องส่ง (Should Send)</b> · ${bigAmount(d.shouldSendUsdt, 'USDT')}\n` +
      `⌛ <b>คงเหลือ (Remaining)</b> · ${bigAmount(Math.max(0, d.remainingUsdt), 'USDT')}\n` +
      `📊 <b>ส่วนต่าง (Variance)</b> · เกิน ${mono(money(over))} / ขาด ${mono(short <= 0.009 ? '—' : money(short))}\n` +
      `🧾 <b>อ้างอิง (Reference)</b> · ${mono(d.ledgerRef)}\n` +
      `👤 <b>ผู้ดูแล (Operator)</b> · ${mono(d.adminName)}`,
    reply_markup: buttons(d.transactionId),
  };
}

/** สลิปอ่านยอดไม่ชัด → ขอให้พิมพ์ +ยอด (สั้นที่สุด ไม่รก) */
export function slipUnclear(_guess?: number | null): OutgoingMessage {
  return {
    text:
      `${GRAD_RED}\n⚠️ <b>อ่านยอดไม่ชัด</b>\n<i>(OCR Unclear)</i>\n${THIN}\n` +
      `ระบบจะไม่เดายอด โปรดตรวจสลิปแล้วพิมพ์ยอดจริง เช่น <code>+500B</code>`,
  };
}

export function accountMismatch(detail?: string): OutgoingMessage {
  return {
    text:
      `${GRAD_RED}\n` +
      `⚠️ <b>Vision อ่านได้ แต่เลขไม่ตรงบัญชี</b>\n` +
      `<i>(Account Mismatch)</i>\n` +
      `${THIN}\n` +
      `${detail ? `${escapeHtml(detail)}\n` : ''}` +
      `🛡 <b>หยุดการบันทึกไว้แล้ว (Validation Blocked)</b>\n` +
      `<i>ตรวจธนาคาร เลขท้าย และบัญชีที่ปักหมุดก่อนลองใหม่</i>`,
  };
}

export function ocrUnclear(confidence?: number | null, instruction?: string): OutgoingMessage {
  return {
    text:
      `${GRAD_RED}\n` +
      `⚠️ <b>อ่านยอดไม่ชัด</b>\n` +
      `<i>(OCR Unclear)</i>\n` +
      `${THIN}\n` +
      `🎯 <b>ความแม่นยำ (Confidence)</b> · ${mono(confidence == null ? 'Unknown' : `${confidence.toFixed(1)}%`)}\n` +
      `🛡 <b>ต้องตรวจสอบด้วยตนเอง (Manual Validation Required)</b>\n` +
      `${instruction ? `${escapeHtml(instruction)}\n` : ''}`,
  };
}

export function thbSlipValidated(data: {
  thb: number;
  bank: string;
  last4: string;
  confidence?: number | null;
}): OutgoingMessage {
  return {
    text:
      `${GRAD_GREEN}\n${BRAND}\n` +
      `${statusLine('matched')}\n` +
      `🛡 <b>Vision ผ่านการตรวจสอบ (Vision Passed)</b>\n` +
      `${THIN}\n` +
      `🟢 <b>เข้า (IN)</b> · ${bigAmount(data.thb, 'THB')}\n` +
      `🏦 <b>บัญชีที่ปักหมุด (Pinned Account)</b> · ${mono(data.bank)}\n` +
      `🔢 <b>เลขท้าย (Last 4)</b> · ${mono(data.last4)}\n` +
      `${confidenceLine(data.confidence)}\n` +
      `${THIN}\n✅ ตรวจข้อมูลแล้วใช้ <code>/save_slip</code>`,
  };
}

export function usdtSlipPending(data: {
  usdt: number;
  confidence?: number | null;
  lowConfidence?: boolean;
}): OutgoingMessage {
  return {
    text:
      `${data.lowConfidence ? GRAD_RED : GRAD_GOLD}\n${BRAND}\n` +
      `${statusLine('pending')}\n` +
      `${THIN}\n` +
      `🔴 <b>ออก (OUT)</b> · ${bigAmount(data.usdt, 'USDT')}\n` +
      `${confidenceLine(data.confidence)}\n` +
      `${data.lowConfidence ? '⚠️ <i>OCR ต่ำกว่า 90% — ต้องตรวจยอดจากภาพด้วยตนเอง</i>\n' : ''}` +
      `${THIN}\n✅ ยืนยันด้วย <code>-${money(data.usdt).replace(/,/g, '')}U</code> หรือพิมพ์ยอดจริง`,
  };
}

export function commandUsage(title: string, english: string, example: string, detail?: string): OutgoingMessage {
  return {
    text:
      `${GRAD_INDIGO}\n${BRAND}\n` +
      `ℹ️ <b>${escapeHtml(title)} (${escapeHtml(english)})</b>\n` +
      `${THIN}\n<code>${escapeHtml(example)}</code>` +
      `${detail ? `\n<i>${escapeHtml(detail)}</i>` : ''}`,
  };
}

export function emptyState(title: string, english: string, detail?: string): OutgoingMessage {
  return {
    text:
      `${GRAD_INDIGO}\n${BRAND}\n` +
      `📂 <b>${escapeHtml(title)} (${escapeHtml(english)})</b>\n` +
      `${THIN}\n<i>${escapeHtml(detail || 'ยังไม่มีข้อมูล')}</i>`,
  };
}

export function sectionIntro(title: string, english: string): OutgoingMessage {
  return {
    text: `${GRAD_INDIGO}\n${BRAND}\n📊 <b>${escapeHtml(title)} (${escapeHtml(english)})</b>`,
  };
}

export interface PinnedAccountItem {
  bank: string;
  last4: string;
}

export function pinnedAccounts(items: PinnedAccountItem[]): OutgoingMessage {
  const rows = items.length
    ? items.map((item, index) =>
        `${index + 1}. 🏦 ${mono(item.bank)}  🔢 ${mono(item.last4)}`,
      ).join('\n')
    : '<i>ยังไม่มีบัญชีที่ปักหมุดวันนี้</i>';
  return {
    text:
      `${GRAD_INDIGO}\n${BRAND}\n` +
      `📌 <b>บัญชีรับวันนี้</b>\n` +
      `<i>(Today's Receiving Accounts)</i>\n` +
      `${THIN}\n${rows}\n${THIN}\n` +
      `เพิ่มด้วย <code>/pin KBANK 1234567890</code>`,
  };
}

export function pinUpdated(
  action: 'pin' | 'unpin',
  bank: string,
  last4: string,
  count?: number,
): OutgoingMessage {
  const pinned = action === 'pin';
  return {
    text:
      `${pinned ? GRAD_GREEN : GRAD_GOLD}\n` +
      `${statusLine('recorded')}\n` +
      `📌 <b>${pinned ? 'ปักหมุดบัญชีแล้ว (Pinned Account)' : 'ยกเลิกปักหมุดแล้ว (Unpinned Account)'}</b>\n` +
      `${THIN}\n` +
      `🏦 <b>ธนาคาร (Bank)</b> · ${mono(bank)}\n` +
      `🔢 <b>เลขท้าย (Last 4)</b> · ${mono(last4)}\n` +
      `${count != null ? `📊 <b>บัญชีที่ปักหมุด (Pinned Accounts)</b> · ${mono(`${count}/3`)}\n` : ''}`,
  };
}

// ═══════════════ Deal flow v5: THB slip → wait USDT → confirm ═══════════════
export interface WaitUsdtData {
  thb?: number | null;
  bank?: string | null;
  last4?: string | null;
  receiverName?: string | null;
  date?: string | null;
  time?: string | null;
  confidence?: number | null;
  ledgerRef: string;
  historyLine?: string | null;
  roomRate?: number | null;
  roomName?: string | null;
  marketRate?: number | null;
}

/** การ์ดหลัง OCR สลิป THB → รอ USDT (step ② หอคอยสลิป) */
export function waitUsdt(d: WaitUsdtData): OutgoingMessage {
  const conf = d.confidence ?? null;
  const gotAmount = d.thb != null && d.thb > 0;
  const lowConf = conf != null && conf < 90;
  const header = !gotAmount || lowConf ? '⚠️ <b>อ่านยอดไม่ชัด (OCR Unclear)</b>' : '🔍 <b>Vision OCR ตรวจสอบแล้ว (Verified)</b>';

  const detail: string[] = [];
  if (gotAmount) detail.push(`💵 <b>ยอดเงิน (Amount)</b> · ${bigAmount(d.thb!, 'THB')}`);
  if (d.receiverName) detail.push(`👤 <b>ผู้รับ (Receiver)</b> · ${mono(d.receiverName)}`);
  if (d.bank || d.last4) detail.push(`🏦 <b>ธนาคาร (Bank)</b> · ${mono(d.bank)}  🔢 <b>เลขท้าย (Last 4)</b> · ${mono(d.last4)}`);
  if (d.date) detail.push(`📆 <b>วันที่ (Date)</b> · ${mono(d.date)}`);
  if (d.time) detail.push(`📅 <b>เวลา (Time)</b> · ${mono(d.time)}`);
  const cLine = confidenceLine(conf);
  if (cLine) detail.push(cLine);

  const shouldSendUsdt = d.roomRate && gotAmount ? d.thb! / d.roomRate : null;

  return {
    text:
      `${!gotAmount || lowConf ? GRAD_RED : GRAD_GREEN}\n` +
      `${BRAND}\n` +
      `${header}\n` +
      `${progress(3)}\n${THIN}\n` +
      `🧾 <b>อ้างอิง (Reference)</b> · ${mono(d.ledgerRef)}\n` +
      (detail.length ? detail.join('\n') + `\n` : '') +
      (d.roomRate ? `📈 <b>เรทขาย (Sell Rate)</b> · ${mono(money(d.roomRate))} THB / USDT\n` : '') +
      (shouldSendUsdt != null && d.roomRate
        ? `🎯 <b>ต้องส่ง (Should Send)</b> · ${bigAmount(shouldSendUsdt, 'USDT')}\n` +
          `🧮 <code>${money(d.thb!)} ÷ ${money(d.roomRate)} = ${money(shouldSendUsdt)} USDT</code>\n`
        : '') +
      (d.marketRate ? `📉 <b>เรทซื้อ (Buy Rate)</b> · ${mono(money(d.marketRate))} THB / USDT\n` : '') +
      `⌛ <b>รอ USDT (Waiting USDT)</b>\n` +
      (d.historyLine ? `${d.historyLine}\n` : ''),
  };
}

export interface DealConfirmData {
  ledgerRef: string;
  thb: number;
  usdt: number;
  buyRate: number;
  sellRate: number;
  profitThb: number;
  receiverName?: string | null;
  bank?: string | null;
  last4?: string | null;
  network?: string | null;
}

/** การ์ดยืนยันดีล (step ④) — Confirm / Edit / Cancel */
export function dealConfirm(d: DealConfirmData): OutgoingMessage {
  const up = d.profitThb >= 0;
  return {
    text:
      `${GRAD_GOLD}\n` +
      `${BRAND}\n` +
      `${statusLine('validated')}\n` +
      `${progress(4)}\n${THIN}\n` +
      `🧾 <b>อ้างอิง (Reference)</b> · ${mono(d.ledgerRef)}\n` +
      table([
        ['Amount', `${money(d.thb)} THB`],
        ['USDT', `${money(d.usdt)} USDT`],
        ['Buy', money(d.buyRate)],
        ['Sell', money(d.sellRate)],
      ]) +
      `📉 <b>เรทซื้อ (Buy Rate)</b> · ${mono(money(d.buyRate))}\n` +
      `📈 <b>เรทขาย (Sell Rate)</b> · ${mono(money(d.sellRate))}\n` +
      `${up ? '💰' : '📉'} <b>กำไรประเมิน (Estimated Profit)</b> · ${bigAmount(d.profitThb, 'THB')}\n` +
      (d.receiverName || d.last4
        ? `👤 <b>ผู้รับ (Receiver)</b> · ${mono(d.receiverName)}\n🏦 <b>ธนาคาร (Bank)</b> · ${mono(d.bank)}  🔢 <b>เลขท้าย (Last 4)</b> · ${mono(d.last4)}\n`
        : '') +
      (d.network ? `🔗 <b>เครือข่าย (Network)</b> · ${mono(d.network)}\n` : '') +
      `${THIN}\n✅ ตรวจข้อมูลแล้วกด <b>ยืนยัน (Confirm)</b>`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ ยืนยัน (Confirm)', callback_data: `dealok:${d.ledgerRef}` },
          { text: '✏️ แก้ USDT (Edit)', callback_data: 'dealedit:1' },
          { text: '✖️ ยกเลิก (Cancel)', callback_data: 'cancelop:1' },
        ],
      ],
    },
  };
}

export interface DealSuccessData {
  transactionId: string;
  ledgerRef: string;
  adminName: string;
  thb: number;
  usdt: number;
  buyRate: number;
  sellRate: number;
  profitThb: number;
  receiverName?: string | null;
  bank?: string | null;
  last4?: string | null;
}

/** การ์ดบันทึกสำเร็จ (step ⑤) */
export function dealSuccess(d: DealSuccessData): OutgoingMessage {
  const up = d.profitThb >= 0;
  return {
    text:
      `${up ? GRAD_GREEN : GRAD_RED}\n` +
      `${BRAND}\n` +
      `${statusLine('recorded')}\n` +
      `${progress(5)}\n${THIN}\n` +
      `🧾 <b>อ้างอิง (Reference)</b> · ${mono(d.ledgerRef)}\n` +
      `👤 <b>ผู้ดูแล (Operator)</b> · ${mono(d.adminName)}\n` +
      table([
        ['Amount', `${money(d.thb)} THB`],
        ['USDT', `${money(d.usdt)} USDT`],
        ['Buy', money(d.buyRate)],
        ['Sell', money(d.sellRate)],
      ]) +
      `${up ? '💰' : '📉'} <b>กำไร (Profit)</b> · ${up ? '+' : ''}${bigAmount(d.profitThb, 'THB')}\n` +
      (d.receiverName || d.last4
        ? `👤 <b>ผู้รับ (Receiver)</b> · ${mono(d.receiverName)}\n🏦 <b>ธนาคาร (Bank)</b> · ${mono(d.bank)}  🔢 <b>เลขท้าย (Last 4)</b> · ${mono(d.last4)}\n`
        : '') +
      `${SIG}`,
    reply_markup: buttons(d.transactionId),
  };
}

// ═══════════════ Brand Success Card (ส่งต่อท้ายข้อความปกติหลังดีลสำเร็จ) ═══════════════
export interface BrandCardData {
  usdt: number;
  txid?: string | null;
  network?: string | null;
  ledgerRef: string;
  transactionId?: string | null; // สำหรับสร้างลิงก์สถานะให้ลูกค้า /status/<id>
}

/** การ์ดแบรนด์ CE VAULT — TH + EN enterprise settlement card */
export function brandCard(d: BrandCardData): OutgoingMessage {
  const t = new Date().toLocaleTimeString('th-TH', { hour12: false, timeZone: 'Asia/Bangkok' });
  const shortTxid = d.txid
    ? `${d.txid.slice(0, 6)}…${d.txid.slice(-6)}`
    : null;
  return {
    text:
      `🟢 ━━━━━━━━━━━━━\n` +
      `  ${statusLine('completed')}\n` +
      `${THIN}\n` +
      `💵 <b>ยอดเงิน (Amount)</b> · ${bigAmount(d.usdt, 'USDT')}\n` +
      `${THIN}\n` +
      table([
        ...(shortTxid ? [['TXID', shortTxid] as [string, string]] : []),
        ['Network', d.network ?? 'TRC-20'],
        ['Time', t],
        ['Reference', d.ledgerRef],
      ], 24) +
      (APP && d.transactionId
        ? `🔎 <a href="${APP}/status/${encodeURIComponent(d.transactionId)}">ติดตามรายการ (Track Transaction)</a>\n`
        : '') +
      `${SIG}`,
  };
}

/** req13: OCR USDT ไม่ตรงกับที่พิมพ์เอง → บล็อกการยืนยัน ต้องตรวจสอบเอง */
export function usdtMismatch(ocrVal: number, manualVal: number): OutgoingMessage {
  return {
    text:
      `${GRAD_RED}\n` +
      `⚠️ <b>ยอดไม่ตรงกัน (Amount Mismatch)</b>\n` +
      `${THIN}\n` +
      table([
        ['Vision', `${money(ocrVal)} USDT`],
        ['Manual', `${money(manualVal)} USDT`],
        ['Variance', `${money(Math.abs(ocrVal - manualVal))} USDT`],
      ]) +
      `🛡 <i>ระบบระงับการยืนยันไว้จนกว่าจะตรวจสอบแล้ว (Validated)</i>\n` +
      `ส่ง <b>สกรีนช็อต USDT</b> ที่ถูกต้องอีกครั้ง หรือพิมพ์จำนวนที่ถูก\n` +
      `<i>พิมพ์</i> <code>/cancel</code> <i>เพื่อยกเลิก</i>`,
  };
}

// ═══════════════ Confirm before commit (ลดส่งผิด) ═══════════════
export function confirmDeposit(thb: number, usdt: number, rate: number): OutgoingMessage {
  return {
    text:
      `${GRAD_GOLD}\n` +
      `${BRAND}\n${statusLine('validated')}\n` +
      `${progress(3)}\n${THIN}\n` +
      `🟢 <b>เข้า (IN)</b> · ตรวจข้อมูลก่อนบันทึก\n` +
      table([
        ['Amount', `${money(thb)} THB`],
        ['USDT', `${money(usdt)} USDT`],
        ['Sell', money(rate)],
      ]) +
      `📈 <b>เรทขาย (Sell Rate)</b> · ${mono(money(rate))}\n` +
      `\n<i>กด</i> <b>ยืนยัน (Confirm)</b> <i>เพื่อบันทึก</i>`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ ยืนยัน (Confirm)', callback_data: `confirm:${usdt.toFixed(2)}` },
          { text: '✖️ ยกเลิก (Cancel)', callback_data: 'cancelop:1' },
        ],
      ],
    },
  };
}

export function confirmSend(usdt: number, holding: number): OutgoingMessage {
  return {
    text:
      `${GRAD_GOLD}\n` +
      `${BRAND}\n${statusLine('validated')}\n` +
      `${progress(4)}\n${THIN}\n` +
      `🚀 <b>ส่ง USDT (Send USDT)</b> · ตรวจข้อมูลก่อนส่ง\n` +
      table([
        ['Amount', `${money(usdt)} USDT`],
        ['Remain', `${money(holding - usdt)} USDT`],
      ], 17) +
      `\n<i>กด</i> <b>ยืนยัน (Confirm)</b> <i>เพื่อส่ง</i>`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ ยืนยันส่ง (Confirm)', callback_data: `confirmsend:${usdt.toFixed(2)}` },
          { text: '✖️ ยกเลิก (Cancel)', callback_data: 'cancelop:1' },
        ],
      ],
    },
  };
}

// ═══════════════ Rate ═══════════════
export function rateShow(
  sell: number,
  market: number,
  source?: 'binance_th' | 'manual' | 'default',
): OutgoingMessage {
  const src =
    source === 'binance_th'
      ? '🟢 <b>LIVE</b> Binance TH'
      : source === 'manual'
        ? '🟡 ตั้งเอง'
        : '⚪ ค่าเริ่มต้น';
  const spread = sell - market;
  const spreadPct = market > 0 ? (spread / market) * 100 : 0;
  return {
    text:
      `${GRAD_INDIGO}\n` +
      `${BRAND}\n💹 <b>เรทปัจจุบัน (Current Rates)</b>\n` +
      `${GRAD_INDIGO}\n` +
      `📈 <b>เรทขาย (Sell Rate)</b> · ${bigAmount(sell, 'THB / USDT')}\n` +
      `📉 <b>เรทซื้อ (Buy Rate)</b> · ${bigAmount(market, 'THB / USDT')}\n` +
      `      ${src}\n` +
      `${THIN}\n` +
      `📐 <b>ส่วนต่าง (Spread)</b> · ${bigAmount(spread, 'THB')} <i>(${pct(spreadPct)})</i>\n` +
      `${THIN}\n` +
      `<i>ตั้งเรตขาย:</i> <code>/rate 35.5</code>\n` +
      `${SIG}`,
  };
}

export function rateSet(name: string | null | undefined, sell: number, market: number): OutgoingMessage {
  return {
    text:
      `${GRAD_GREEN}\n` +
      `${statusLine('recorded')}\n` +
      `${GRAD_GREEN}\n` +
      `📈 <b>เรทขาย (Sell Rate)</b> · ${bigAmount(sell, 'THB / USDT')}\n` +
      `📉 <b>เรทซื้อ (Buy Rate)</b> · ${bigAmount(market, 'THB / USDT')}\n` +
      `${THIN}\n` +
      `👤 <i>ผู้ดูแล (Operator) · ${escapeHtml(name || 'แอดมิน')}</i>`,
  };
}

// ═══════════════ Transaction success (headline card) ═══════════════
export interface ThbSuccessData {
  transactionId: string;
  adminName: string;
  thb: number;
  usdt: number;
  netProfitThb: number;
  profitPercent: number;
  feeUsdt: number;
  feePercent: number;
  holdingUsdt: number;
}
export function thbSuccess(d: ThbSuccessData): OutgoingMessage {
  const up = d.netProfitThb >= 0;
  const feeHot = d.feePercent > FEE_WARN;
  const grad = up ? GRAD_GREEN : GRAD_RED;
  const tier = profitTier(d.profitPercent);
  const rate = d.usdt > 0 ? d.thb / d.usdt : 0;

  return {
    text:
      `${grad}\n` +
      `${BRAND}\n${statusLine('recorded')}\n` +
      `${progress(5)}\n${THIN}\n` +
      `🧾 <b>อ้างอิง (Reference)</b> · ${mono(refCode(d.transactionId))}\n` +
      `👤 <b>ผู้ดูแล (Operator)</b> · ${mono(d.adminName)} · ${tier}\n` +
      table([
        ['Amount', `${money(d.thb)} THB`],
        ['USDT', `${money(d.usdt)} USDT`],
        ['Sell', money(rate)],
      ]) +
      `📈 <b>เรทขาย (Sell Rate)</b> · ${mono(money(rate))}\n` +
      `${up ? '💰' : '📉'} <b>กำไรสุทธิ (Net Profit)</b> · ${up ? '+' : ''}${bigAmount(d.netProfitThb, 'THB')} <i>(${pct(d.profitPercent)})</i>\n` +
      `${feeHot ? '🔴' : '💸'} <b>ค่าธรรมเนียม (Fee)</b> · ${bigAmount(d.feeUsdt, 'USDT')} <i>(${pct(d.feePercent)})</i>\n` +
      `${THIN}\n` +
      `📦 <b>ยอดคงเหลือ (Holding)</b> · ${bigAmount(d.holdingUsdt, 'USDT')} 🔒\n` +
      `${SIG}`,
    reply_markup: buttons(d.transactionId),
  };
}

export interface UsdtSendData {
  transactionId: string;
  adminName: string;
  usdt: number;
  holdingUsdt: number;
}
export function usdtSendSuccess(d: UsdtSendData): OutgoingMessage {
  return {
    text:
      `${GRAD_GREEN}\n` +
      `${BRAND}\n${statusLine('settled')}\n` +
      `${progress(5)}\n${THIN}\n` +
      `🧾 <b>อ้างอิง (Reference)</b> · ${mono(refCode(d.transactionId))}\n` +
      `👤 <b>ผู้ดูแล (Operator)</b> · ${mono(d.adminName)}\n` +
      table([
        ['Sent', `${money(d.usdt)} USDT`],
        ['Remain', `${money(d.holdingUsdt)} USDT`],
      ], 17) +
      `🚀 <b>ส่ง USDT (Send USDT)</b> · ${bigAmount(d.usdt, 'USDT')}\n` +
      `${SIG}`,
    reply_markup: buttons(d.transactionId),
  };
}

// ═══════════════ Edit flow ═══════════════
export function editPrompt(_type?: 'THB_DEPOSIT' | 'USDT_SEND'): OutgoingMessage {
  return {
    text:
      `${GRAD_GOLD}\n` +
      `${BRAND}\n⚡ <b>แก้ไขรายการ (Edit Transaction)</b>\n` +
      `${THIN}\n` +
      `พิมพ์ค่าใหม่ (ระบุสกุลเสมอ):\n` +
      FORMAT_HINT + `\n` +
      `${THIN}\n` +
      `<i>ใส่เฉพาะตัวที่จะแก้ก็ได้ · พิมพ์ </i><code>/cancel</code><i> เพื่อยกเลิก</i>`,
  };
}

export interface EditSuccessData {
  transactionId: string;
  adminName: string;
  type: 'THB_DEPOSIT' | 'USDT_SEND';
  thb?: number;
  usdt: number;
  netProfitThb?: number;
  profitPercent?: number;
  feeUsdt?: number;
  feePercent?: number;
  holdingUsdt: number;
}
export function editSuccess(d: EditSuccessData): OutgoingMessage {
  const isDep = d.type === 'THB_DEPOSIT';
  const up = (d.netProfitThb ?? 0) >= 0;
  const grad = isDep ? (up ? GRAD_GREEN : GRAD_RED) : GRAD_GOLD;
  const body = isDep
    ? `💵 <b>ยอดเงิน (Amount)</b> · ${bigAmount(d.thb ?? 0, 'THB')}\n` +
      `🔴 <b>ออก (OUT)</b> · ${bigAmount(d.usdt, 'USDT')}\n` +
      `${THIN}\n` +
      `${up ? '💰' : '📉'} <b>กำไรสุทธิ (Net Profit)</b> · ${bigAmount(d.netProfitThb ?? 0, 'THB')} <i>(${pct(d.profitPercent ?? 0)})</i>\n` +
      `💸 <b>ค่าธรรมเนียม (Fee)</b> · ${bigAmount(d.feeUsdt ?? 0, 'USDT')} <i>(${pct(d.feePercent ?? 0)})</i>\n`
    : `🚀 <b>ส่ง USDT (Send USDT)</b> · ${bigAmount(d.usdt, 'USDT')}\n${THIN}\n`;

  return {
    text:
      `${grad}\n` +
      `${statusLine('recorded')}\n✏️ <b>แก้ไขแล้ว (Updated)</b> · ${isDep ? 'THB → USDT' : 'Send USDT'}\n` +
      `${THIN}\n` +
      `🧾 <b>อ้างอิง (Reference)</b> · ${mono(refCode(d.transactionId))}\n` +
      `👤 <b>ผู้ดูแล (Operator)</b> · ${mono(d.adminName)}\n` +
      body +
      `${THIN}\n` +
      `📦 <b>ยอดคงเหลือ (Holding)</b> · ${bigAmount(d.holdingUsdt, 'USDT')} 🔒\n` +
      `${SIG}`,
    reply_markup: buttons(d.transactionId),
  };
}

export function deleteSuccess(name: string, holding: number): OutgoingMessage {
  return {
    text:
      `${GRAD_RED}\n` +
      `🗑️ <b>ลบรายการแล้ว (Transaction Deleted)</b>\n` +
      `${GRAD_RED}\n` +
      `👤 <b>ผู้ดูแล (Operator)</b> · ${mono(name)}\n` +
      `📦 <b>ยอดคงเหลือ (Holding)</b> · ${bigAmount(holding, 'USDT')} 🔒\n` +
      `${SIG}`,
  };
}

export function cancelled(): OutgoingMessage {
  return { text: `${BRAND}\n⚪ <b>ยกเลิกแล้ว (Cancelled)</b>` };
}

// ═══════════════ Chat rate ═══════════════
export function chatRateSet(rate: number): OutgoingMessage {
  return {
    text:
      `${GRAD_GREEN}\n` +
      `${statusLine('recorded')}\n` +
      `${GRAD_GREEN}\n` +
      `📈 <b>เรทขาย (Sell Rate)</b> · ${bigAmount(rate, 'THB / USDT')}\n` +
      `${THIN}\n` +
      `<i>ตั้งแต่ตอนนี้ ระบบจะคำนวณ USDT ให้อัตโนมัติทุกครั้งที่ส่งสลิป</i>`,
  };
}

// ═══════════════ Ledger summary ═══════════════
export interface LedgerEntry {
  time: string;
  date?: string;
  thb: number;
  usdt: number;
}
export interface LedgerData {
  incomingList: LedgerEntry[];
  outgoingList: { time: string; usdt: number }[];
  totalThb: number;
  totalIncomingUsdt: number;
  totalOutgoingUsdt: number;
  fixedRate: number | null;
  feePercent: number;         // ค่าธรรมเนียมรวม (%) — คิดจากเฉลี่ย tx
  netProfitThb: number;
  lastAdminName: string | null;
  roomName?: string | null;   // ชื่อห้อง (กลุ่ม)
  staff?: { name: string; count: number; profitThb: number }[]; // Top Staff
  recent?: { time: string; thb: number; usdt: number; gapMin: number | null }[]; // 5 รายการล่าสุด
}

/** วันเวลาไทยเต็ม เช่น เสาร์ 25 ก.ค. 2569 02:58:05 */
function bangkokNowLabel(): string {
  return new Date().toLocaleString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Bangkok',
  });
}

export function ledgerCard(d: LedgerData): OutgoingMessage {
  const incoming = d.incomingList
    .slice(0, 10)
    .map((e) => `${mono(e.time)} · ${bigAmount(e.thb, 'THB')} → ${bigAmount(e.usdt, 'USDT')}`)
    .join('\n');
  const outgoing = d.outgoingList
    .slice(0, 10)
    .map((e) => `${mono(e.time)} · ${bigAmount(e.usdt, 'USDT')}`)
    .join('\n');

  const shouldSendUsdt = d.fixedRate ? d.totalThb / d.fixedRate : d.totalIncomingUsdt;
  const notSent = shouldSendUsdt - d.totalOutgoingUsdt;
  const notSentThb = notSent * (d.fixedRate ?? 0);
  const settlement = Math.abs(notSent) <= 0.009 ? statusLine('settled') : statusLine('pending');

  return {
    text:
      `${GRAD_INDIGO}\n` +
      `${BRAND}\n📊 <b>สรุปวันนี้ (Today Summary)</b>${d.roomName ? ` · ${safe(d.roomName)}` : ''}\n` +
      `${GRAD_INDIGO}\n` +
      `📅 <b>เวลา (Time)</b> · ${safe(bangkokNowLabel())}\n` +
      `${THIN}\n` +
      `🟢 <b>เข้า (IN)</b> · ${d.incomingList.length} รายการ\n` +
      (incoming || '<i>ยังไม่มีรายการเข้า</i>') +
      `\n${THIN}\n` +
      `🔴 <b>ออก (OUT)</b> · ${d.outgoingList.length} รายการ\n` +
      (outgoing || '<i>ยังไม่มีรายการออก</i>') +
      `\n${THIN}\n` +
      `📈 <b>ปริมาณ (Volume)</b> · ${bigAmount(d.totalThb, 'THB')}\n` +
      (d.fixedRate ? `📈 <b>เรทขาย (Sell Rate)</b> · ${bigAmount(d.fixedRate, 'THB / USDT')}\n` : '') +
      `💸 <b>ค่าธรรมเนียม (Fee)</b> · ${mono(pct(d.feePercent))}\n` +
      `\n${THIN}\n` +
      `🎯 <b>ต้องส่ง (Should Send)</b> · ${bigAmount(shouldSendUsdt, 'USDT')}\n` +
      `🚀 <b>ส่ง USDT (Send USDT)</b> · ${bigAmount(d.totalOutgoingUsdt, 'USDT')}\n` +
      `⌛ <b>คงเหลือ (Remaining)</b> · ${bigAmount(notSent, 'USDT')}` +
      (d.fixedRate ? ` <i>(${money(notSentThb)} THB)</i>` : '') +
      `\n${settlement}\n` +
      `${THIN}\n` +
      `💰 <b>กำไรสุทธิ (Net Profit)</b> · ${d.netProfitThb >= 0 ? '+' : ''}${bigAmount(d.netProfitThb, 'THB')}\n` +
      (d.lastAdminName ? `👤 <b>ผู้รับผิดชอบล่าสุด (Last Operator)</b> · ${mono(d.lastAdminName)}\n` : '') +
      (d.staff && d.staff.length
        ? `${THIN}\n👷 <b>ทีมงานเด่น (Top Staff)</b>\n` +
          d.staff
            .slice(0, 5)
            .map((s, i) => `${['🥇', '🥈', '🥉', '4.', '5.'][i]} ${safe(s.name)} · <b>${s.count}</b> รายการ · <b>${s.profitThb >= 0 ? '+' : ''}${money(s.profitThb)} THB</b>`)
            .join('\n') + '\n'
        : '') +
      (d.recent && d.recent.length
        ? `${THIN}\n🧾 <b>รายการล่าสุด (Recent Transactions)</b>\n` +
          d.recent
            .map((r) => {
              const gap = r.gapMin == null ? '🟡 Pending' : `🟢 Settled · ${r.gapMin}m`;
              return `${mono(r.time)} · ${bigAmount(r.thb, 'THB')} → ${bigAmount(r.usdt, 'USDT')} · <i>${gap}</i>`;
            })
            .join('\n') + '\n'
        : '') +
      `${SIG}`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔄 วันใหม่ (New Day)', callback_data: 'newday:1' },
          { text: '🗑 ล้างยอด (Reset)', callback_data: 'resetask:1' },
        ],
        ...(APP ? [[{ text: '📊 แดชบอร์ด (Dashboard)', url: `${APP}/dashboard` }]] : []),
      ],
    },
  };
}

// ═══════════════ เมนูคำสั่ง ═══════════════
export function menuCard(): OutgoingMessage {
  return {
    text:
      `${GRAD_INDIGO}\n` +
      `${BRAND}\n📂 <b>เมนูคำสั่ง (Command Menu)</b>\n` +
      `${THIN}\n` +
      `🛡 <b>ขั้นตอน (Validated Workflow)</b>\n` +
      `📸 สลิป THB → Vision OCR → ตรวจบัญชี Pin → ยืนยัน → บันทึก Ledger\n` +
      `${THIN}\n` +
      `<b>พิมพ์ยอด (ต้องระบุสกุลเสมอ)</b>\n` +
      FORMAT_HINT + `\n` +
      `${THIN}\n` +
      `<b>คำสั่ง (Commands)</b>\n` +
      `📊 <code>/today</code>  สรุปวันนี้ (Today Summary)\n` +
      `🧾 <code>/recent_slips 10</code>  รายการล่าสุด\n` +
      `⚡ <code>/save_slip</code>  บันทึกสลิป (Admin)\n` +
      `📌 <code>/pin</code> / <code>/unpin</code>  บัญชีรับวันนี้\n` +
      `🔄 <code>/newday</code>  เริ่มวันใหม่\n` +
      `🗑 <code>/reset</code>  ล้างยอดห้องนี้\n` +
      `📈 <code>/setrate 40</code>  เรทขาย (Sell Rate)\n` +
      `💹 <code>/rate</code>  เรทปัจจุบัน\n` +
      `🏦 <code>/receiver 6578</code>  ประวัติผู้รับ\n` +
      `✖️ <code>/cancel</code>  ยกเลิกรายการค้าง\n` +
      `${SIG}`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📊 วันนี้ (Today)', callback_data: 'menu_today:1' },
          { text: '🔄 วันใหม่ (New Day)', callback_data: 'newday:1' },
        ],
        ...(APP ? [[{ text: '📊 แดชบอร์ด (Dashboard)', url: `${APP}/dashboard` }]] : []),
      ],
    },
  };
}

// ═══════════════ Reset (hard) ═══════════════
export function resetAsk(roomName?: string | null): OutgoingMessage {
  return {
    text:
      `${GRAD_RED}\n` +
      `🗓 <b>เริ่มรอบใหม่ (Start New Cycle)${roomName ? ` · ${safe(roomName)}` : ''}?</b>\n` +
      `${THIN}\n` +
      `🧾 <b>รายการเดิม (Ledger History) จะยังอยู่ครบ</b> และยอดรอบใหม่เริ่มจากศูนย์\n` +
      `<i>ห้องอื่นไม่กระทบ · ค้นย้อนหลังได้ตาม Ledger Reference</i>`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ ยืนยัน (Confirm)', callback_data: 'resetgo:1' },
          { text: '✖️ ยกเลิก (Cancel)', callback_data: 'cancelop:1' },
        ],
      ],
    },
  };
}
export function resetDone(count: number): OutgoingMessage {
  return {
    text:
      `${GRAD_GREEN}\n` +
      `${statusLine('confirmed')}\n🔄 <b>เริ่มรอบใหม่แล้ว (New Cycle Started)</b>\n` +
      `${THIN}\n` +
      `🧾 เก็บ Ledger เดิมไว้ <b>${count} รายการ</b> · ยอดรอบใหม่เริ่มจาก 0\n` +
      `${SIG}`,
  };
}

/** ยืนยันตั้งชื่อห้อง */
export function roomNameSet(name: string): OutgoingMessage {
  return {
    text:
      `${GRAD_GREEN}\n` +
      `${statusLine('recorded')}\n🏠 <b>ตั้งชื่อห้องแล้ว (Room Updated)</b>\n` +
      `${THIN}\n` +
      `🏠 <b>ห้อง (Room)</b> · ${mono(name)}\n` +
      `<i>แสดงในแดชบอร์ด/สรุปแทนเลขห้อง</i>`,
  };
}

/** ยืนยันเริ่มวันใหม่ (day-cut) */
export function newDayStarted(atLabel: string): OutgoingMessage {
  return {
    text:
      `${GRAD_INDIGO}\n` +
      `${statusLine('confirmed')}\n🔄 <b>เริ่มวันใหม่แล้ว (New Day Started)</b>\n` +
      `${THIN}\n` +
      `📅 <b>เวลา (Time)</b> · ${mono(atLabel)}\n` +
      `<i>ยอดก่อนหน้ายังอยู่ในแดชบอร์ด/ประวัติครบ</i>\n` +
      `${SIG}`,
  };
}

// ═══════════════ Receiver History ═══════════════
export interface ReceiverCardData {
  bank: string | null;
  last4: string;
  name?: string | null;
  status?: string;
  totalTx?: number;
  totalThb?: number;
  totalUsdt?: number;
  maxThb?: number;
  lastThb?: number;
  lastAt?: string | null;   // ISO
  lastRef?: string | null;
  todayCount?: number;
  todayThb?: number;
}

const fmtDT = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('th-TH', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok',
      })
    : '-';

/** บรรทัดสรุปผู้รับ แทรกในการ์ดสลิป: เคยรับแล้ว n รายการ / บัญชีใหม่ */
export function receiverBrief(r: ReceiverCardData | null, bank: string | null, last4: string): string {
  if (!r) {
    return (
      `${THIN}\n` +
      `⚠️ <b>บัญชีใหม่ (New Receiver)</b>\n` +
      `🏦 <b>ธนาคาร (Bank)</b> · ${mono(bank)}  🔢 <b>เลขท้าย (Last 4)</b> · ${mono(last4)}\n` +
      `<i>ยังไม่เคยมีประวัติในระบบ</i>`
    );
  }
  const star = r.status === 'trusted' ? '  ⭐ <b>Trusted</b>' : r.status === 'blacklist' ? '  🚫 <b>BLACKLIST</b>' : '';
  return (
    `${THIN}\n` +
    `🏦 <b>ธนาคาร (Bank)</b> · ${mono(r.bank)}  🔢 <b>เลขท้าย (Last 4)</b> · ${mono(r.last4)}${r.name ? `\n👤 <b>ผู้รับ (Receiver)</b> · ${mono(r.name)}` : ''}${star}\n` +
    `📊 <b>ประวัติ (History)</b> · <b>${r.totalTx ?? 0} รายการ</b> · ${bigAmount(r.totalThb ?? 0, 'THB')}\n` +
    (r.todayCount ? `📈 <b>ปริมาณวันนี้ (Today Volume)</b> · <b>${r.todayCount} รายการ</b> · ${bigAmount(r.todayThb ?? 0, 'THB')}\n` : '') +
    `📅 <b>ล่าสุด (Last Activity)</b> · ${safe(fmtDT(r.lastAt))}${r.lastRef ? `  🧾 ${mono(r.lastRef)}` : ''}`
  );
}

/** การ์ดเต็มสำหรับ /receiver 6578 */
export function receiverCard(r: ReceiverCardData): OutgoingMessage {
  const star = r.status === 'trusted' ? '⭐ Trusted Receiver' : r.status === 'blacklist' ? '🚫 BLACKLIST' : '';
  const avg = r.totalTx ? (r.totalThb ?? 0) / r.totalTx : 0;
  return {
    text:
      `${GRAD_INDIGO}\n` +
      `${BRAND}\n👤 <b>ผู้รับ (Receiver)</b>\n${THIN}\n` +
      `🏦 <b>ธนาคาร (Bank)</b> · ${mono(r.bank)}\n` +
      `🔢 <b>เลขท้าย (Last 4)</b> · ${mono(r.last4)}\n` +
      (r.name ? `👤 <b>ชื่อผู้รับ (Receiver Name)</b> · ${mono(r.name)}\n` : '') +
      (star ? `${star}\n` : '') +
      table(
        [
          ['Deals', String(r.totalTx ?? 0)],
          ['Total', money(r.totalThb ?? 0)],
          ['Max', money(r.maxThb ?? 0)],
          ['Last', money(r.lastThb ?? 0)],
          ['USDT', money(r.totalUsdt ?? 0)],
          ['Avg', money(avg)],
        ],
        17,
      ) +
      `📅 <b>ล่าสุด (Last Activity)</b> · ${safe(fmtDT(r.lastAt))}\n` +
      (r.lastRef ? `🧾 <b>อ้างอิง (Reference)</b> · ${mono(r.lastRef)}\n` : '') +
      `${SIG}`,
  };
}

export function receiverNotFound(last4: string): OutgoingMessage {
  return {
    text: `${BRAND}\n${THIN}\n⚠️ <b>ไม่พบผู้รับ (Receiver Not Found)</b>\n🔢 <b>เลขท้าย (Last 4)</b> · ${mono(last4)}\n<i>บัญชีนี้ยังไม่เคยมีธุรกรรมในระบบ</i>`,
  };
}

// ═══════════════ Error ═══════════════
export function error(detail: string): OutgoingMessage {
  return {
    text:
      `${GRAD_RED}\n` +
      `${statusLine('failed')}\n⚠️ <b>ทำรายการไม่สำเร็จ (Operation Failed)</b>\n` +
      `${GRAD_RED}\n` +
      `<code>${escapeHtml(detail.slice(0, 500))}</code>\n` +
      `<i>ตรวจข้อมูลแล้วลองใหม่ หากยังไม่สำเร็จให้แจ้งผู้ดูแลระบบ</i>`,
  };
}
