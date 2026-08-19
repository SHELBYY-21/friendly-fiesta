import { parseAmounts } from './amounts';
import { accountLast4, matchPinnedBank, type PinnedBank } from './banks';
import { isLowConfidence, normalizeBankCode } from './botSecurity';

export interface SlipPhoto {
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
  | { action: 'both'; thb: number; usdt: number }
  | { action: 'direction_error'; currency: 'THB' | 'USDT' }
  | { action: 'format_help' }
  | { action: 'ambiguous' }
  | { action: 'ignore' };

type PhotoSize = { file_id?: string; file_unique_id?: string; width?: number; height?: number };
type ImageDocument = { file_id?: string; file_unique_id?: string; mime_type?: string; file_name?: string };
type SlipMessage = {
  photo?: PhotoSize[];
  document?: ImageDocument;
  reply_to_message?: {
    photo?: PhotoSize[];
    document?: ImageDocument;
  };
};

function bestPhoto(photos?: PhotoSize[] | null): SlipPhoto | null {
  if (!Array.isArray(photos) || photos.length === 0) return null;
  const ranked = [...photos].sort((a, b) => {
    const areaA = Number(a.width || 0) * Number(a.height || 0);
    const areaB = Number(b.width || 0) * Number(b.height || 0);
    if (areaA !== areaB) return areaA - areaB;
    return 0;
  });
  const best = ranked[ranked.length - 1] ?? photos[photos.length - 1];
  if (!best?.file_id || !best?.file_unique_id) return null;
  return { file_id: best.file_id, file_unique_id: best.file_unique_id };
}

function imageDocument(doc?: ImageDocument | null): SlipPhoto | null {
  if (!doc?.file_id || !doc?.file_unique_id) return null;
  const mime = String(doc.mime_type || '').toLowerCase();
  const name = String(doc.file_name || '').toLowerCase();
  const looksImage = mime.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(name);
  if (!looksImage) return null;
  return { file_id: doc.file_id, file_unique_id: doc.file_unique_id };
}

function mediaFrom(node?: { photo?: PhotoSize[]; document?: ImageDocument } | null): SlipPhoto | null {
  return bestPhoto(node?.photo) ?? imageDocument(node?.document);
}

/** Reply รูปสลิป — รองรับ photo และไฟล์รูป (document) */
export function extractReplyPhoto(message: SlipMessage | null | undefined): SlipPhoto | null {
  return mediaFrom(message?.reply_to_message);
}

/**
 * หารูปสลิปจากข้อความปัจจุบันหรือที่ reply
 * ใช้ได้ทั้ง /save_slip แบบ reply, caption บนรูป, และไฟล์รูป
 */
export function extractSlipPhotoFromMessage(message: SlipMessage | null | undefined): SlipPhoto | null {
  return mediaFrom(message) ?? mediaFrom(message?.reply_to_message);
}

export function isSlipMediaMessage(message: SlipMessage | null | undefined): boolean {
  return extractSlipPhotoFromMessage(message) != null;
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

  // คำสั่งชัดเจน /save_slip +500B KBANK 7890 ใช้บัญชีที่ปักหมุด — แก้ OCR ที่อ่านผิดได้
  if (manualBank && manualLast4) {
    const matched = matchPinnedBank(manualBank, manualLast4, opts.pinned);
    if (!matched) return { ok: false, reason: 'account_mismatch' };
    return { ok: true, bank: matched };
  }

  const matched = matchPinnedBank(ocrBank, ocrLast4, opts.pinned);
  if (!matched) return { ok: false, reason: 'account_mismatch' };
  return { ok: true, bank: matched };
}

/** Chat amounts must be signed + suffixed. Never infer currency from a bare number. */
export function classifyChatAmount(text: string): ChatAmountAction {
  const amt = parseAmounts(text);
  if (amt.ambiguous) return { action: 'ambiguous' };

  const thb = amt.thb;
  const usdt = amt.usdt;
  if (thb && thb.sign < 0) return { action: 'direction_error', currency: 'THB' };
  if (usdt && usdt.sign > 0) return { action: 'direction_error', currency: 'USDT' };
  if (thb && usdt && thb.sign > 0 && usdt.sign < 0) {
    return { action: 'both', thb: thb.value, usdt: usdt.value };
  }
  if (thb && thb.sign > 0) return { action: 'thb_in', value: thb.value };
  if (usdt && usdt.sign < 0) return { action: 'usdt_out', value: usdt.value };
  if (amt.hasBareNumber) return { action: 'format_help' };
  return { action: 'ignore' };
}

export function telegramDisplayName(from: { first_name?: string; last_name?: string } | null | undefined, userId: number): string {
  const name = [from?.first_name, from?.last_name].filter(Boolean).join(' ').trim();
  return (name || `Admin ${userId}`).slice(0, 60);
}
