export type OcrGate =
  | 'IN_READY'
  | 'IN_READY_REVIEW'
  | 'OCR_WEAK'
  | 'PIN_MISMATCH'
  | 'NEED_UNIT';

/** Desk KEEP / auto-queue refuse OCR junk like 10,000,000 from barcodes. */
export const MAX_SLIP_THB = 2_000_000;

/** Block first, then review, then auto. Do not reorder. */
export function gateOcr(input: {
  thb: number | null | undefined;
  confidence: number | null | undefined;
  pinMatch: boolean;
  hasCurrency?: boolean;
}): OcrGate {
  if (input.hasCurrency === false) return 'NEED_UNIT';
  if (!input.pinMatch) return 'PIN_MISMATCH';
  const thb = input.thb;
  const conf = input.confidence;
  if (thb == null || !Number.isFinite(thb) || thb <= 0) return 'NEED_UNIT';
  if (thb > MAX_SLIP_THB) return 'OCR_WEAK';
  if (conf == null || !Number.isFinite(conf) || conf < 80) return 'OCR_WEAK';
  if (conf < 95) return 'IN_READY_REVIEW';
  return 'IN_READY';
}
