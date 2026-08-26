import { normalizeBankCode } from '../lib/botSecurity';

export interface ParsedSlipText {
  amount: number | null;
  bank: string | null;
  last4: string | null;
  receiverName: string | null;
  date: string | null;
  time: string | null;
}

export interface DeskPin {
  bank: string;
  account: string;
  name: string | null;
}

export function cleanPersonName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = String(raw)
    .replace(/["'`]/g, ' ')
    .replace(/(?:นาย|นางสาว|น\.ส\.|นส\.|นาง|คุณ|บจก\.?|บริษัท)\s*/g, ' ')
    .replace(/ธ\.\s*[ก-๙A-Za-z]+/g, ' ')
    .replace(/กสิกรไทย|กรุงไทย|กรุงเทพ|ไทยพาณิชย์|ออมสิน|ทหารไทย/g, ' ')
    .replace(/x[x.-]*\d{3,4}x?/gi, ' ')
    .replace(/\s+ธ\.?\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length < 3 || /^\d+$/.test(t)) return null;
  return t.slice(0, 48);
}

export function nameFromPayee(text: string): string | null {
  const raw = String(text ?? '');
  const payee = (raw.split(/ไปยัง|ผู้รับเงิน|ผู้รับ|เข้าบัญชี|บัญชีปลายทาง/)[1] || '')
    .split(/ค่าธรรมเนียม|เลขที่รายการ|จำนวนเงิน|จำนวน\s*:|จาก\s/)[0];
  if (payee.trim()) {
    const company = payee.match(/บจก\.?\s*([^\n]+)/i);
    if (company) return cleanPersonName(company[1]);
    const person = payee.match(/(?:นาย|นางสาว|น\.ส\.|นาง|คุณ)?\s*([ก-๙]{2,}(?:\s+[ก-๙]{2,}){0,3})/);
    const cleaned = cleanPersonName(person?.[1] ?? null);
    if (cleaned) return cleaned;
  }
  const names = [...raw.matchAll(/(?:นาย|นางสาว|น\.ส\.|นาง|คุณ)?\s*([ก-๙]{2,}\s+[ก-๙]{2,}(?:\s+[ก-๙]{1,})?)/g)];
  if (names.length >= 2) return cleanPersonName(names[names.length - 1][0]);
  if (names.length === 1) return cleanPersonName(names[0][0]);
  return null;
}

function last4FromMasked(text: string): string | null {
  const compact = String(text ?? '').replace(/[-.\s]/g, '');
  const masked = compact.match(/x+(\d{4})x?/i);
  if (masked) return masked[1];
  return null;
}

/** Last 4 of the PAYEE / receiving account. Never the sender, never the slip reference. */
export function last4FromPayeeMask(text: string): string | null {
  const raw = String(text ?? '');
  const payee = (raw.split(/ไปยัง|ผู้รับเงิน|ผู้รับ|เข้าบัญชี|บัญชีปลายทาง/)[1] || '')
    .split(/ค่าธรรมเนียม|เลขที่รายการ|จาก\s|ผู้โอน/)[0];
  const fromPayee = last4FromMasked(payee);
  if (fromPayee) return fromPayee;
  const noRef = raw
    .replace(/เลขที่รายการ[^\n]*/gi, '')
    .replace(/COR\d+/gi, '')
    .replace(/จาก[\s\S]*?(?=ไปยัง|ผู้รับ|จำนวน|$)/, '');
  const masks = [...noRef.matchAll(/x{2,}[-x.]*?(\d{4})x?/gi)];
  if (masks.length === 1) return masks[0][1];
  if (masks.length > 1) return masks[masks.length - 1][1];
  return null;
}

export function parseSlipText(text: string): ParsedSlipText {
  const raw = text || '';
  const cleaned = raw.replace(/\s+/g, ' ');

  const baht = raw.match(/฿\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2}))/);
  const amountMatch = baht || cleaned.match(/([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)\s*(?:บาท|THB|บ\.)?/i);
  let amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;
  if (amount === 0) amount = null;

  const payeeBlock = (raw.split(/ไปยัง/)[1] || raw.split(/ผู้รับ/)[1] || raw).split(/ค่าธรรมเนียม|เลขที่รายการ|LINE BK/)[0];
  const last4 = last4FromPayeeMask(raw) || last4FromMasked(payeeBlock) || (() => {
    const last4Match = cleaned.match(/(?:x{2,}|•{2,}|[*]{2,}|บัญชี|\b)(\d{4})\b/i);
    return last4Match ? last4Match[1] : null;
  })();

  const bankToken =
    payeeBlock.match(/กสิกรไทย|กสิกร|กรุงเทพ|กรุงไทย|ไทยพาณิชย์|กรุงศรี|ออมสิน|ทหารไทย|LINE BK|KBANK|SCB|BBL|KTB|BAY|TTB|GSB|CIMB|KKP/i) ||
    cleaned.match(/กสิกรไทย|กสิกร|กรุงเทพ|กรุงไทย|ไทยพาณิชย์|กรุงศรี|ออมสิน|ทหารไทย|LINE BK|KBANK|SCB|BBL|KTB|BAY|TTB|GSB|CIMB|KKP/i);
  const bank = normalizeBankCode(bankToken ? bankToken[0] : null);

  const receiverName = nameFromPayee(raw);

  const dateMatch = cleaned.match(/(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/) || cleaned.match(/(\d{1,2}\s*ส\.ค\.\s*\d{2})/);
  const timeMatch = cleaned.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);

  return {
    amount,
    bank,
    last4,
    receiverName,
    date: dateMatch ? dateMatch[1] : null,
    time: timeMatch ? timeMatch[1] : null,
  };
}

export function parseDeskPin(text: string): DeskPin | null {
  const rawFull = text || '';
  const hadPinCmd = /^\/pin(?:@[a-z0-9_]+)?/i.test(rawFull.trim());
  const labeled = /เลขบัญชี|บัญชี\s*[:：]|วงเงิน|ชื่อเต็ม|ชื่อ(?:\s*-?\s*สกุล)|ธนาคาร\s*[:：]/.test(rawFull);
  if (!hadPinCmd && !labeled) return null;

  const raw = rawFull.replace(/^\/pin(?:@[a-z0-9_]+)?/i, '').trim();
  if (!raw) return null;

  const acc =
    raw.match(/(?:เลข)?บัญชี\s*[:：]?\s*([0-9Xxх*][\dXxх*\s-]{3,22})/i) ||
    raw.match(/\b(\d{10,15})\b/) ||
    raw.match(/(x{2,}[-x.]*\d{4}x?)/i);
  if (!acc) {
    const parts = raw.split(/\s+/);
    if (parts.length >= 2 && /^\d{4,15}$/.test(parts[1].replace(/\D/g, ''))) {
      const bank = normalizeBankCode(parts[0]);
      const account = parts[1].replace(/\D/g, '');
      if (bank && account.length >= 4) return { bank, account, name: null };
    }
    return null;
  }
  const account = acc[1].replace(/\D/g, '') || last4FromMasked(acc[1]) || '';
  if (account.length < 4) return null;

  const bankLine = raw.match(/(?:bank|ธนาคาร)\s*[:：]\s*([^\n]+)/i);
  const headTok = raw.split('\n')[0].match(/BBL|KBANK|SCB|KTB|BAY|TTB|GSB|CIMB|กรุงเทพ|กสิกร|กรุงไทย|ไทยพาณิชย์/i);
  const bank =
    (bankLine ? normalizeBankCode(bankLine[1]) : null) ||
    (headTok ? normalizeBankCode(headTok[0]) : null) ||
    (() => {
      const tok = raw.match(/กรุงเทพ|กสิกรไทย|กสิกร|กรุงไทย|BBL|KBANK|SCB|KTB|BAY/i);
      return tok ? normalizeBankCode(tok[0]) : null;
    })();
  if (!bank) return null;

  const nameM = raw.match(/ชื่อ(?:เต็ม|\s*-?\s*สกุล)?\s*[:：]\s*([^\n]+)/i);
  const name = nameM ? nameM[1].replace(/^[^\u0E00-\u0E7Fa-zA-Z]+/, '').trim() : null;
  return { bank, account, name: name || null };
}

export function hasRatePrefix(text: string): boolean {
  return /^(?:\/setrate(?:@[a-z0-9_]+)?|\/rate(?:@[a-z0-9_]+)?|setrate|เรตแลก|เรทแลก|เรท|เรต|rate)\s+\d/i.test((text || '').trim());
}

export function isBareDeskRate(text: string): boolean {
  return /^\d{2}(?:\.\d{1,2})?$/.test((text || '').trim());
}

export function parseDeskRate(text: string): number | null {
  const t = (text || '').trim().replace(/^(?:\/setrate(?:@[a-z0-9_]+)?|\/rate(?:@[a-z0-9_]+)?|setrate|เรตแลก|เรทแลก|เรท|เรต|rate)\s*/i, '').trim();
  if (!/^\d{2}(?:\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 20 || n > 80) return null;
  return n;
}

export function computeShouldSend(thb: number, rate: number): number {
  if (!rate || rate <= 0 || !thb || thb <= 0) return 0;
  return parseFloat((thb / rate).toFixed(2));
}

export function parseTelegramId(text: string): number | null {
  const t = (text || '').trim();
  const m = t.match(/^(?:\/admin(?:@[a-z0-9_]+)?\s+)?(?:id[:\s]*)?(\d{5,15})$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 10000) return null;
  return n;
}
