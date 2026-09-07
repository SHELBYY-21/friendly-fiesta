import { editMessage, sendChatAction, type OutgoingMessage } from '../telegram';

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
  const live = ctx.live ? 'LIVE PHOTO · still frame' : 'SLIP PHOTO';
  const lines: string[] = ['◈  <b>CE VAULT</b>', `<i>${live}</i>`];

  switch (stage) {
    case 'received':
      lines.push('', '<blockquote>English first', 'Reading the still image — not the clip.', 'กำลังอ่านภาพนิ่ง ไม่ใช่คลิป</blockquote>', bar(12));
      break;
    case 'init':
      lines.push('', bar(22), 'Scanning slip', 'กำลังเปิดสลิป');
      break;
    case 'ocr':
      lines.push('', '<i>OCR Vision</i>', bar(42), 'Reading amount / payee / reference');
      break;
    case 'extract':
      lines.push('', '<i>Extracting fields</i>', bar(58));
      if (ctx.thb) lines.push(`ยอดรับเข้า  <b>${money(ctx.thb, 0)}</b> THB`);
      break;
    case 'match':
      lines.push('', '<i>Matching pin</i>', bar(72), `→ ${bank} ••${last4}`);
      break;
    case 'security':
      lines.push('', '<i>Security check</i>', bar(82));
      break;
    case 'calc':
      lines.push('', '<i>Desk rate</i>', bar(90));
      if (ctx.usdt != null) lines.push(`รอโอน  <b>${money(ctx.usdt)} U</b>`);
      break;
    case 'ledger':
      lines.push('', '<i>Building ledger</i>', bar(95));
      break;
    case 'done':
      lines.push('', '━'.repeat(12));
      lines.push('◉ OCR', ctx.thb ? `   ${money(ctx.thb, 0)} THB` : '   —');
      lines.push('◉ MATCH', `   ${bank} ••••${last4}`);
      lines.push('◉ DUE', ctx.usdt != null ? `   ${money(ctx.usdt)} USDT` : '   —');
      lines.push('━'.repeat(12), '<b>TRANSACTION READY</b>');
      if (ctx.time && ctx.thb != null && ctx.usdt != null) {
        lines.push(`${esc(ctx.time)} │ ${money(ctx.thb, 0)} THB → ${money(ctx.usdt)} U`);
      }
      if (ctx.ref) lines.push(`REF   │ <code>${esc(ctx.ref)}</code>`);
      lines.push(`STATE │ ${esc(ctx.state || 'WAIT')}`);
      break;
  }

  return { text: lines.join('\n') };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class AiTransition {
  private lastAt = 0;
  constructor(private chatId: number, private messageId: number, private live = false) {}

  async pulse() {
    await sendChatAction(this.chatId, this.live ? 'upload_photo' : 'typing');
  }

  async step(stage: AiStage, ctx: AiContext = {}): Promise<void> {
    const wait = MIN_GAP_MS + Math.floor(Math.random() * (MAX_GAP_MS - MIN_GAP_MS));
    const elapsed = Date.now() - this.lastAt;
    if (this.lastAt && elapsed < wait) await sleep(wait - elapsed);
    try {
      await editMessage(this.chatId, this.messageId, frame(stage, { ...ctx, live: this.live || ctx.live }));
    } catch {
      /* Telegram may reject identical text */
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
      `${esc(time)} │ ${money(ctx.thb, 0)} THB → ${money(ctx.usdt)} U │ <code>${ref}</code> │ ${esc(state)}`,
      '',
      'OCR        OK',
      'BANK MATCH OK',
      'SECURITY   OK',
      'QUEUE      OK',
      '',
      `${bank} ••••${last4}`,
    ].join('\n'),
  };
}
