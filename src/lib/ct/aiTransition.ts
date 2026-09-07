import { editMessage, sendChatAction, editPhoto, type OutgoingMessage } from '../telegram';
import { renderScanPng, type StillFrame } from './cardImage';

const MIN_GAP_MS = 550;
const MAX_GAP_MS = 850;

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
  ref?: string | null;
  time?: string | null;
  state?: string | null;
  live?: boolean;
};

const SWEEP: Record<AiStage, number> = {
  received: 0.14,
  init: 0.24,
  ocr: 0.40,
  extract: 0.54,
  match: 0.66,
  security: 0.76,
  calc: 0.86,
  ledger: 0.93,
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

function frame(stage: AiStage, ctx: AiContext): OutgoingMessage {
  const bank = ctx.bank ? esc(ctx.bank) : '—';
  const last4 = ctx.last4 ? esc(ctx.last4) : '????';
  const live = Boolean(ctx.live);
  const chip = live
    ? '<b>LIVE PHOTO</b> · still frame'
    : '<b>SLIP PHOTO</b> · scanning';
  const lines: string[] = ['◈  <b>CE VAULT</b>', chip];

  switch (stage) {
    case 'received':
      lines.push(
        '',
        '<blockquote expandable>English first',
        'Reading the still image — not the clip.',
        'กำลังอ่านภาพนิ่ง ไม่ใช่คลิป</blockquote>',
        bar(12),
      );
      break;
    case 'init':
      lines.push('', bar(22), '<blockquote>Scanning slip', 'กำลังเปิดสลิป</blockquote>');
      break;
    case 'ocr':
      lines.push('', '<i>OCR Vision</i>', bar(42), '<blockquote>Reading amount / payee / reference', 'กำลังอ่านยอด ผู้รับ รหัสอ้างอิง</blockquote>');
      break;
    case 'extract':
      lines.push('', '<i>Extracting fields</i>', bar(58));
      if (ctx.thb) {
        lines.push(`<blockquote>ยอดรับเข้า\n<b>${money(ctx.thb, 0)}</b> THB</blockquote>`);
      }
      break;
    case 'match':
      lines.push('', '<i>Matching pin</i>', bar(72), `<blockquote>ผู้รับ\n${bank} ••${last4}</blockquote>`);
      break;
    case 'security':
      lines.push('', '<i>Security check</i>', bar(82), '<blockquote>ตรวจลายน้ำ · QR · หมุดวันนี้</blockquote>');
      break;
    case 'calc':
      lines.push('', '<i>Desk rate</i>', bar(90));
      if (ctx.usdt != null) lines.push(`<blockquote>รอโอน\n<b>${money(ctx.usdt)} U</b></blockquote>`);
      break;
    case 'ledger':
      lines.push('', '<i>Building ledger</i>', bar(95));
      break;
    case 'done':
      lines.push('', '<blockquote expandable>TRANSACTION READY');
      lines.push(`ยอดรับเข้า  <b>${ctx.thb != null ? money(ctx.thb, 0) : '—'}</b> THB`);
      lines.push(`ผู้รับ  ${bank} ••••${last4}`);
      lines.push(`รอโอน  <b>${ctx.usdt != null ? money(ctx.usdt) : '—'}</b> USDT`);
      if (ctx.time && ctx.thb != null && ctx.usdt != null) {
        lines.push(`${esc(ctx.time)} · ${money(ctx.thb, 0)} THB → ${money(ctx.usdt)} U`);
      }
      if (ctx.ref) lines.push(`รหัส  <code>${esc(ctx.ref)}</code>`);
      lines.push(`สถานะ  ${esc(ctx.state || 'WAIT')}`);
      lines.push('</blockquote>');
      break;
  }

  return { text: lines.join('\n') };
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
    const caption = frame(stage, { ...ctx, live: this.live || ctx.live });
    const png = renderScanPng({ still: this.still, sweep: SWEEP[stage], live: this.live });
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
  const last4 = ctx.last4 ? esc(ctx.last4) : '????';
  const ref = ctx.ref ? esc(ctx.ref) : '—';
  const time = ctx.time || '—';
  const state = ctx.state || 'WAIT';
  return {
    text: [
      '◈  <b>CE VAULT</b>',
      `${esc(time)} · ${money(ctx.thb, 0)} THB → ${money(ctx.usdt)} U · <code>${ref}</code> · ${esc(state)}`,
      '',
      '<blockquote>OCR        OK',
      'BANK MATCH OK',
      'SECURITY   OK',
      'QUEUE      OK</blockquote>',
      '',
      `${bank} ••••${last4}`,
    ].join('\n'),
  };
}
