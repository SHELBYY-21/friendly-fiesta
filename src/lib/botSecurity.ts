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

/** BOT 3-digit FI codes on Thai slip QR / EasySlip. */
export const BOT_BANK: Record<string, string> = {
  '002': 'BBL',
  '004': 'KBANK',
  '006': 'KTB',
  '011': 'TTB',
  '014': 'SCB',
  '022': 'CIMB',
  '024': 'UOB',
  '025': 'BAY',
  '030': 'GSB',
  '033': 'GHB',
  '034': 'BAAC',
  '066': 'ISLAM',
  '067': 'TISCO',
  '069': 'KKP',
  '073': 'LH',
};

const CHANNEL_NOT_BANK = new Set(['KPLUS', 'SCBEASY', 'KTBNEXT']);

export function botBank(code: string | null | undefined): string | null {
  return normalizeBankCode(code);
}

export function normalizeBankCode(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (/^\d{2,3}$/.test(digits)) {
    const fi = digits.padStart(3, '0');
    if (BOT_BANK[fi]) return BOT_BANK[fi];
    if (!/[A-Za-zก-๙]/.test(raw)) return null;
  }
  if (/พร้อมเพย์|prompt\s*pay/i.test(raw)) return 'PROMPTPAY';
  if (/ทรูมันนี่|true\s*money/i.test(raw)) return 'TRUEMONEY';
  if (/กสิกร|ไลน์\s*bk|line\s*bk/i.test(raw)) return 'KBANK';
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (CHANNEL_NOT_BANK.has(compact)) return null;
  if (/กรุงศรี|อยุธยา/i.test(raw)) return 'BAY';
  if (/กรุงไทย/i.test(raw)) return 'KTB';
  if (/กรุงเทพ|บางกอก/i.test(raw)) return 'BBL';
  if (/ไทยพาณิช|พาณิชย์/i.test(raw)) return 'SCB';
  if (/ออมสิน/i.test(raw)) return 'GSB';
  if (/ทหารไทย|ธนชาต|ทีทีบี|ttb/i.test(raw)) return 'TTB';
  if (/เกียรตินาคิน|kkp/i.test(raw)) return 'KKP';
  if (/ซีไอเอ็มบี|cimb/i.test(raw)) return 'CIMB';
  if (/ยูโอบี|uob/i.test(raw)) return 'UOB';
  if (/ทิสโก้|tisco/i.test(raw)) return 'TISCO';
  if (/แลนด์|lh\s*bank|lhbank/i.test(raw)) return 'LH';
  if (/ธ\.?\s*ก\.?\s*ส|เพื่อการเกษตร|baac/i.test(raw)) return 'BAAC';
  if (/อาคารสงเคราะห์|ghb/i.test(raw)) return 'GHB';
  if (/อิสลาม|ibank/i.test(raw)) return 'ISLAM';
  if (!compact) return null;
  const aliases: Record<string, string> = {
    KASIKORN: 'KBANK', KASIKORNBANK: 'KBANK', KBANK: 'KBANK', KBANKTH: 'KBANK',
    LINEBK: 'KBANK',
    SIAMCOMMERCIALBANK: 'SCB', SCB: 'SCB',
    KRUNGTHAI: 'KTB', KTB: 'KTB',
    BANGKOKBANK: 'BBL', BBL: 'BBL',
    KRUNGSRI: 'BAY', BAY: 'BAY', AYUDHYA: 'BAY',
    TTB: 'TTB', THANACHART: 'TTB',
    CIMB: 'CIMB', GSB: 'GSB', BAAC: 'BAAC', TMN: 'TRUEMONEY', TRUEMONEY: 'TRUEMONEY',
    KKP: 'KKP', UOB: 'UOB', TISCO: 'TISCO', LH: 'LH', LHBANK: 'LH',
    GHB: 'GHB', ISLAM: 'ISLAM', IBANK: 'ISLAM',
    PROMPTPAY: 'PROMPTPAY',
  };
  return aliases[compact] ?? compact.slice(0, 32);
}

const BANK_TH: Record<string, string> = {
  KBANK: 'กสิกร',
  SCB: 'ไทยพาณิชย์',
  KTB: 'กรุงไทย',
  BBL: 'กรุงเทพ',
  BAY: 'กรุงศรี',
  TTB: 'ทีทีบี',
  GSB: 'ออมสิน',
  KKP: 'เกียรตินาคิน',
  CIMB: 'ซีไอเอ็มบี',
  UOB: 'ยูโอบี',
  LH: 'แลนด์แอนด์เฮ้าส์',
  TISCO: 'ทิสโก้',
  BAAC: 'ธ.ก.ส.',
  GHB: 'อาคารสงเคราะห์',
  ISLAM: 'อิสลาม',
  TRUEMONEY: 'ทรูมันนี่',
  PROMPTPAY: 'พร้อมเพย์',
};

export function bankLabel(value: string | null | undefined): string {
  const code = normalizeBankCode(value);
  if (!code) return '—';
  const th = BANK_TH[code];
  return th ? `${th} (${code})` : code;
}
