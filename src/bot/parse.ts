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

function last4FromMasked(text: string): string | null {
  const compact = String(text ?? '').replace(/[-.\s]/g, '');
  const masked = compact.match(/x+(\d{4})x?/i);
  if (masked) return masked[1];
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
  const last4 = last4FromMasked(payeeBlock) || (() => {
    const last4Match = cleaned.match(/(?:x{2,}|•{2,}|[*]{2,}|บัญชี|\b)(\d{4})\b/i);
    return last4Match ? last4Match[1] : null;
  })();

  const bankToken =
    payeeBlock.match(/กสิกรไทย|กสิกร|กรุงเทพ|กรุงไทย|ไทยพาณิชย์|กรุงศรี|ออมสิน|ทหารไทย|LINE BK|KBANK|SCB|BBL|KTB|BAY|TTB|GSB|CIMB|KKP/i) ||
    cleaned.match(/กสิกรไทย|กสิกร|กรุงเทพ|กรุงไทย|ไทยพาณิชย์|กรุงศรี|ออมสิน|ทหารไทย|LINE BK|KBANK|SCB|BBL|KTB|BAY|TTB|GSB|CIMB|KKP/i);
  const bank = normalizeBankCode(bankToken ? bankToken[0] : null);

  const nameMatch =
    payeeBlock.match(/บจก\.?\s*([^\nก-ฮ]*[ก-๙A-Za-z].{2,40})/) ||
    cleaned.match(/(?:ผู้รับ|โอนให้|ถึง|ไปยัง)\s*(?:นาย|นางสาว|นาง|คุณ|บจก\.?)?\s*([ก-๙a-zA-Z]{2,}\s+[ก-๙a-zA-Z]{2,})/);
  const receiverName = nameMatch ? nameMatch[1].replace(/\s+กสิกร.*$/i, '').trim() : null;

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
  const raw = (text || '').replace(/^\/pin(?:@[a-z0-9_]+)?/i, '').trim();
  if (!raw) return null;

  const acc =
    raw.match(/เลขบัญชี\s*[:：]?\s*(\d{6,15})/i) ||
    raw.match(/\b(\d{10,15})\b/);
  if (!acc) {
    const parts = raw.split(/\s+/);
    if (parts.length >= 2 && /^\d{6,15}$/.test(parts[1].replace(/\D/g, ''))) {
      const bank = normalizeBankCode(parts[0]);
      const account = parts[1].replace(/\D/g, '');
      if (bank && account.length >= 6) return { bank, account, name: null };
    }
    return null;
  }
  const account = acc[1];

  const bankLine = raw.match(/(?:bank|ธนาคาร)\s*[:：]\s*([^\n]+)/i);
  const headTok = raw.split('\n')[0].match(/BBL|KBANK|SCB|KTB|BAY|TTB|GSB|CIMB|กรุงเทพ|กสิกร|กรุงไทย|ไทยพาณิชย์/i);
  const bank =
    (bankLine ? normalizeBankCode(bankLine[1]) : null) ||
    (headTok ? normalizeBankCode(headTok[0]) : null) ||
    (() => {
      const tok = raw.match(/กรุงเทพ|กสิกรไทย|กสิกร|BBL|KBANK|SCB|KTB|BAY/i);
      return tok ? normalizeBankCode(tok[0]) : null;
    })();
  if (!bank) return null;

  const nameM = raw.match(/ชื่อ(?:\s*-?\s*สกุล)?\s*[:：]\s*([^\n]+)/i);
  const name = nameM ? nameM[1].replace(/^[^\u0E00-\u0E7Fa-zA-Z]+/, '').trim() : null;
  return { bank, account, name: name || null };
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
