/** Port of goragodwiriya/smart-slip-verifier SlipParser — Thai slip text extract. */

export type SmartSlip = {
  amount: number | null;
  fee: number | null;
  date: string | null;
  time: string | null;
  senderName: string | null;
  receiverName: string | null;
  receiverLast4: string | null;
  senderLast4: string | null;
  receiverAccount: string | null;
  transRef: string | null;
  bank: string | null;
  confidence: number | null;
};

const BANKS: Array<[string, string[]]> = [
  ['KBANK', ['กสิกรไทย', 'กสิกร', 'kbank', 'kasikorn', 'k-plus', 'kplus', 'line bk']],
  ['SCB', ['ไทยพาณิชย์', 'scb easy', 'scb']],
  ['BBL', ['กรุงเทพ', 'bbl', 'bangkok bank']],
  ['KTB', ['กรุงไทย', 'krungthai', 'ktb', 'next']],
  ['BAY', ['กรุงศรี', 'bay', 'krungsri']],
  ['TTB', ['ทหารไทย', 'ทีทีบี', 'ttb', 'tmb']],
  ['GSB', ['ออมสิน', 'gsb']],
  ['CIMB', ['cimb']],
  ['BAAC', ['ธ.ก.ส', 'baac', 'เกษตร']],
];

function first(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = text.match(re);
    const v = m?.[1]?.trim();
    if (v) return v.replace(/\s+/g, ' ').slice(0, 80);
  }
  return null;
}

function money(raw: string | null): number | null {
  if (!raw) return null;
  const n = parseFloat(raw.replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function last4(acct: string | null): string | null {
  const d = String(acct ?? '').replace(/\D/g, '');
  return d.length >= 4 ? d.slice(-4) : null;
}

export function parseSmartSlip(text: string): SmartSlip {
  const t = text || '';
  const amount = money(first(t, [
    /จำนวนเงิน[:\s]*฿?\s*([\d,]+\.?\d*)/i,
    /Amount[:\s]*฿?\s*([\d,]+\.?\d*)/i,
    /฿\s*([\d,]+\.?\d*)/,
    /([\d,]+\.?\d*)\s*บาท/,
  ]));
  const fee = money(first(t, [/ค่าธรรมเนียม[:\s]*฿?\s*([\d,]+\.?\d*)/i, /Fee[:\s]*([\d,]+\.?\d*)/i]));
  const datetime = first(t, [
    /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+(\d{1,2}:\d{2}(?::\d{2})?)/,
  ]);
  const date = datetime?.split(/\s+/)[0] || first(t, [/วันที่[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i]);
  const time = datetime?.split(/\s+/)[1] || first(t, [/เวลา[:\s]*(\d{1,2}:\d{2}(?::\d{2})?)/i, /(\d{1,2}:\d{2}(?::\d{2})?)/]);
  const senderName = first(t, [
    /จาก[:\s]*([^\n]+?)(?=\s*ไปยัง|\s*ถึง|\s*To|\n|$)/i,
    /ผู้โอน[:\s]*([^\n]+)/i,
    /From[:\s]*([^\n]+)/i,
  ]);
  const receiverName = first(t, [
    /ไปยัง[:\s]*([^\n]+?)(?=\s*จำนวน|\s*Amount|\n|$)/i,
    /ผู้รับ[:\s]*([^\n]+)/i,
    /ถึง[:\s]*([^\n]+)/i,
    /To[:\s]*([^\n]+)/i,
  ]);
  const transRef = first(t, [
    /เลขที่รายการ[:\s]*([A-Za-z0-9-]+)/i,
    /รหัสอ้างอิง[:\s]*([A-Za-z0-9-]+)/i,
    /Reference[:\s]*([A-Za-z0-9-]+)/i,
    /Ref(?:erence)?(?:\s*No)?[:\s]*([A-Za-z0-9-]+)/i,
  ]);
  const receiverAccount = first(t, [
    /(?:บัญชีปลายทาง|เข้าบัญชี|เลขที่บัญชี)[:\s]*([0-9Xxх*\s-]{6,24})/i,
    /(x{2,}[-x.]*\d{3,4}x?)/i,
  ]);
  let bank: string | null = null;
  const low = t.toLowerCase();
  for (const [code, keys] of BANKS) {
    if (keys.some((k) => low.includes(k.toLowerCase()))) {
      bank = code;
      break;
    }
  }
  const filled = [amount, date || time, senderName, receiverName, transRef, bank].filter(Boolean).length;
  return {
    amount,
    fee,
    date,
    time,
    senderName,
    receiverName,
    receiverAccount,
    receiverLast4: last4(receiverAccount),
    senderLast4: null,
    transRef,
    bank,
    confidence: Math.min(100, filled * 16),
  };
}
