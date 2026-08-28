import { createHash } from 'crypto';

const ADMIN_COMMANDS = new Set([
  'save_slip', 'pin', 'unpin', 'rate', 'setrate', 'newday', 'reset',
  'setroom', 'export', 'summary', 'recent_slips', 'receiver', 'today', 'ledger',
  'vault', 'pending', 'recent',
]);

export function commandName(text: string | null | undefined): string | null {
  const match = (text ?? '').trim().match(/^\/([a-z_]+)(?:@[a-z0-9_]+)?(?:\s|$)/i);
  return match ? match[1].toLowerCase() : null;
}

export function requiresAdminAccess(text: string | null | undefined): boolean {
  const name = commandName(text);
  if (name != null && ADMIN_COMMANDS.has(name)) return true;
  return /^\/(?:ยอด|สรุป|เรต|ห้อง)(?:\s|$)/u.test((text ?? '').trim());
}

export function parseRecentLimit(text: string, fallback = 5): number | null {
  const rest = text.replace(/^\/recent_slips(?:@[a-z0-9_]+)?/i, '').trim();
  if (!rest) return fallback;
  if (!/^\d+$/.test(rest)) return null;
  const value = Number(rest);
  return Number.isSafeInteger(value) && value >= 1 && value <= 20 ? value : null;
}

export interface SaveSlipArgs {
  thb: number | null;
  bank: string | null;
  last4: string | null;
}

export function parseSaveSlipArgs(text: string): SaveSlipArgs | null {
  const rest = text.replace(/^\/save_slip(?:@[a-z0-9_]+)?/i, '').trim();
  if (!rest) return { thb: null, bank: null, last4: null };
  const match = rest.match(/^\+\s*(\d[\d,]*(?:\.\d+)?)\s*(?:B|THB|บาท|บ)(?:\s+([A-Za-z0-9]+)\s+(\d{4}))?$/iu);
  if (!match) return null;
  const thb = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(thb) || thb <= 0) return null;
  return {
    thb,
    bank: match[2] ? normalizeBankCode(match[2]) : null,
    last4: match[3] ?? null,
  };
}

export function configuredAdminIds(envValue = process.env.ADMIN_TELEGRAM_IDS): Set<number> {
  return new Set(
    (envValue ?? '')
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isSafeInteger(value) && value > 0),
  );
}

export function isBootstrapAdmin(userId: number, envValue = process.env.ADMIN_TELEGRAM_IDS): boolean {
  return configuredAdminIds(envValue).has(userId);
}

export function escapeTelegramHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function telegramUserMention(userId: number, name: string): string {
  return `<a href="tg://user?id=${userId}">${escapeTelegramHtml(name || 'Admin')}</a>`;
}

export function slipFingerprint(fileUniqueId: string): string {
  if (!fileUniqueId.trim()) throw new Error('MISSING_FILE_UNIQUE_ID');
  return createHash('sha256').update(`telegram:${fileUniqueId}`).digest('hex');
}

export function qrSlipFingerprint(transRef: string, sendingBank?: string | null): string {
  const ref = String(transRef || '').trim();
  if (!ref) throw new Error('MISSING_TRANS_REF');
  return createHash('sha256').update(`slipqr:${sendingBank || ''}:${ref}`).digest('hex');
}

export function isLowConfidence(value: number | null | undefined, threshold = 90): boolean {
  return value == null || !Number.isFinite(value) || value < threshold;
}

export function normalizeBankCode(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  if (/กสิกร|ไลน์\s*bk|line\s*bk/i.test(raw)) return 'KBANK';
  if (/กรุงเทพ|บางกอก/i.test(raw)) return 'BBL';
  if (/กรุงไทย/i.test(raw)) return 'KTB';
  if (/ไทยพาณิชย์/i.test(raw)) return 'SCB';
  if (/กรุงศรี/i.test(raw)) return 'BAY';
  if (/ออมสิน/i.test(raw)) return 'GSB';
  if (/ทหารไทย|ทีทีบี/i.test(raw)) return 'TTB';
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!compact) return null;
  const aliases: Record<string, string> = {
    KASIKORN: 'KBANK', KASIKORNBANK: 'KBANK', KBANK: 'KBANK', KBANKTH: 'KBANK',
    LINEBK: 'KBANK',
    SIAMCOMMERCIALBANK: 'SCB', SCB: 'SCB',
    KRUNGTHAI: 'KTB', KTB: 'KTB',
    BANGKOKBANK: 'BBL', BBL: 'BBL',
    KRUNGSRI: 'BAY', BAY: 'BAY',
    TTB: 'TTB', CIMB: 'CIMB', GSB: 'GSB', BAAC: 'BAAC', TMN: 'TMN',
  };
  return aliases[compact] ?? compact.slice(0, 32);
}
