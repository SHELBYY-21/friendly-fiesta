import { sendMessage, editMessage, uploadSlipFromTelegram } from '../telegram';
import { analyzeSlip } from '../ocr';
import { listPinnedBanks, matchPinnedBank, accountLast4 } from '../banks';
import { findSlipByFingerprint } from '../transactions';
import { findReceiversByLast4 } from '../receivers';
import { slipFingerprint } from '../botSecurity';
import { gateOcr } from './gate';
import { opsRates } from './rates';
import { insertPending } from './store';
import { shouldSend, maskAcct } from './format';
import * as C from './copy';
import type { Admin } from '@/types/transactions';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function handleCtPhoto(opts: {
  chatId: number;
  userId: number;
  admin: Admin;
  fileId: string;
  fileUniqueId: string;
}): Promise<void> {
  const { chatId, userId, admin, fileId, fileUniqueId } = opts;
  const fingerprint = slipFingerprint(fileUniqueId);
  const dup = await findSlipByFingerprint(fingerprint);
  if (dup) {
    await sendMessage(chatId, {
      text: `สลิปนี้ถูกบันทึกแล้ว${dup.ledgerRef ? ` — <code>${dup.ledgerRef}</code>` : ''}`,
    });
    return;
  }

  const pinned = await listPinnedBanks(chatId);
  const pin0 = pinned[0];
  const scanId = await sendMessage(
    chatId,
    C.skeletonScan(pin0?.bank_name ?? '—', accountLast4(pin0?.account_number) ?? '????'),
  );
  await sleep(350);

  let imgUrl: string;
  let slip: Awaited<ReturnType<typeof analyzeSlip>>;
  try {
    imgUrl = await uploadSlipFromTelegram(fileId);
    slip = await analyzeSlip(imgUrl);
  } catch (e: any) {
    await editMessage(chatId, scanId, {
      text: `อ่านสลิปไม่สำเร็จ — ${e?.message ?? 'ลองส่งใหม่'}`,
    });
    return;
  }

  await editMessage(chatId, scanId, C.skeletonRead());
  await sleep(300);

  const rates = await opsRates(chatId);
  const bank = matchPinnedBank(slip.bank, slip.receiverLast4, pinned);
  const pinMatch = Boolean(bank);
  const thb = slip.thbAmount && slip.thbAmount > 0 ? slip.thbAmount : null;
  const gate = gateOcr({
    thb,
    confidence: slip.confidence,
    pinMatch,
    hasCurrency: thb != null,
  });

  const owed = thb && rates.desk ? shouldSend(thb, rates.desk) : null;
  const pending = await insertPending({
    chat_id: chatId,
    admin_tg_id: userId,
    admin_name: admin.name,
    status: gate === 'IN_READY_REVIEW' ? 'IN_READY_REVIEW' : gate,
    thb_in: thb,
    should_send: owed,
    desk_rate: rates.desk || null,
    mkt_rate: rates.mkt,
    bot_usd: rates.usd,
    bank: slip.bank ?? bank?.bank_name ?? null,
    account_masked: maskAcct(slip.receiverLast4 ?? accountLast4(bank?.account_number)),
    name: slip.receiverName ?? null,
    pin_match: pinMatch,
    ocr_confidence: slip.confidence ?? null,
    source_file_id: fileId,
    slip_url: imgUrl,
    slip_fingerprint: fingerprint,
    message_id: scanId,
    undo_until: null,
    tx_id: null,
    note: null,
    bank_account_id: bank?.id ?? null,
  });

  const last4 = slip.receiverLast4 ?? accountLast4(bank?.account_number);
  const known = last4 ? await findReceiversByLast4(last4) : [];
  const card = renderGateCard(pending, {
    gate,
    slipBank: slip.bank ?? '—',
    slipLast4: slip.receiverLast4 ?? '????',
    pinBank: pin0?.bank_name ?? '—',
    pinLast4: accountLast4(pin0?.account_number) ?? '????',
    lead: admin.role === 'SuperAdmin' || admin.role === 'Admin',
    chips: thb ? [thb] : [500, 1000],
    fresh: Boolean(last4) && known.length === 0,
  });
  await editMessage(chatId, scanId, card);
}

export function renderGateCard(
  p: Awaited<ReturnType<typeof insertPending>>,
  extra: {
    gate: ReturnType<typeof gateOcr>;
    slipBank: string;
    slipLast4: string;
    pinBank: string;
    pinLast4: string;
    lead: boolean;
    chips: number[];
    fresh?: boolean;
  },
) {
  if (extra.gate === 'PIN_MISMATCH') {
    return C.cardPinMismatch({
      slipBank: extra.slipBank,
      slipLast4: extra.slipLast4,
      pinBank: extra.pinBank,
      pinLast4: extra.pinLast4,
      confidence: p.ocr_confidence ?? 0,
      short: p.short_ref,
      lead: extra.lead,
    });
  }
  if (extra.gate === 'NEED_UNIT') return C.cardNeedUnit({ short: p.short_ref });
  if (extra.gate === 'OCR_WEAK') {
    return C.cardOcrWeak({
      bank: extra.slipBank,
      last4: extra.slipLast4,
      name: p.name,
      confidence: p.ocr_confidence ?? 0,
      short: p.short_ref,
      chips: extra.chips,
    });
  }
  return C.cardInReady({
    review: extra.gate === 'IN_READY_REVIEW',
    thb: p.thb_in ?? 0,
    shouldSend: p.should_send ?? 0,
    desk: p.desk_rate ?? 0,
    mkt: p.mkt_rate,
    bank: extra.pinBank || extra.slipBank,
    last4: extra.pinLast4 || extra.slipLast4,
    name: p.name,
    confidence: p.ocr_confidence ?? 0,
    ledger: p.ledger_ref,
    adminName: p.admin_name ?? 'Admin',
    short: p.short_ref,
    fresh: extra.fresh,
  });
}
