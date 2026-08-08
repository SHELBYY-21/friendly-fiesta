// ============================================================
// ตัวอ่านจำนวนเงินแบบ "ระบุชัดเจน" — ไม่เดาให้
//   +500B   = บาทเข้า   (THB in)
//   -300U   = USDT ออก  (USDT out)
// ต้องมีเครื่องหมาย (+/-) และสกุล (B/U) เสมอ ถ้าไม่ครบ = ไม่รับ
// รองรับ: B|บ|บาท|THB  และ  U|ยู|USDT  (พิมพ์เล็ก/ใหญ่ได้, มี comma ได้)
// ============================================================

export type Currency = 'THB' | 'USDT';

export interface AmountToken {
  sign: 1 | -1;      // +1 = เข้า, -1 = ออก
  value: number;     // ค่าสัมบูรณ์ (บวกเสมอ)
  currency: Currency;
  raw: string;
}

// ([+-]) (ตัวเลข) (สกุล — บังคับ)
// ห้ามอนุมานสกุลจากเครื่องหมายโดยเด็ดขาด
const TOKEN_RE =
  /([+-])\s*(\d[\d,]*(?:\.\d+)?)\s*(THB|USDT|บาท|[BUบ])(?![\p{L}\p{N}_])/giu;

function toCurrency(unit: string): Currency {
  const u = unit.toUpperCase();
  if (u === 'B' || u === 'THB' || u === 'บาท' || u === 'บ') return 'THB';
  return 'USDT';
}

/** อ่าน token ทั้งหมดในข้อความ เช่น "+500B -13.6U" → 2 tokens */
export function parseAmountTokens(text: string): AmountToken[] {
  const out: AmountToken[] = [];
  const s = text || '';
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(s)) !== null) {
    const sign: 1 | -1 = m[1] === '-' ? -1 : 1;
    const value = parseFloat(m[2].replace(/,/g, ''));
    if (!Number.isFinite(value) || value <= 0) continue;
    out.push({ sign, value, currency: toCurrency(m[3]), raw: m[0] });
  }
  return out;
}

export interface ParsedAmounts {
  thb?: AmountToken;
  usdt?: AmountToken;
  /** มีตัวเลขแต่ไม่ได้ใส่เครื่องหมาย/สกุลให้ครบ (เช่น "500" หรือ "500B") */
  hasBareNumber: boolean;
  /** มี token สกุลเดียวกันมากกว่าหนึ่งค่า จึงเลือกยอดให้ไม่ได้อย่างปลอดภัย */
  ambiguous: boolean;
}

/** สรุป token เป็นยอด THB / USDT + ตรวจว่ามีเลขลอยๆ ที่ไม่ระบุรูปแบบไหม */
export function parseAmounts(text: string): ParsedAmounts {
  const tokens = parseAmountTokens(text);
  const thb = tokens.find((t) => t.currency === 'THB');
  const usdt = tokens.find((t) => t.currency === 'USDT');
  const ambiguous =
    tokens.filter((t) => t.currency === 'THB').length > 1 ||
    tokens.filter((t) => t.currency === 'USDT').length > 1;

  // เลขที่ "ไม่ได้" อยู่ใน token ที่ถูกต้อง → ถือว่าเป็นเลขลอย (บอทจะไม่เดา)
  let stripped = text || '';
  for (const t of tokens) stripped = stripped.replace(t.raw, ' ');
  const hasBareNumber = /\d/.test(stripped);

  return { thb, usdt, hasBareNumber, ambiguous };
}
