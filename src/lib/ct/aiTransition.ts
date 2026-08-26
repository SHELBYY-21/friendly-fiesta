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
};

function bar(pct: number): string {
  const p = Math.max(0, Math.min(100, Math.round(pct / 10) * 10));
  const fill = Math.round(p / 10);
  return `[${'█'.repeat(fill)}${'░'.repeat(10 - fill)}] ${p}%`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function money(n: number | null | undefined, d = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function frame(stage: AiStage, ctx: AiContext): OutgoingMessage {
  const bank = ctx.bank ? esc(ctx.bank) : '—';
  const last4 = ctx.last4 ? esc(ctx.last4) : '????';
  const lines: string[] = ['◈  <b>CE VAULT AI</b>'];

  switch (stage) {
    case 'received':
      lines.push('<i>AI RECEIVED TRANSACTION</i>', '', 'Initializing secure transaction...', bar(10));
      break;
    case 'init':
      lines.push('<i>Initializing...</i>', '', bar(20), 'Scanning slip');
      break;
    case 'ocr':
      lines.push('<i>OCR Vision active</i>', '', bar(40), 'Reading transaction...');
      break;
    case 'extract':
      lines.push('<i>Extracting amount...</i>', '', bar(55));
      if (ctx.thb) lines.push(`THB  <b>${money(ctx.thb, 0)}</b>`);
      break;
    case 'match':
      lines.push('<i>Matching account</i>', '', bar(70), `→ ${bank} ••${last4}`);
      break;
    case 'security':
      lines.push('<i>Security verification...</i>', '', bar(80));
      break;
    case 'calc':
      lines.push('<i>Calculating USDT...</i>', '', bar(90));
      if (ctx.usdt != null) lines.push(`DUE  <b>${money(ctx.usdt)} U</b>`);
      break;
    case 'ledger':
      lines.push('<i>Building ledger...</i>', '', bar(95));
      break;
    case 'done':
      lines.push('<i>SYSTEM PROCESS</i>', '━'.repeat(12));
      lines.push('◉ OCR VISION', ctx.thb ? `   ${money(ctx.thb, 0)} THB detected` : '   —');
      lines.push('◉ ACCOUNT MATCH', `   ${bank} ••••${last4}`);
      lines.push('◉ RATE ENGINE', ctx.usdt != null ? `   ${money(ctx.usdt)} USDT` : '   —');
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
  constructor(private chatId: number, private messageId: number) {}

  async pulse() {
    await sendChatAction(this.chatId, 'typing');
  }

  async step(stage: AiStage, ctx: AiContext = {}): Promise<void> {
    const wait = MIN_GAP_MS + Math.floor(Math.random() * (MAX_GAP_MS - MIN_GAP_MS));
    const elapsed = Date.now() - this.lastAt;
    if (this.lastAt && elapsed < wait) await sleep(wait - elapsed);
    try {
      await editMessage(this.chatId, this.messageId, frame(stage, ctx));
    } catch {
      /* Telegram may reject identical text */
    }
    this.lastAt = Date.now();
  }
}

export function aiReceived(): OutgoingMessage {
  return frame('received', {});
}

export function aiVerifiedCard(ctx: AiContext): OutgoingMessage {
  const bank = ctx.bank ? esc(ctx.bank) : '—';
  const last4 = ctx.last4 ? esc(ctx.last4) : '????';
  const ref = ctx.ref ? esc(ctx.ref) : '—';
  const time = ctx.time || '—';
  const state = ctx.state || 'WAIT';
  return {
    text: [
      '◈  <b>CE AI VERIFIED</b>',
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
