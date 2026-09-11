/**
 * Integer-minor-unit money helpers (satang / USDT cents).
 * Avoid IEEE float for ledger division where possible.
 */

export type MoneyScale = 2; // 2 decimal places

const SCALE = 100n;

function toMinor(n: number | string): bigint {
  if (typeof n === 'number') {
    if (!Number.isFinite(n)) return 0n;
    // Round to 2dp then to minor units
    const s = (Math.round(n * 100) / 100).toFixed(2);
    return toMinor(s);
  }
  const raw = String(n).trim().replace(/,/g, '');
  const neg = raw.startsWith('-');
  const body = neg ? raw.slice(1) : raw;
  const [whole, frac = ''] = body.split('.');
  const w = BigInt(whole || '0');
  const f = BigInt((frac + '00').slice(0, 2).padEnd(2, '0'));
  const minor = w * SCALE + f;
  return neg ? -minor : minor;
}

export function fromMinor(minor: bigint): number {
  const neg = minor < 0n;
  const a = neg ? -minor : minor;
  const whole = a / SCALE;
  const frac = a % SCALE;
  const s = `${neg ? '-' : ''}${whole}.${frac.toString().padStart(2, '0')}`;
  return Number(s);
}

/** THB ÷ desk rate → USDT amount at 2dp (banker's avoid: round half up via integer). */
export function usdtFromThbDesk(thb: number, desk: number): number {
  if (!desk || desk <= 0 || !Number.isFinite(thb) || thb <= 0) return 0;
  const thbMinor = toMinor(thb);
  const deskMinor = toMinor(desk);
  if (deskMinor <= 0n) return 0;
  // (thb / desk) at 2dp = floor((thbMinor * 100 + deskMinor/2) / deskMinor) style
  // usdt_cents = round(thbMinor * 100 / deskMinor) but thbMinor already *100 vs major...
  // thb major / desk major = (thbMinor/100) / (deskMinor/100) = thbMinor / deskMinor
  // want 2dp → multiply by 100 before divide:
  const usdtCents = (thbMinor * SCALE + deskMinor / 2n) / deskMinor;
  return fromMinor(usdtCents);
}

export function roundMoney2(n: number): number {
  return fromMinor(toMinor(n));
}
