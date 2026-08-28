import { randomBytes } from 'crypto';
import { escapeTelegramHtml } from '../botSecurity';
import { RULE, quote } from './tokens';

export const DIV = RULE;
const BKK = 'Asia/Bangkok';

export function esc(s: unknown): string {
  return escapeTelegramHtml(s);
}

export function nowBkk(): Date {
  return new Date();
}

export function ymdBkk(d = nowBkk()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BKK, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${g('year')}${g('month')}${g('day')}`;
}

export function clockBkk(d = nowBkk()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BKK, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}

export function bannerDate(d = nowBkk()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BKK, day: '2-digit', month: 'short',
  }).format(d);
}

export function makeRef(d = nowBkk()): { ymd: string; short: string; ledger: string } {
  const ymd = ymdBkk(d);
  const short = randomBytes(2).toString('hex').toUpperCase();
  return { ymd, short, ledger: `CE-${ymd}-${short}` };
}

export function displayLedger(ledger: string): string {
  const bare = ledger.replace(/^#/, '');
  return `#${bare}`;
}

export function shortOf(ledger: string): string {
  const m = ledger.replace(/^#/, '').match(/-([A-F0-9]{4})$/i);
  return (m?.[1] ?? ledger.slice(-4)).toUpperCase();
}

export function maskAcct(last4: string | null | undefined): string {
  const t = (last4 ?? '').replace(/\D/g, '').slice(-4);
  return t ? `••••${t}` : '••••????';
}

export function thbInt(n: number): string {
  const v = Number(n) || 0;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(v));
}

export function thbCard(n: number): string {
  return (Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function usdt(n: number): string {
  return (Number(n) || 0).toFixed(2);
}

export function rateCode(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—';
  return n.toFixed(2);
}

export function shouldSend(thb: number, desk: number): number {
  if (!desk || desk <= 0) return 0;
  return Math.round((thb / desk) * 100) / 100;
}

export type BtnStyle = 'success' | 'primary' | 'danger';

export function pnlThb(thb: number, usdtAmt: number, desk: number, mkt: number | null): number | null {
  if (!mkt || mkt <= 0 || !usdtAmt || usdtAmt <= 0) return null;
  return Math.round(usdtAmt * (desk - mkt));
}

export function quoteBlock(d: { thb: number; usdt: number; desk: number; mkt: number | null }): string {
  const p = pnlThb(d.thb, d.usdt, d.desk, d.mkt);
  const pnl = p == null ? '—' : `${p >= 0 ? '+' : ''}${thbInt(p)} THB`;
  return quote(
    [
      'รับเข้า (IN)',
      `<b>${thbCard(d.thb)}</b> THB`,
      'ต้องโอน (DUE)',
      `<b>${usdt(d.usdt)}</b> USDT`,
      'กำไรสุทธิ (PNL)',
      `<b>${pnl}</b>`,
      `เรทโต๊ะ  <code>${rateCode(d.desk)}</code>   เรทตลาด  <code>${rateCode(d.mkt)}</code>`,
    ].join('\n'),
  );
}

export function deskUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://ce-vault.vercel.app';
  if (raw.startsWith('https://') && !/localhost/.test(raw)) return raw.replace(/\/$/, '');
  return 'https://ce-vault.vercel.app';
}

export function btn(text: string, callback_data: string, style?: BtnStyle) {
  return style ? { text, callback_data, style } : { text, callback_data };
}

export function urlBtn(text: string, url: string) {
  return { text, url };
}

export function ik(rows: Array<Array<Record<string, unknown>>>) {
  return { inline_keyboard: rows };
}

export function adminKeyboard() {
  return {
    keyboard: [
      [{ text: 'ยอดวันนี้' }, { text: 'รอส่ง' }, { text: 'อัตรา' }],
      [{ text: 'บัญชีรับ' }, { text: 'ตั้งค่า' }, { text: 'วันใหม่' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}
