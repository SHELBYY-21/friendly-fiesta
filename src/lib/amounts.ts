// ============================================================
// ยอดต้องมี keyword — ไม่เดาจากเลขลอย
//   เข้า 500   | +500B | THB 500     = บาทเข้า
//   ออก 13.6  | -13.6U | USDT 13.6  = USDT ออก
// เลขเปล่า (500, เบอร์โทร, เวลา) = ไม่รับ
// ============================================================

export type Currency = 'THB' | 'USDT';

export interface AmountToken {
  sign: 1 | -1;
  value: number;
  currency: Currency;
  raw: string;
}

const SIGNED_RE =
  /([+-])\s*(\d[\d,]*(?:\.\d+)?)\s*(THB|USDT|บาท|[BUบ])(?![\p{L}\p{N}_])/giu;

const IN_KEY_RE =
  /(?:^|[\s,;|/])(เข้า|รับ|in|thb|บาท)\s*:?\s*(\d[\d,]*(?:\.\d+)?)(?![\p{L}\p{N}])/giu;

const OUT_KEY_RE =
  /(?:^|[\s,;|/])(ออก|ส่ง|out|usdt)\s*:?\s*(\d[\d,]*(?:\.\d+)?)(?![\p{L}\p{N}])/giu;

function toCurrency(unit: string): Currency {
  const u = unit.toUpperCase();
  if (u === 'B' || u === 'THB' || u === 'บาท' || u === 'บ') return 'THB';
  return 'USDT';
}

/** อ่าน token ที่ระบุชัด เช่น "เข้า 500" "+500B" "ออก 13.6" */
export function parseAmountTokens(text: string): AmountToken[] {
  const out: AmountToken[] = [];
  const seen = new Set<string>();
  const s = text || '';

  const add = (sign: 1 | -1, valueRaw: string, currency: Currency, raw: string) => {
    const value = parseFloat(valueRaw.replace(/,/g, ''));
    if (!Number.isFinite(value) || value <= 0) return;
    const key = `${sign}:${currency}:${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ sign, value, currency, raw: raw.trim() });
  };

  SIGNED_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SIGNED_RE.exec(s)) !== null) {
    add(m[1] === '-' ? -1 : 1, m[2], toCurrency(m[3]), m[0]);
  }

  IN_KEY_RE.lastIndex = 0;
  while ((m = IN_KEY_RE.exec(s)) !== null) {
    add(1, m[2], 'THB', m[0]);
  }

  OUT_KEY_RE.lastIndex = 0;
  while ((m = OUT_KEY_RE.exec(s)) !== null) {
    add(-1, m[2], 'USDT', m[0]);
  }

  return out;
}

export interface ParsedAmounts {
  thb?: AmountToken;
  usdt?: AmountToken;
  /** มีตัวเลขแต่ไม่มี keyword / สกุล — บอทต้องเงียบ */
  hasBareNumber: boolean;
  ambiguous: boolean;
}

export function parseAmounts(text: string): ParsedAmounts {
  const tokens = parseAmountTokens(text);
  const thb = tokens.find((t) => t.currency === 'THB');
  const usdt = tokens.find((t) => t.currency === 'USDT');
  const ambiguous =
    tokens.filter((t) => t.currency === 'THB').length > 1 ||
    tokens.filter((t) => t.currency === 'USDT').length > 1;

  let stripped = text || '';
  for (const t of tokens) stripped = stripped.replace(t.raw, ' ');
  const hasBareNumber = /\d/.test(stripped);

  return { thb, usdt, hasBareNumber, ambiguous };
}
