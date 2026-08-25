import { matchPinnedBank, type PinnedBank } from './banks';
import { isLowConfidence } from './botSecurity';

/**
 * Action layer: AUTO = commit, REVIEW = human, BLOCK = no mutation.
 */
export type IncomingRoute =
  | { level: 'AUTO'; thb: number; source: 'manual' | 'ocr'; bank: PinnedBank }
  | {
      level: 'REVIEW';
      reason: 'low_confidence' | 'account_mismatch' | 'no_pinned_account' | 'ocr_failed';
      thb: number | null;
    }
  | { level: 'BLOCK'; reason: 'amount_invalid' | 'unauthorized' | 'duplicate' };

export type OutgoingRoute =
  | { level: 'AUTO'; usdt: number }
  | { level: 'REVIEW'; reason: 'low_confidence' | 'ocr_failed'; usdt: number | null }
  | { level: 'BLOCK'; reason: 'amount_invalid' | 'unauthorized' | 'duplicate' };

export function routeIncomingSlip(input: {
  authorized: boolean;
  duplicate?: boolean;
  manualThb?: number | null;
  ocrThb?: number | null;
  ocrConfidence?: number | null;
  ocrAutoMin: number;
  pinned: PinnedBank[];
  ocrBank?: string | null;
  ocrLast4?: string | null;
  manualBank?: string | null;
  manualLast4?: string | null;
}): IncomingRoute {
  if (!input.authorized) return { level: 'BLOCK', reason: 'unauthorized' };
  if (input.duplicate) return { level: 'BLOCK', reason: 'duplicate' };

  const manual = input.manualThb ?? null;
  const ocr = input.ocrThb ?? null;
  let thb: number | null = null;
  let source: 'manual' | 'ocr' = 'ocr';

  if (manual != null) {
    if (!Number.isFinite(manual) || manual <= 0) return { level: 'BLOCK', reason: 'amount_invalid' };
    thb = manual;
    source = 'manual';
  } else if (ocr != null && Number.isFinite(ocr) && ocr > 0) {
    if (isLowConfidence(input.ocrConfidence, input.ocrAutoMin)) {
      return { level: 'REVIEW', reason: 'low_confidence', thb: ocr };
    }
    thb = ocr;
    source = 'ocr';
  } else {
    return { level: 'REVIEW', reason: 'ocr_failed', thb: null };
  }

  if (!input.pinned.length) {
    return { level: 'REVIEW', reason: 'no_pinned_account', thb };
  }

  const bank = matchPinnedBank(
    input.manualBank ?? input.ocrBank,
    input.manualLast4 ?? input.ocrLast4,
    input.pinned,
  );
  if (!bank) return { level: 'REVIEW', reason: 'account_mismatch', thb };

  return { level: 'AUTO', thb, source, bank };
}

export function routeOutgoingSlip(input: {
  authorized: boolean;
  duplicate?: boolean;
  usdt: number | null | undefined;
  ocrConfidence?: number | null;
  ocrAutoMin: number;
}): OutgoingRoute {
  if (!input.authorized) return { level: 'BLOCK', reason: 'unauthorized' };
  if (input.duplicate) return { level: 'BLOCK', reason: 'duplicate' };

  const usdt = input.usdt ?? null;
  if (usdt == null || !Number.isFinite(usdt) || usdt <= 0) {
    return { level: 'REVIEW', reason: 'ocr_failed', usdt: null };
  }
  if (isLowConfidence(input.ocrConfidence, input.ocrAutoMin)) {
    return { level: 'REVIEW', reason: 'low_confidence', usdt };
  }
  return { level: 'AUTO', usdt };
}
