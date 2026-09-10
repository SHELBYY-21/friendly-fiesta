/**
 * OCR Flow — speed-focused, no status spam.
 * Uses real analyzeSlip / SlipExtract — never invents amounts.
 */
import type { SlipExtract } from '../ocr';
import { analyzeSlipFast } from '../ocr';
import { shouldSend } from './format';
import {
  buildSlipViewFromParts,
  renderSlipView,
  type SlipViewData,
  type SlipClearanceStatus,
} from './slipView';
import type { OutgoingMessage } from '../telegram';

export type OcrFlowResult = {
  extract: SlipExtract;
  url: string;
  view: SlipViewData;
  message: OutgoingMessage;
};

function money2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Map OCR extract → SlipView (full fields, no mask). */
export function extractToSlipView(
  slip: SlipExtract,
  opts: {
    short: string;
    ledger: string;
    roomRate: number;
    status?: SlipClearanceStatus;
    sentUsdt?: number | null;
  },
): SlipViewData {
  const amount = slip.thbAmount != null ? money2(slip.thbAmount) : 0;
  const rate = money2(opts.roomRate);
  const expected = rate > 0 && amount > 0 ? shouldSend(amount, rate) : 0;
  return buildSlipViewFromParts({
    short: opts.short,
    ledger: opts.ledger,
    amount,
    currency: 'THB',
    bank: slip.bank || '—',
    account: slip.receiverAccount || slip.receiverLast4,
    accountName: slip.receiverName || slip.senderName,
    date: slip.date,
    time: slip.time,
    reference: slip.transRef,
    roomRate: rate,
    sentUsdt: opts.sentUsdt ?? (expected > 0 ? expected : null),
    status: opts.status,
    canConfirm: amount > 0 && rate > 0,
  });
}

/**
 * Silent OCR → extract → calculate → slip card.
 * No intermediate OCR status messages (caller must not spam AiTransition).
 */
export async function processSlipBuffer(opts: {
  buffer: Buffer;
  fileId: string;
  roomRate: number;
  short: string;
  ledger: string;
  upload: (buf: Buffer, fileId: string) => Promise<string>;
}): Promise<OcrFlowResult> {
  const dataUrl = `data:image/jpeg;base64,${opts.buffer.toString('base64')}`;
  const analyzed = await analyzeSlipFast(dataUrl, opts.upload(opts.buffer, opts.fileId));
  const view = extractToSlipView(analyzed.slip, {
    short: opts.short,
    ledger: opts.ledger,
    roomRate: opts.roomRate,
  });
  return {
    extract: analyzed.slip,
    url: analyzed.url,
    view,
    message: renderSlipView(view),
  };
}
