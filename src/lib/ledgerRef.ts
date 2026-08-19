import { randomBytes } from 'crypto';

/** Stored form: CE-YYYYMMDD-XXXXXXXX (Bangkok calendar date). Display form prefixes #. */
export const LEDGER_REF_PATTERN = /^CE-\d{8}-[0-9A-F]{8}$/;

export function bangkokYmd(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date).replace(/-/g, '');
}

export function newLedgerRef(date = new Date()): string {
  return `CE-${bangkokYmd(date)}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export function displayLedgerRef(ref: string | null | undefined): string {
  const compact = String(ref ?? '').trim().replace(/^#/, '');
  if (!compact) return '—';
  return `#${compact}`;
}

export function isLedgerRef(value: string | null | undefined): boolean {
  return LEDGER_REF_PATTERN.test(String(value ?? '').trim().replace(/^#/, ''));
}
