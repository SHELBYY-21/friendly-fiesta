import { sendMessage, editMessage, downloadTelegramFile, uploadSlipBuffer, getChatPinnedText } from '../telegram';
import { analyzeSlipFast } from '../ocr';
import { listPinnedBanks, matchPinnedBank, accountLast4, pinBankAccount } from '../banks';
import { findSlipByFingerprint } from '../transactions';
import { findReceiversByLast4 } from '../receivers';
import { slipFingerprint } from '../botSecurity';
import { parseDeskPin } from '../../bot/parse';
import { gateOcr } from './gate';
import { opsRates } from './rates';
import { insertPending, findPendingByFingerprint } from './store';
import { shouldSend, maskAcct, clockBkk } from './format';
import { canAutoQueue, commitIncomingLock, dueSummary } from './queue';
import * as C from './copy';
import type { Admin } from '@/types/transactions';
import type { PinnedBank } from '../banks';

async function ensureTodayPins(chatId: number): Promise<PinnedBank[]> {
  const existing = await listPinnedBanks(chatId);
  if (existing.length) return existing;
  const pinnedText = await getChatPinnedText(chatId);
  const desk = pinnedText ? parseDeskPin(pinnedText) : null;
  if (!desk) return [];
  try {
    const { pinned } = await pinBankAccount(chatId, desk.bank, desk.account, desk.name);
    return pinned;
  } catch {
    return [];
  }
}

export async function handleCtPhoto(opts: {
  chatId: number;
  userId: number;
  admin: Admin;
  fileId: string;
  fileUniqueId: string;
}): Promise<void> {
  const { chatId, userId, admin, fileId, fileUniqueId } = opts;
  const fingerprint = slipFingerprint(fileUniqueId);

  const [dup, queued, pinned, rates] = await Promise.all([
    findSlipByFingerprint(fingerprint),
    findPendingByFingerprint(fingerprint),
    ensureTodayPins(chatId),
    opsRates(chatId),
  ]);
  if (dup) {
    await sendMessage(chatId, {
      text: `สลิปนี้ถูกบันทึกแล้ว${dup.ledgerRef ? ` — <code>${dup.ledgerRef}</code>` : ''}`,
    });
    return;
  }
  if (queued) {
    await sendMessage(chatId, {
      text: `◈  <b>CT</b>\n<i>[ คิว ]</i>\n\nสลิปใบนี้มีในคิวแล้ว\n<code>${queued.ledger_ref}</code>\nใช้ปุ่มบนการ์ดเดิม`,
    });
    return;
  }

  const pin0 = pinned[0];
  const scanP = sendMessage(
    chatId,
    C.skeletonScan(pin0?.bank_name ?? 'ยังไม่หมุด', accountLast4(pin0?.account_number) ?? '----'),
  );

  let imgUrl: string;
  let slip: Awaited<ReturnType<typeof analyzeSlipFast>>['slip'];
  let scanId: number;
  try {
    const buffer = await downloadTelegramFile(fileId);
    const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;
    const publicUrlP = uploadSlipBuffer(buffer, fileId);
    const [scan, analyzed] = await Promise.all([
      scanP,
      analyzeSlipFast(dataUrl, publicUrlP),
    ]);
    scanId = scan;
    imgUrl = analyzed.url;
    slip = analyzed.slip;
  } catch (e: any) {
    scanId = await scanP.catch(() => 0);
    if (scanId) {
      await editMessage(chatId, scanId, {
        text: `อ่านสลิปไม่สำเร็จ — ${e?.message ?? 'ลองส่งใหม่'}`,
      });
    }
    return;
  }

  editMessage(chatId, scanId, C.skeletonRead()).catch(() => undefined);
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

  if (canAutoQueue(gate, thb, rates.desk) && pinMatch) {
    try {
      const locked = await commitIncomingLock(pending, {
        chatId, userId, admin, force: false, queued: true,
      });
      const batch = await dueSummary(chatId);
      await editMessage(chatId, scanId, C.cardLocked({
        thb: locked.thb_in ?? 0,
        shouldSend: locked.should_send ?? 0,
        desk: locked.desk_rate ?? 0,
        mkt: locked.mkt_rate,
        ledger: locked.ledger_ref,
        adminName: admin.name,
        time: clockBkk(),
        short: locked.short_ref,
        canUndo: true,
        queued: true,
        batch,
        bank: locked.bank ?? extraBank(pin0, slip.bank),
        last4: last4 ?? '????',
        name: locked.name,
      }));
      return;
    } catch {
      /* fall through to review card */
    }
  }

  const known = last4 ? await findReceiversByLast4(last4) : [];

  const card = renderGateCard(pending, {
    gate,
    slipBank: slip.bank ?? '—',
    slipLast4: slip.receiverLast4 ?? '????',
    pinBank: pin0?.bank_name ?? '—',
    pinLast4: accountLast4(pin0?.account_number) ?? 'ยังไม่หมุด',
    lead: admin.role === 'SuperAdmin' || admin.role === 'Admin',
    chips: thb ? [thb] : [500, 1000],
    fresh: Boolean(last4) && known.length === 0,
  });
  await editMessage(chatId, scanId, card);
}

function extraBank(pin0: PinnedBank | undefined, slipBank: string | null): string {
  return pin0?.bank_name ?? slipBank ?? '—';
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
      name: p.name,
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
