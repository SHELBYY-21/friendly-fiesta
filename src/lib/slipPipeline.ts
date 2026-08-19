import { parseAmounts } from './amounts';
import { accountLast4, matchPinnedBank, type PinnedBank } from './banks';
import { isLowConfidence, normalizeBankCode } from './botSecurity';

export interface ReplyPhoto {
  file_id: string;
  file_unique_id: string;
}

export type SlipRejectReason =
  | 'not_admin'
  | 'no_reply_photo'
  | 'download_failed'
  | 'ocr_failed'
  | 'amount_invalid'
  | 'account_mismatch'
  | 'no_pinned_account'
  | 'duplicate_slip'
  | 'database_failure';

export type ChatAmountAction =
  | { action: 'thb_in'; value: number }
  | { action: 'usdt_out'; value: number }
  | { action: 'direction_error'; currency: 'THB' | 'USDT' }
  | { action: 'format_help' }
  | { action: 'ambiguous' }
  | { action: 'ignore' };

export function extractReplyPhoto(message: {
  reply_to_message?: {
    photo?: Array<{ file_id?: string; file_unique_id?: string }>;
  };
} | null | undefined): ReplyPhoto | null {
  const photo = message?.reply_to_message?.photo;
  if (!Array.isArray(photo) || photo.length === 0) return null;
  const best = photo[photo.length - 1];
  if (!best?.file_id || !best?.file_unique_id) return null;
  return { file_id: best.file_id, file_unique_id: best.file_unique_id };
}

export function isDownloadFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /TELEGRAM_FILE_DOWNLOAD_FAILED|SLIP_FILE_TOO_LARGE|INVALID_SLIP_FILE|BOT_TOKEN_NOT_CONFIGURED|Telegram getFile/i.test(
    message,
  );
}

export function decideSlipAmount(opts: {
  manualThb: number | null;
  ocrThb: number | null;
  ocrConfidence: number | null | undefined;
  ocrAutoMin: number;
}): { ok: true; thb: number; source: 'manual' | 'ocr' } | { ok: false; reason: 'amount_invalid' | 'ocr_failed' } {
  if (opts.manualThb != null) {
    if (!Number.isFinite(opts.manualThb) || opts.manualThb <= 0) {
      return { ok: false, reason: 'amount_invalid' };
    }
    return { ok: true, thb: opts.manualThb, source: 'manual' };
  }
  if (opts.ocrThb == null || !Number.isFinite(opts.ocrThb) || opts.ocrThb <= 0) {
    return { ok: false, reason: 'ocr_failed' };
  }
  if (isLowConfidence(opts.ocrConfidence, opts.ocrAutoMin)) {
    return { ok: false, reason: 'ocr_failed' };
  }
  return { ok: true, thb: opts.ocrThb, source: 'ocr' };
}

export function decidePinnedMatch(opts: {
  pinned: PinnedBank[];
  ocrBank: string | null | undefined;
  ocrLast4: string | null | undefined;
  manualBank: string | null | undefined;
  manualLast4: string | null | undefined;
}): { ok: true; bank: PinnedBank } | { ok: false; reason: 'no_pinned_account' | 'account_mismatch' } {
  if (opts.pinned.length === 0) return { ok: false, reason: 'no_pinned_account' };

  const ocrBank = normalizeBankCode(opts.ocrBank);
  const ocrLast4 = accountLast4(opts.ocrLast4);
  const manualBank = normalizeBankCode(opts.manualBank);
  const manualLast4 = accountLast4(opts.manualLast4);

  if (ocrBank && ocrLast4 && manualBank && manualLast4) {
    if (ocrBank !== manualBank || ocrLast4 !== manualLast4) {
      return { ok: false, reason: 'account_mismatch' };
    }
  }

  const bankCode = ocrBank ?? manualBank;
  const last4 = ocrLast4 ?? manualLast4;
  const matched = matchPinnedBank(bankCode, last4, opts.pinned);
  if (!matched) return { ok: false, reason: 'account_mismatch' };
  return { ok: true, bank: matched };
}

/** Chat amounts must be signed + suffixed. Never infer currency from a bare number. */
export function classifyChatAmount(text: string): ChatAmountAction {
  const amt = parseAmounts(text);
  if (amt.ambiguous) return { action: 'ambiguous' };
  if (amt.thb && amt.thb.sign > 0) return { action: 'thb_in', value: amt.thb.value };
  if (amt.usdt && amt.usdt.sign < 0) return { action: 'usdt_out', value: amt.usdt.value };
  if (amt.thb && amt.thb.sign < 0) return { action: 'direction_error', currency: 'THB' };
  if (amt.usdt && amt.usdt.sign > 0) return { action: 'direction_error', currency: 'USDT' };
  if (amt.hasBareNumber) return { action: 'format_help' };
  return { action: 'ignore' };
}
