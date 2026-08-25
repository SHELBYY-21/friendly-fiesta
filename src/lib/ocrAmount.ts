/**
 * Conservative OCR fallback. It only accepts one unambiguous number explicitly
 * attached to a transfer-amount label and THB currency.
 */
export function pickExplicitThbAmount(text: string): number | null {
  const patterns = [
    /(?:ยอด(?:โอน|เงิน)?|จำนวนเงิน|amount|transferred)\s*[:=]?\s*(?:฿\s*)?(\d[\d,]*(?:\.\d{1,2})?)\s*(?:บาท|THB|฿)/giu,
    /(?:฿\s*)(\d[\d,]*(?:\.\d{1,2})?)\s*(?:บาท|THB)?/giu,
  ];
  const values = new Set<number>();
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const amount = Number(match[1].replace(/,/g, ''));
      if (Number.isFinite(amount) && amount > 0 && amount <= 10_000_000) values.add(amount);
    }
  }
  return values.size === 1 ? [...values][0] : null;
}
