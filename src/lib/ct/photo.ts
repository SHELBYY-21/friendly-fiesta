import { sendMessage, editMessage, sendChatAction, downloadTelegramFile, uploadSlipBuffer, getChatPinnedText } from '../telegram';
import { analyzeSlipFast, type SlipExtract } from '../ocr';
import { listPinnedBanks, matchSlipPins, accountLast4, pinBankAccount, ensureTodayPins } from '../banks';
import { findSlipByFingerprint } from '../transactions';
import { findReceiversByLast4 } from '../receivers';
import { slipFingerprint, qrSlipFingerprint } from '../botSecurity';
import { parseDeskPin } from '../../bot/parse';
import { gateOcr, type OcrGate } from './gate';
import { opsRates } from './rates';
import { insertPending, findPendingByFingerprint, type PendingSlip } from './store';
import { shouldSend, maskAcct, clockBkk } from './format';
import { canAutoQueue, commitIncomingLock, dueSummary } from './queue';
import { isOcrJunkAmount } from './settleGuard';
import { applyQrToOcr, type SlipQrResult } from './slipQr';
import { inspectSlipImage } from './slipInquiry';
import * as C from './copy';
import { cardDuplicate, cardAlreadyQueued } from './notice';
import { AiTransition, aiReceived } from './aiTransition';
import type { Admin } from '@/types/transactions';
import type { PinnedBank } from '../banks';

/** Bot API 10 live_photo still sits on photo[]; never OCR the motion clip. */
export function stillFromTelegram(msg: any): { fileId: string; fileUniqueId: string } | null {
  const sizes = msg?.live_photo?.photo ?? msg?.photo;
  if (!Array.isArray(sizes) || !sizes.length) return null;
  const last = sizes[sizes.length - 1];
  if (!last?.file_id) return null;
  return {
    fileId: String(last.file_id),
    fileUniqueId: String(last.file_unique_id ?? last.file_id),
  };
}

async function pinsForToday(chatId: number): Promise<PinnedBank[]> {
  try {
    const rolled = await ensureTodayPins(chatId);
    if (rolled.length) return rolled;
  } catch {
    /* fall through to telegram pin text */
  }
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

async function rejectDuplicate(chatId: number, fingerprint: string): Promise<boolean> {
  const [ledger, pending] = await Promise.all([
    findSlipByFingerprint(fingerprint),
    findPendingByFingerprint(fingerprint),
  ]);
  if (ledger) {
    await sendMessage(chatId, cardDuplicate(ledger.ledgerRef));
    return true;
  }
  if (pending) {
    await sendMessage(chatId, cardAlreadyQueued(pending.ledger_ref));
    return true;
  }
  return false;
}

async function readSlip(chatId: number, fileId: string, cardIdP: Promise<number>): Promise<{
  cardId: number;
  url: string;
  slip: SlipExtract;
  qr: SlipQrResult | null;
} | null> {
  try {
    const buffer = await downloadTelegramFile(fileId);
    const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;
    const qrP = inspectSlipImage(buffer).catch(() => null);
    const [cardId, analyzed, qr] = await Promise.all([
      cardIdP,
      analyzeSlipFast(dataUrl, uploadSlipBuffer(buffer, fileId)),
      qrP,
    ]);
    const slip = qr ? applyQrToOcr(analyzed.slip, qr) : analyzed.slip;
    return { cardId, url: analyzed.url, slip, qr };
  } catch (e: any) {
    const cardId = await cardIdP.catch(() => 0);
    if (cardId) await editMessage(chatId, cardId, { text: `อ่านสลิปไม่สำเร็จ — ${e?.message ?? 'ลองส่งใหม่'}` });
    return null;
  }
}

export async function handleCtPhoto(opts: { chatId: number; userId: number; admin: Admin; fileId: string; fileUniqueId: string; }): Promise<void> {
  const { chatId, userId, admin, fileId, fileUniqueId } = opts;
  const [pins, rates] = await Promise.all([pinsForToday(chatId), opsRates(chatId)]);
  const todayPin = pins[0];
  await sendChatAction(chatId, 'typing');
  const cardIdP = sendMessage(chatId, aiReceived());
  const read = await readSlip(chatId, fileId, cardIdP);
  if (!read) return;
  const { cardId, url, slip, qr } = read;

  const fileFp = slipFingerprint(fileUniqueId);
  const fingerprints = qr?.transRef
    ? [qrSlipFingerprint(qr.transRef, qr.sendingBankCode), fileFp]
    : [fileFp];
  for (const fp of fingerprints) {
    if (await rejectDuplicate(chatId, fp)) return;
  }
  const fingerprint = fingerprints[0];

  const ai = new AiTransition(chatId, cardId);
  await ai.step('ocr');
  const matchedPin = matchSlipPins(slip.bank, slip.receiverLast4, slip.senderLast4, pins);
  const pinMatch = Boolean(matchedPin);
  const thb = slip.thbAmount && slip.thbAmount > 0 ? slip.thbAmount : null;
  const last4Early = accountLast4(matchedPin?.account_number) ?? slip.receiverLast4 ?? slip.senderLast4;
  await ai.step('match', { bank: slip.bank ?? todayPin?.bank_name, last4: last4Early, thb });
  const qrVerified = Boolean(qr?.inquiry?.valid);
  let gate = gateOcr({ thb, confidence: slip.confidence, pinMatch, hasCurrency: thb != null, qrVerified });
  if (qr?.inquiry && qr.inquiry.valid === false) gate = 'OCR_WEAK';
  const usdtDue = thb && rates.desk ? shouldSend(thb, rates.desk) : null;
  await ai.step('calc', { thb, usdt: usdtDue, bank: slip.bank ?? todayPin?.bank_name, last4: last4Early });
  const notes = [
    isOcrJunkAmount(thb) ? 'OCR_JUNK:AMOUNT_TOO_LARGE' : null,
    qr?.transRef ? `QR:${qr.transRef}` : null,
    qrVerified ? `QR_OK:${qr?.inquiry?.provider ?? 'ok'}` : null,
    qr?.inquiry && qr.inquiry.valid === false ? 'QR_INVALID' : null,
  ].filter(Boolean).join('|') || null;
  const pending = await insertPending({
    chat_id: chatId, admin_tg_id: userId, admin_name: admin.name,
    status: gate === 'IN_READY_REVIEW' ? 'IN_READY_REVIEW' : gate,
    thb_in: thb, should_send: usdtDue, desk_rate: rates.desk || null, mkt_rate: rates.mkt, bot_usd: rates.usd,
    bank: matchedPin?.bank_name ?? slip.bank ?? null,
    account_masked: maskAcct(last4Early),
    name: slip.receiverName ?? slip.senderName ?? null, pin_match: pinMatch, ocr_confidence: slip.confidence ?? null,
    source_file_id: fileId, slip_url: url, slip_fingerprint: fingerprint, message_id: cardId,
    undo_until: null, tx_id: null,
    note: notes,
    bank_account_id: matchedPin?.id ?? null,
  });
  const last4 = last4Early;
  if (canAutoQueue(gate, thb, rates.desk) && pinMatch) {
    const queued = await tryQueue(pending, { chatId, userId, admin, cardId, last4, bank: matchedPin?.bank_name ?? todayPin?.bank_name ?? slip.bank ?? '—' });
    if (queued) return;
  }
  const known = last4 ? await findReceiversByLast4(last4) : [];
  await editMessage(chatId, cardId, renderGateCard(pending, {
    gate, slipBank: slip.bank ?? '—', slipLast4: last4Early ?? slip.receiverLast4 ?? '????',
    pinBank: matchedPin?.bank_name ?? todayPin?.bank_name ?? '—', pinLast4: accountLast4(matchedPin?.account_number ?? todayPin?.account_number) ?? 'ยังไม่หมุด',
    lead: admin.role === 'SuperAdmin' || admin.role === 'Admin',
    chips: thb ? [thb] : [500, 1000], fresh: Boolean(last4) && known.length === 0,
  }));
}

async function tryQueue(pending: PendingSlip, ctx: { chatId: number; userId: number; admin: Admin; cardId: number; last4: string | null; bank: string; }): Promise<boolean> {
  try {
    const locked = await commitIncomingLock(pending, { chatId: ctx.chatId, userId: ctx.userId, admin: ctx.admin, force: false, queued: true });
    const batch = await dueSummary(ctx.chatId);
    await editMessage(ctx.chatId, ctx.cardId, C.cardLocked({
      thb: locked.thb_in ?? 0, shouldSend: locked.should_send ?? 0, desk: locked.desk_rate ?? 0, mkt: locked.mkt_rate,
      ledger: locked.ledger_ref, adminName: ctx.admin.name, time: clockBkk(), short: locked.short_ref,
      canUndo: true, queued: true, batch, bank: locked.bank ?? ctx.bank, last4: ctx.last4 ?? '????', name: locked.name,
    }));
    return true;
  } catch { return false; }
}

export function renderGateCard(p: PendingSlip, extra: { gate: OcrGate; slipBank: string; slipLast4: string; pinBank: string; pinLast4: string; lead: boolean; chips: number[]; fresh?: boolean; }) {
  if (extra.gate === 'PIN_MISMATCH') return C.cardPinMismatch({ slipBank: extra.slipBank, slipLast4: extra.slipLast4, pinBank: extra.pinBank, pinLast4: extra.pinLast4, name: p.name, confidence: p.ocr_confidence ?? 0, short: p.short_ref, lead: extra.lead });
  if (extra.gate === 'NEED_UNIT') return C.cardNeedUnit({ short: p.short_ref });
  if (extra.gate === 'OCR_WEAK') return C.cardOcrWeak({ bank: extra.slipBank, last4: extra.slipLast4, name: p.name, confidence: p.ocr_confidence ?? 0, short: p.short_ref, chips: extra.chips });
  return C.cardInReady({ review: extra.gate === 'IN_READY_REVIEW', thb: p.thb_in ?? 0, shouldSend: p.should_send ?? 0, desk: p.desk_rate ?? 0, mkt: p.mkt_rate, bank: extra.pinBank || extra.slipBank, last4: extra.pinLast4 || extra.slipLast4, name: p.name, confidence: p.ocr_confidence ?? 0, ledger: p.ledger_ref, adminName: p.admin_name ?? 'Admin', short: p.short_ref, fresh: extra.fresh });
}
