import type { PinnedBank } from './banks';
import { decidePinnedMatch, decideSlipAmount } from './slipPipeline';

/**
 * Action layer — ทุก Input ถูกแปลงเป็น ACTION แล้วค่อย AUTH → VALIDATE → ROUTE
 *
 * AUTO   = ระบบ commit เอง (ห้ามให้คนเป็นตัวกลาง)
 * REVIEW = Exception Queue ให้คนตัดสินใจ
 * BLOCK  = ห้าม mutation
 */
export type ActionName =
  | 'CREATE_INCOMING'
  | 'CREATE_OUTGOING'
  | 'CONFIRM_SLIP'
  | 'CANCEL_SLIP';

export type RouteLevel = 'AUTO' | 'REVIEW' | 'BLOCK';

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

  const amount = decideSlipAmount({
    manualThb: input.manualThb ?? null,
    ocrThb: input.ocrThb ?? null,
    ocrConfidence: input.ocrConfidence,
    ocrAutoMin: input.ocrAutoMin,
  });
  if (!amount.ok) {
    if (amount.reason === 'amount_invalid') return { level: 'BLOCK', reason: 'amount_invalid' };
    return { level: 'REVIEW', reason: 'ocr_failed', thb: input.ocrThb ?? null };
  }

  const pin = decidePinnedMatch({
    pinned: input.pinned,
    ocrBank: input.ocrBank,
    ocrLast4: input.ocrLast4,
    manualBank: input.manualBank,
    manualLast4: input.manualLast4,
  });
  if (!pin.ok) {
    return { level: 'REVIEW', reason: pin.reason, thb: amount.thb };
  }

  return { level: 'AUTO', thb: amount.thb, source: amount.source, bank: pin.bank };
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

  const conf = input.ocrConfidence;
  if (conf == null || !Number.isFinite(conf) || conf < input.ocrAutoMin) {
    return { level: 'REVIEW', reason: 'low_confidence', usdt };
  }

  return { level: 'AUTO', usdt };
}
