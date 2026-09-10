/**
 * OCR Flow helpers — silent OCR; clearance is a separate stage.
 */
import type { SlipExtract } from '../ocr';
import { shouldSend } from './format';
import { buildSlipViewModel, renderSlipCard, type SlipViewModel } from './slipView';
import type { OutgoingMessage } from '../telegram';

function money2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function extractToSlipView(
  slip: SlipExtract,
  opts: {
    short: string;
    ledger: string;
    roomRate: number;
    operator?: string | null;
    cleared?: boolean;
    matchedSettlementId?: string | null;
  },
): SlipViewModel {
  const amount = slip.thbAmount != null ? money2(slip.thbAmount) : 0;
  const rate = money2(opts.roomRate);
  const expected = rate > 0 && amount > 0 ? shouldSend(amount, rate) : 0;
  return buildSlipViewModel({
    short: opts.short,
    ledger: opts.ledger,
    amount,
    bank: slip.bank || '—',
    account: slip.receiverAccount || slip.receiverLast4,
    accountName: slip.receiverName || slip.senderName,
    date: slip.date,
    time: slip.time,
    reference: slip.transRef,
    confidence: slip.confidence,
    roomRate: rate,
    ocrOk: amount > 0,
    expectedUsdt: expected > 0 ? expected : null,
    cleared: Boolean(opts.cleared),
    matchedSettlementId: opts.matchedSettlementId,
    operator: opts.operator,
    audit: {
      ocrVerifiedAt: amount > 0 ? new Date().toISOString() : null,
      operator: opts.operator ?? null,
    },
  });
}

export function messageForExtract(
  slip: SlipExtract,
  opts: {
    short: string;
    ledger: string;
    roomRate: number;
    operator?: string | null;
  },
): OutgoingMessage {
  return renderSlipCard(extractToSlipView(slip, opts));
}
