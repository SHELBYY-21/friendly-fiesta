import { editMessage, sendChatAction, editPhoto, type OutgoingMessage } from '../telegram';
import { renderScanPng, type StillFrame } from './cardImage';

const MIN_GAP_MS = 280;
const MAX_GAP_MS = 380;

export type AiStage =
  | 'received'
  | 'init'
  | 'ocr'
  | 'extract'
  | 'match'
  | 'security'
  | 'calc'
  | 'ledger'
  | 'done';

export type AiContext = {
  thb?: number | null;
  usdt?: number | null;
  bank?: string | null;
  last4?: string | null;
  account?: string | null;
  senderAccount?: string | null;
  senderBank?: string | null;
  balance?: number | null;
  slipType?: string | null;
  ref?: string | null;
  time?: string | null;
  date?: string | null;
  name?: string | null;
  sender?: string | null;
  channel?: string | null;
  fee?: number | null;
  confidence?: number | null;
  state?: string | null;
  live?: boolean;
};

const SWEEP: Record<AiStage, number> = {
  received: 0.12,
  init: 0.22,
  ocr: 0.38,
  extract: 0.54,
  match: 0.68,
  security: 0.78,
  calc: 0.88,
  ledger: 0.94,
  done: 1,
};

function bar(pct: number): string {
  const p = Math.max(0, Math.min(100, Math.round(pct / 10) * 10));
  const fill = Math.round(p / 10);
  return `[${'█'.repeat(fill)}${'░'.repeat(10 - fill)}] ${p}%`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
}

function money(n: number | null | undefined, d = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function field(th: string, en: string, value: string): string {
  return `> ${th} <i>(${en})</i>\n  <code>${value}</code>`;
}

function frame(stage: AiStage, ctx: AiContext): OutgoingMessage {
  const bank = ctx.bank ? esc(ctx.bank) : '—';
  const acct = ctx.account ? esc(String(ctx.account)) : ctx.last4 ? esc(String(ctx.last4)) : '—';
  const live = Boolean(ctx.live);
  const chip = live
    ? '<b>LIVE PHOTO</b> · still frame'
    : '<b>SLIP PHOTO</b> · scanning';
  const lines: string[] = ['◈  <b>CE</b>  ·  <b>AGENT (OCR)</b>', `${chip} (กำลังสแกน)`];

  const amountLine = ctx.thb != null ? field('ยอดเงิน', 'AMOUNT', `${money(ctx.thb)} THB`) : '';
  const payeeLine = (ctx.bank || ctx.account || ctx.last4 || ctx.name)
    ? field('ผู้รับ', 'PAYEE', [bank, acct !== '—' ? acct : '', ctx.name ? esc(ctx.name) : ''].filter(Boolean).join('  '))
    : '';
  const timeLine = (ctx.date || ctx.time)
    ? field('เวลา', 'TIME', [ctx.date ? esc(ctx.date) : '', ctx.time ? esc(ctx.time) : ''].filter(Boolean).join('  '))
    : '';
  const refLine = ctx.ref ? field('รหัสอ้างอิง', 'REF', esc(ctx.ref)) : '';
  const channelLine = ctx.channel ? field('ช่องทาง', 'CHANNEL', esc(ctx.channel)) : '';
  const feeLine = ctx.fee != null ? field('ค่าธรรมเนียม', 'FEE', `${money(ctx.fee)} THB`) : '';
  const ocrLine = ctx.confidence != null ? field('ความมั่นใจ', 'OCR', `${Math.round(ctx.confidence)}%`) : '';
  const payoutLine = ctx.usdt != null ? field('รอโอน', 'PAYOUT', `${money(ctx.usdt)} USDT`) : '';
  const payerLine = (ctx.sender || ctx.senderAccount)
    ? field('ผู้โอน', 'PAYER', [ctx.senderBank ? esc(ctx.senderBank) : '', ctx.senderAccount ? esc(String(ctx.senderAccount)) : '', ctx.sender ? esc(ctx.sender) : ''].filter(Boolean).join('  '))
    : '';
  const balLine = ctx.balance != null ? field('ยอดคงเหลือ', 'BALANCE', `${money(ctx.balance)} THB`) : '';
  const typeLine = ctx.slipType ? field('ประเภท', 'TYPE', esc(ctx.slipType)) : '';

  switch (stage) {
    case 'received':
      lines.push(
        '',
        '<blockquote expandable>English first',
        'Reading the still image — not the clip.',
        'กำลังอ่านภาพนิ่ง ไม่ใช่คลิป</blockquote>',
        '> boot     vision.engine',
        bar(12),
      );
      break;
    case 'init':
      lines.push('', '> init     still.frame', bar(22), '<blockquote>Scanning slip (กำลังเปิดสลิป)</blockquote>');
      break;
    case 'ocr':
      lines.push(
        '',
        '> ocr      amount / payee / ref',
        '<i>OCR Vision</i>',
        bar(42),
        '<blockquote>Reading amount / payee / reference',
        'กำลังอ่านยอด ผู้รับ รหัสอ้างอิง</blockquote>',
      );
      break;
    case 'extract':
      lines.push('', '> extract  fields', '<i>Extracting fields (ถอดรายละเอียด)</i>', bar(58));
      if (amountLine) lines.push(amountLine);
      if (timeLine) lines.push(timeLine);
      if (refLine) lines.push(refLine);
      if (channelLine) lines.push(channelLine);
      if (feeLine) lines.push(feeLine);
      if (payerLine) lines.push(payerLine);
      if (balLine) lines.push(balLine);
      if (typeLine) lines.push(typeLine);
      break;
    case 'match':
      lines.push('', '> match    pin.today', '<i>Matching pin (เทียบบัญชี)</i>', bar(72));
      if (payeeLine) lines.push(payeeLine);
      if (amountLine) lines.push(amountLine);
      if (ocrLine) lines.push(ocrLine);
      break;
    case 'security':
      lines.push('', '> security watermark / qr / pin', '<i>Security check</i>', bar(82), '<blockquote>ตรวจลายน้ำ · QR · หมุดวันนี้ (watermark · QR · today pin)</blockquote>');
      break;
    case 'calc':
      lines.push('', '> calc     desk.rate', '<i>Desk rate (เราขาย)</i>', bar(90));
      if (amountLine) lines.push(amountLine);
      if (payoutLine) lines.push(payoutLine);
      if (payeeLine) lines.push(payeeLine);
      break;
    case 'ledger':
      lines.push('', '> ledger   write', '<i>Building ledger (เขียนเลขที่)</i>', bar(95));
      if (ctx.ref) lines.push(field('เลขที่', 'REF', esc(ctx.ref)));
      break;
    case 'done':
      lines.push('', '<blockquote expandable>TRANSACTION READY (พร้อมคิว)');
      lines.push(`ยอดรับเข้า (AMOUNT)  <b>${ctx.thb != null ? money(ctx.thb, 0) : '—'}</b> THB`);
      lines.push(`ผู้รับ (PAYEE)  ${bank}  <code>${acct}</code>`);
      if (ctx.name) lines.push(esc(ctx.name));
      lines.push(`รอโอน (PAYOUT)  <b>${ctx.usdt != null ? money(ctx.usdt) : '—'}</b> USDT`);
      if (ctx.time && ctx.thb != null && ctx.usdt != null) {
        lines.push(`${esc(ctx.time)} · ${money(ctx.thb, 0)} THB → ${money(ctx.usdt)} U`);
      }
      if (ctx.ref) lines.push(`รหัส (REF)  <code>${esc(ctx.ref)}</code>`);
      if (ctx.confidence != null) lines.push(`OCR  ${Math.round(ctx.confidence)}%`);
      lines.push(`สถานะ (STATUS)  ${esc(ctx.state || 'WAIT')}`);
      lines.push('</blockquote>');
      break;
  }

  return { text: lines.filter(Boolean).join('\n') };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class AiTransition {
  private lastAt = 0;
  constructor(
    private chatId: number,
    private messageId: number,
    private live = false,
    private still: StillFrame | null = null,
  ) {}

  async pulse() {
    await sendChatAction(this.chatId, 'upload_photo');
  }

  async step(stage: AiStage, ctx: AiContext = {}): Promise<void> {
    const wait = MIN_GAP_MS + Math.floor(Math.random() * (MAX_GAP_MS - MIN_GAP_MS));
    const elapsed = Date.now() - this.lastAt;
    if (this.lastAt && elapsed < wait) await sleep(wait - elapsed);
    const merged = { ...ctx, live: this.live || ctx.live };
    const caption = frame(stage, merged);
    const png = renderScanPng({
      still: this.still,
      sweep: SWEEP[stage],
      live: this.live,
      readout: {
        amount: merged.thb != null ? `${money(merged.thb)} THB` : undefined,
        payee: [merged.bank, merged.account || merged.last4 || ''].filter(Boolean).join(' ') || undefined,
        time: [merged.date, merged.time].filter(Boolean).join(' ') || undefined,
        ref: merged.ref || undefined,
        ocr: merged.confidence != null ? `${Math.round(merged.confidence)} PCT` : undefined,
        payout: merged.usdt != null ? `${money(merged.usdt)} USDT` : undefined,
      },
    });
    try {
      const ok = await editPhoto(this.chatId, this.messageId, png, caption);
      if (!ok) await editMessage(this.chatId, this.messageId, caption);
    } catch {
      /* Telegram may reject identical media/text */
    }
    this.lastAt = Date.now();
  }
}

export function aiReceived(opts?: { live?: boolean }): OutgoingMessage {
  return frame('received', { live: Boolean(opts?.live) });
}

export function aiVerifiedCard(ctx: AiContext): OutgoingMessage {
  const bank = ctx.bank ? esc(ctx.bank) : '—';
  const acct = ctx.account ? esc(String(ctx.account)) : ctx.last4 ? esc(ctx.last4) : '—';
  const ref = ctx.ref ? esc(ctx.ref) : '—';
  const time = ctx.time || '—';
  const state = ctx.state || 'WAIT';
  return {
    text: [
      '◈  <b>CE</b>  ·  <b>AGENT (OCR)</b>',
      `${esc(time)} · ${money(ctx.thb, 0)} THB → ${money(ctx.usdt)} U · <code>${ref}</code> · ${esc(state)}`,
      '',
      '<blockquote>OCR        OK',
      'BANK MATCH OK',
      'SECURITY   OK',
      'QUEUE      OK</blockquote>',
      '',
      `${bank}  <code>${acct}</code>`,
    ].join('\n'),
  };
}
