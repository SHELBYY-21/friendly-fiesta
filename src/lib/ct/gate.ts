export type OcrGate =
  | 'IN_READY'
  | 'IN_READY_REVIEW'
  | 'OCR_WEAK'
  | 'PIN_MISMATCH'
  | 'NEED_UNIT';

/** Desk KEEP / auto-queue refuse OCR junk like 10,000,000 from barcodes. */
export const MAX_SLIP_THB = 2_000_000;

/**
 * Block first, then review, then auto.
 * IN_READY (payment-ready) requires bank inquiry valid (qrVerified).
 * OCR confidence alone never auto-locks money.
 */
export function gateOcr(input: {
  thb: number | null | undefined;
  confidence: number | null | undefined;
  pinMatch: boolean;
  hasCurrency?: boolean;
  /** True only when slipverify/EasySlip (etc.) returned valid=true */
  qrVerified?: boolean;
}): OcrGate {
  if (input.hasCurrency === false) return 'NEED_UNIT';
  const thb = input.thb;
  if (thb != null && Number.isFinite(thb) && thb > MAX_SLIP_THB) return 'OCR_WEAK';
  if (!input.pinMatch) return 'PIN_MISMATCH';
  const conf = input.confidence;
  if (thb == null || !Number.isFinite(thb) || thb <= 0) return 'NEED_UNIT';
  // Bank-source verified → may auto-queue (still needs pin + desk in canAutoQueue)
  if (input.qrVerified) return 'IN_READY';
  // OCR-only path: never IN_READY
  if (conf == null || !Number.isFinite(conf) || conf < 40) return 'OCR_WEAK';
  return 'IN_READY_REVIEW';
}
