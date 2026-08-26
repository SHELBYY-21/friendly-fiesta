import { answerCallback, editMessage, sendMessage, sendPhoto, editPhoto, deleteMessage } from '../telegram';
import { parseAmounts } from '../amounts';
import { parseDeskPin, parseDeskRate, hasRatePrefix, isBareDeskRate, parseTelegramId } from '../../bot/parse';
import { listPinnedBanks, accountLast4, pinBankAccount, unpinBankAccount } from '../banks';
import {
  recordOutgoing,
  deleteTransaction,
  listAdmins,
  upsertAdmin,
} from '../transactions';
import { getSession, setSession, clearSession } from '../botSessions';
import { findSlip, patchSlip, type PendingSlip } from './store';
import { renderVault, renderRecent } from './vault';
import { opsRates, applyDeskRate } from './rates';
import { commitIncomingLock, dueSummary, settleAllDue } from './queue';
import { shouldSend, clockBkk, displayLedger, adminKeyboard, thbCard, usdt } from './format';
import { renderHeroPng } from './cardImage';
import { gateOcr } from './gate';
import { renderGateCard } from './photo';
import * as C from './copy';
import type { Admin } from '@/types/transactions';

export function parseCb(data: string): {
  domain: string;
  action: string;
  ref: string;
  extra: string;
} {
  const parts = (data || '').split(':');
  return {
    domain: parts[0] || '',
    action: parts[1] || '',
    ref: (parts[2] || '').toUpperCase(),
    extra: parts.slice(3).join(':'),
  };
}

export function isCtCallback(data: string): boolean {
  const d = (data || '').split(':')[0];
  return d === 'vault' || d === 'slip' || d === 'pin' || d === 'admin';
}

export const SLIP_ACTIONS = new Set([
  'lock', 'queue', 'force', 'forceask', 'settle', 'undo', 'delask', 'delete',
  'open', 'copy', 'hold', 'cancel', 'retry', 'edit', 'note', 'amt', 'unit',
]);

export const VAULT_ACTIONS = new Set(['today', 'pending', 'rateask', 'newday', 'recent', 'all', 'set', 'batch']);
export const PIN_ACTIONS = new Set(['view', 'unpin']);
export const ADMIN_ACTIONS = new Set(['add']);

export type ReplyCmd = 'vault' | 'pending' | 'menu' | 'newday' | 'pin' | 'rate' | 'recent' | 'settings' | 'addadmin';

export function matchReplyCommand(text: string): ReplyCmd | null {
  const t = (text || '').trim();
  const low = t.toLowerCase();
  if (
    t === 'ยอดวันนี้' || t === 'ยอด' || t === 'วันนี้' || t === 'VAULT' || t === 'VAULT วันนี้' || t === '/vault' || t === '/today' ||
    t === 'สรุปวันนี้'
  ) return 'vault';
  if (t === 'รอส่ง' || t === 'คิว' || t === 'wait' || t === '/pending') return 'pending';
  if (t === 'ตั้งค่า' || t === 'ตั้ง' || t === '/settings') return 'settings';
  if (t === '/admin' || t === 'แอด' || t === '+แอด' || t === 'เพิ่มผู้ดูแล') return 'addadmin';
  if (t === 'เมนู' || t === '/menu' || t === '/help' || low === 'menu' || t === 'ช่วย') return 'settings';
  if (t === 'วันใหม่' || t === 'ใหม่' || t === '/newday' || low === 'new') return 'newday';
  if (t === 'pin' || t === 'หมุด' || t === 'บัญชีรับ' || t === '/pin' || t === 'บัญชี') return 'pin';
  if (t === '/recent' || t === '/recent_slips') return 'recent';
  if (/^(?:\/setrate(?:@[a-z0-9_]+)?|\/rate(?:@[a-z0-9_]+)?|setrate|rate|เรท|เรต|อัตรา|เรทตอนนี้|เรทวันนี้|เรตตอนนี้|อัตราแลกเปลี่ยน)\s*$/i.test(t)) {
    return 'rate';
  }
  return null;
}

function isLead(admin: Admin): boolean {
  return admin.role === 'SuperAdmin' || admin.role === 'Admin';
}

function canUndo(p: PendingSlip): boolean {
  if (!p.undo_until) return false;
  return Date.now() < new Date(p.undo_until).getTime();
}

async function renderSettings(chatId: number) {
  const [rates, pinned, admins] = await Promise.all([
    opsRates(chatId),
    listPinnedBanks(chatId),
    listAdmins().catch(() => [] as Admin[]),
  ]);
  return C.settingsCard({
    desk: rates.desk || null,
    mkt: rates.mkt,
    pins: pinned.map((b) => ({
      bank: b.bank_name,
      last4: accountLast4(b.account_number) ?? '????',
    })),
    admins: admins.map((a) => ({ name: a.name, role: a.role || 'admin' })),
  });
}

async function armRatePrompt(chatId: number, userId: number) {
  try {
    await setSession(chatId, userId, { state: 'AWAITING_RATE' });
  } catch { /* session table optional */ }
}

async function armAdminPrompt(chatId: number, userId: number) {
  try {
    await setSession(chatId, userId, { state: 'AWAITING_ADMIN' });
  } catch { /* session table optional */ }
}

async function addAdminById(chatId: number, tgId: number) {
  const row = await upsertAdmin(tgId, `Admin ${tgId}`);
  await sendMessage(chatId, C.adminAdded(tgId, row.name));
  await sendMessage(chatId, await renderSettings(chatId));
}

async function load(chatId: number, ref: string, cbId: string): Promise<PendingSlip | null> {
  const p = await findSlip(chatId, ref);
  if (!p) {
    await answerCallback(cbId, 'ปุ่มนี้หมดอายุแล้วครับ');
    return null;
  }
  return p;
}

async function redraw(chatId: number, messageId: number | undefined, card: { text: string; reply_markup?: unknown }) {
  if (messageId) await editMessage(chatId, messageId, card);
  else await sendMessage(chatId, card);
}

async function sendHero(
  chatId: number,
  messageId: number | undefined,
  kind: 'vault' | 'locked' | 'settled',
  card: { text: string; reply_markup?: unknown },
  hero: string,
  sub?: string,
  meta?: string,
): Promise<number> {
  const png = renderHeroPng(kind, { hero, sub, meta });
  if (messageId) {
    const ok = await editPhoto(chatId, messageId, png, card);
    if (ok) return messageId;
  }
  const id = await sendPhoto(chatId, png, card);
  if (messageId) await deleteMessage(chatId, messageId);
  return id;
}

export async function handleCtCallback(opts: {
  id: string;
  chatId: number;
  userId: number;
  admin: Admin;
  data: string;
  messageId?: number;
}): Promise<void> {
  const { id, chatId, userId, admin, data, messageId } = opts;
  const cb = parseCb(data);

  if (cb.domain === 'vault') {
    if (cb.action === 'batch') {
      const due = await dueSummary(chatId);
      if (!due.count) {
        await answerCallback(id, 'ยังไม่มีคิวรอส่ง');
        return;
      }
      const done = await settleAllDue(chatId, userId);
      await answerCallback(id, `โอนรวม ${done.count} ใบ`);
      const card = C.cardSettledBatch({
        count: done.count,
        thb: done.thb,
        usdt: done.usdt,
        adminName: admin.name,
      });
      await sendHero(chatId, messageId, 'settled', card, `${usdt(done.usdt)} USDT`, `${done.count} TX`, 'CT');
      return;
    }
    if (cb.action === 'rateask') {
      const rates = await opsRates(chatId);
      await armRatePrompt(chatId, userId);
      await answerCallback(id, 'อัตรา');
      await sendMessage(chatId, C.askDeskRate(rates.desk || null));
      return;
    }
    if (cb.action === 'set') {
      await answerCallback(id, 'ตั้ง');
      await redraw(chatId, messageId, await renderSettings(chatId));
      return;
    }
    if (cb.action === 'newday') {
      const { startNewDay } = await import('../botSessions');
      await startNewDay(chatId);
      await answerCallback(id, 'วันใหม่');
      const view = await renderVault(chatId, 'today');
      await sendHero(chatId, messageId, 'vault', view, 'VAULT', 'NEW DAY', '◈');
      return;
    }
    const mode = cb.action === 'pending' ? 'pending' : cb.action === 'all' ? 'all' : 'today';
    await answerCallback(id, mode === 'pending' ? 'รอส่ง' : 'สรุปยอด');
    const view = cb.action === 'recent'
      ? await renderRecent(chatId, admin.name)
      : await renderVault(chatId, mode);
    await sendHero(chatId, messageId, 'vault', view, mode === 'pending' ? 'WAIT' : 'VAULT', 'CT DESK', '◈');
    return;
  }

  if (cb.domain === 'pin' && cb.action === 'view') {
    await answerCallback(id, 'บัญชีรับ');
    const pinned = await listPinnedBanks(chatId);
    await redraw(chatId, messageId, C.pinView(pinned.map((b) => ({
      bank: b.bank_name,
      last4: accountLast4(b.account_number) ?? '????',
    }))));
    return;
  }

  if (cb.domain === 'pin' && cb.action === 'unpin') {
    const slot = cb.ref || cb.extra;
    await unpinBankAccount(chatId, slot);
    await answerCallback(id, 'ยกเลิกบัญชีแล้ว');
    const pinned = await listPinnedBanks(chatId);
    await redraw(chatId, messageId, C.pinView(pinned.map((b) => ({
      bank: b.bank_name,
      last4: accountLast4(b.account_number) ?? '????',
    }))));
    return;
  }

  if (cb.domain === 'admin' && cb.action === 'add') {
    if (!isLead(admin)) {
      await answerCallback(id, 'ใช้ได้เฉพาะหัวหน้าห้องครับ');
      return;
    }
    await armAdminPrompt(chatId, userId);
    await answerCallback(id, 'กรุณาส่งไอดี');
    await sendMessage(chatId, C.askAdminId());
    return;
  }

  if (cb.domain === 'slip' && cb.action === 'unithelp') {
    await answerCallback(id);
    await sendMessage(chatId, C.unitHelp());
    return;
  }

  if (cb.domain === 'slip' && cb.action === 'recent') {
    await answerCallback(id, 'TODAY');
    await redraw(chatId, messageId, await renderRecent(chatId, admin.name));
    return;
  }

  if (cb.domain !== 'slip') {
    await answerCallback(id, 'ปุ่มนี้หมดอายุแล้วครับ');
    return;
  }

  const p = await load(chatId, cb.ref, id);
  if (!p) {
    if (messageId) await editMessage(chatId, messageId, C.expiredToastCard());
    return;
  }

  switch (cb.action) {
    case 'lock':
      await doLock(id, chatId, userId, admin, p, messageId, false, false);
      return;
    case 'queue':
      await doLock(id, chatId, userId, admin, p, messageId, false, true);
      return;
    case 'force':
      if (!isLead(admin)) {
        await answerCallback(id, 'ใช้ได้เฉพาะหัวหน้าห้องครับ');
        return;
      }
      await doLock(id, chatId, userId, admin, p, messageId, true, false);
      return;
    case 'forceask':
      if (!isLead(admin)) {
        await answerCallback(id, 'ใช้ได้เฉพาะหัวหน้าห้องครับ');
        return;
      }
      await answerCallback(id);
      await redraw(chatId, messageId, C.cardForceAsk({ short: p.short_ref, ledger: p.ledger_ref }));
      return;
    case 'settle':
      await doSettle(id, chatId, userId, p, messageId);
      return;
    case 'undo':
      await doUndo(id, chatId, p, messageId);
      return;
    case 'delask':
      await answerCallback(id);
      await redraw(chatId, messageId, C.cardDeleteAsk({
        ledger: p.ledger_ref, thb: p.thb_in ?? 0, short: p.short_ref,
      }));
      return;
    case 'delete':
      await doDelete(id, chatId, p, messageId);
      return;
    case 'open':
      await answerCallback(id);
      await redraw(chatId, messageId, detailCard(p));
      return;
    case 'copy':
      await answerCallback(id, displayLedger(p.ledger_ref));
      await sendMessage(chatId, { text: `<code>${displayLedger(p.ledger_ref)}</code>` });
      return;
    case 'hold':
      await answerCallback(id, 'พักรายการแล้ว');
      await patchSlip(p.id, { status: 'HOLD' });
      await redraw(chatId, messageId, {
        text: `◈  <b>CT</b>\n<i>[ แจ้งเตือน ]  พักรายการ</i>\n<code>${displayLedger(p.ledger_ref)}</code>\nถือไว้ก่อน ยังไม่บันทึกลงสมุดครับ`,
      });
      return;
    case 'cancel':
      await answerCallback(id, 'ยกเลิกแล้ว');
      await patchSlip(p.id, { status: 'DELETED' });
      await redraw(chatId, messageId, { text: 'ยกเลิกรายการแล้ว ไม่ได้บันทึกครับ' });
      return;
    case 'retry':
      await answerCallback(id, 'กรุณาส่งสลิปใหม่');
      await patchSlip(p.id, { status: 'DELETED' });
      await redraw(chatId, messageId, { text: 'กรุณาส่งสลิปใหม่อีกครั้งครับ' });
      return;
    case 'edit':
      await answerCallback(id, 'กรุณาพิมพ์ยอด');
      await sendMessage(chatId, {
        text: `กรุณาแก้ยอดของ <code>${p.short_ref}</code>\nพิมพ์เช่น <code>+500B</code>`,
      });
      return;
    case 'note':
      await answerCallback(id, 'กรุณาพิมพ์หมายเหตุ');
      await sendMessage(chatId, { text: `หมายเหตุสำหรับ <code>${p.short_ref}</code>\nกรุณาพิมพ์ต่อข้อความนี้ครับ` });
      return;
    case 'amt': {
      const parsed = parseAmounts(cb.extra.startsWith('+') || cb.extra.startsWith('-') ? cb.extra : `+${cb.extra}`);
      const thb = parsed.thb?.value;
      if (!thb) {
        await answerCallback(id, 'ยอดไม่ถูกต้องครับ');
        return;
      }
      await answerCallback(id, `บันทึกแล้ว · ${p.short_ref}`);
      const desk = p.desk_rate || (await opsRates(chatId)).desk;
      const owed = shouldSend(thb, desk);
      const next = await patchSlip(p.id, {
        thb_in: thb,
        should_send: owed,
        desk_rate: desk,
        status: 'IN_READY',
      });
      await redraw(chatId, messageId, C.cardInReady({
        review: false,
        thb,
        shouldSend: owed,
        desk,
        mkt: next.mkt_rate,
        bank: next.bank ?? '—',
        last4: (next.account_masked ?? '').replace(/\D/g, '').slice(-4),
        name: next.name,
        confidence: next.ocr_confidence ?? 95,
        ledger: next.ledger_ref,
        adminName: next.admin_name ?? admin.name,
        short: next.short_ref,
      }));
      return;
    }
    case 'unit':
      await answerCallback(id, cb.extra === '-U' ? 'กรุณาพิมพ์ยอด USDT' : 'กรุณาพิมพ์ยอดบาท');
      await sendMessage(chatId, {
        text: cb.extra === '-U' ? 'กรุณาพิมพ์ยอด เช่น <code>-13.6U</code>' : 'กรุณาพิมพ์ยอด เช่น <code>+500</code>',
      });
      return;
    default:
      await answerCallback(id, 'ปุ่มนี้หมดอายุแล้วครับ');
      if (messageId) await editMessage(chatId, messageId, C.expiredToastCard());
  }
}

function detailCard(p: PendingSlip) {
  return C.cardDetail({
    ledger: p.ledger_ref,
    thb: p.thb_in ?? 0,
    usdtOut: p.status === 'SETTLED' ? p.should_send : null,
    desk: p.desk_rate ?? 0,
    mkt: p.mkt_rate,
    usd: p.bot_usd,
    bank: p.bank ?? '—',
    last4: (p.account_masked ?? '').replace(/\D/g, '').slice(-4),
    name: p.name,
    pinMatch: p.pin_match,
    confidence: p.ocr_confidence,
    adminIn: p.admin_name ?? 'Admin',
    inTime: clockBkk(p.undo_until ? new Date(new Date(p.undo_until).getTime() - 30_000) : new Date()),
    outTime: p.status === 'SETTLED' ? clockBkk() : null,
    adminOut: p.status === 'SETTLED' ? p.admin_name : null,
    note: p.note,
    short: p.short_ref,
  });
}

async function doLock(
  cbId: string,
  chatId: number,
  userId: number,
  admin: Admin,
  p: PendingSlip,
  messageId: number | undefined,
  force: boolean,
  queued: boolean,
) {
  if (p.status === 'LOCKED' || p.status === 'SETTLED') {
    await answerCallback(cbId, `บันทึกแล้ว · ${p.short_ref}`);
    return;
  }
  try {
    const next = await commitIncomingLock(p, { chatId, userId, admin, force, queued });
    const batch = await dueSummary(chatId);
    await answerCallback(cbId, queued ? `เก็บไว้แล้ว · ${p.short_ref}` : `บันทึกแล้ว · ${p.short_ref}`);
    const card = C.cardLocked({
      thb: next.thb_in ?? 0,
      shouldSend: next.should_send ?? 0,
      desk: next.desk_rate ?? 0,
      mkt: next.mkt_rate,
      ledger: next.ledger_ref,
      adminName: admin.name,
      time: clockBkk(),
      short: next.short_ref,
      canUndo: true,
      queued,
      batch,
      bank: next.bank ?? undefined,
      last4: (next.account_masked ?? '').replace(/\D/g, '').slice(-4),
      name: next.name,
    });
    const photoId = await sendHero(
      chatId,
      messageId,
      'locked',
      card,
      `${thbCard(next.thb_in ?? 0)} THB`,
      queued ? `KEEP ${usdt(next.should_send ?? 0)} USDT` : `DUE ${usdt(next.should_send ?? 0)} USDT`,
      next.ledger_ref,
    );
    await patchSlip(p.id, { message_id: photoId });
  } catch (e: any) {
    const msg = e?.message === 'PIN_MISMATCH'
      ? 'บัญชีไม่ตรงกับบัญชีรับวันนี้ครับ'
      : e?.message === 'NO_AMOUNT'
        ? 'ยังไม่พบยอดเงินครับ'
        : 'บันทึกไม่สำเร็จครับ';
    await answerCallback(cbId, msg);
  }
}

async function doSettle(
  cbId: string,
  chatId: number,
  userId: number,
  p: PendingSlip,
  messageId: number | undefined,
) {
  if (p.status === 'SETTLED') {
    await answerCallback(cbId, `โอนครบแล้ว · ${p.short_ref}`);
    return;
  }
  if (p.status !== 'LOCKED' || !p.should_send) {
    await answerCallback(cbId, 'รายการนี้ยังไม่ได้ยืนยันครับ');
    return;
  }
  await recordOutgoing({
    adminTelegramId: userId,
    chatId,
    usdt: p.should_send,
    ledgerRef: p.ledger_ref,
    slipImageUrl: p.slip_url,
  });
  const next = await patchSlip(p.id, { status: 'SETTLED', undo_until: null });
  await answerCallback(cbId, `โอนครบแล้ว · ${p.short_ref}`);
  const card = C.cardSettled({
    thb: next.thb_in ?? 0,
    usdtOut: next.should_send ?? 0,
    desk: next.desk_rate ?? 0,
    ledger: next.ledger_ref,
    adminName: next.admin_name ?? 'Admin',
    inTime: clockBkk(),
    outTime: clockBkk(),
    short: next.short_ref,
  });
  await sendHero(
    chatId,
    messageId,
    'settled',
    card,
    `${usdt(next.should_send ?? 0)} USDT`,
    `IN ${thbCard(next.thb_in ?? 0)} THB`,
    next.ledger_ref,
  );
}

async function doUndo(
  cbId: string,
  chatId: number,
  p: PendingSlip,
  messageId: number | undefined,
) {
  if (!canUndo(p) || !p.tx_id) {
    await answerCallback(cbId, 'หมดเวลาแก้ไขแล้วครับ');
    await redraw(chatId, messageId, C.cardLocked({
      thb: p.thb_in ?? 0,
      shouldSend: p.should_send ?? 0,
      desk: p.desk_rate ?? 0,
      ledger: p.ledger_ref,
      adminName: p.admin_name ?? 'Admin',
      time: clockBkk(),
      short: p.short_ref,
      canUndo: false,
      queued: p.note === 'QUEUE',
    }));
    return;
  }
  await deleteTransaction(p.tx_id);
  const next = await patchSlip(p.id, { status: 'IN_READY', tx_id: null, undo_until: null });
  await answerCallback(cbId, 'ยกเลิกการบันทึกแล้วครับ');
  const gate = gateOcr({
    thb: next.thb_in,
    confidence: next.ocr_confidence,
    pinMatch: next.pin_match,
    hasCurrency: next.thb_in != null,
  });
  await redraw(chatId, messageId, renderGateCard(next, {
    gate,
    slipBank: next.bank ?? '—',
    slipLast4: (next.account_masked ?? '').replace(/\D/g, '').slice(-4),
    pinBank: next.bank ?? '—',
    pinLast4: (next.account_masked ?? '').replace(/\D/g, '').slice(-4),
    lead: false,
    chips: next.thb_in ? [next.thb_in] : [500],
  }));
}

async function doDelete(
  cbId: string,
  chatId: number,
  p: PendingSlip,
  messageId: number | undefined,
) {
  if (p.tx_id) await deleteTransaction(p.tx_id);
  await patchSlip(p.id, { status: 'DELETED', tx_id: null });
  await answerCallback(cbId, `ลบรายการแล้ว · ${p.short_ref}`);
  await redraw(chatId, messageId, { text: `ลบ <code>${displayLedger(p.ledger_ref)}</code> แล้ว` });
}

export async function handleCtText(opts: {
  chatId: number;
  userId: number;
  admin: Admin;
  text: string;
}): Promise<boolean> {
  const t = opts.text.trim();
  const cmd = matchReplyCommand(t);
  if (cmd === 'vault') {
    const view = await renderVault(opts.chatId, 'today');
    await sendHero(opts.chatId, undefined, 'vault', view, 'VAULT', 'TODAY', 'CT');
    return true;
  }
  if (cmd === 'pending') {
    const view = await renderVault(opts.chatId, 'pending');
    await sendHero(opts.chatId, undefined, 'vault', view, 'WAIT', 'DUE', 'CT');
    return true;
  }
  if (cmd === 'menu' || cmd === 'settings') {
    await sendMessage(opts.chatId, await renderSettings(opts.chatId));
    return true;
  }
  if (cmd === 'newday') {
    const { startNewDay } = await import('../botSessions');
    await startNewDay(opts.chatId);
    const view = await renderVault(opts.chatId, 'today');
    await sendHero(opts.chatId, undefined, 'vault', view, 'VAULT', 'NEW DAY', '◈');
    return true;
  }
  if (cmd === 'pin') {
    const pasted = parseDeskPin(t);
    if (pasted) {
      try {
        const result = await pinBankAccount(opts.chatId, pasted.bank, pasted.account, pasted.name);
        await sendMessage(opts.chatId, C.pinView(result.pinned.map((b) => ({
          bank: b.bank_name,
          last4: accountLast4(b.account_number) ?? '????',
        }))));
      } catch (e: any) {
        await sendMessage(opts.chatId, { text: e?.message === 'PIN_LIMIT_REACHED' ? 'หมุดครบ 3 บัญชีแล้วครับ' : 'หมุดบัญชีไม่สำเร็จครับ' });
      }
      return true;
    }
    const pinned = await listPinnedBanks(opts.chatId);
    await sendMessage(opts.chatId, C.pinView(pinned.map((b) => ({
      bank: b.bank_name,
      last4: accountLast4(b.account_number) ?? '????',
    }))));
    return true;
  }

  const deskPin = parseDeskPin(t);
  if (deskPin) {
    try {
      const result = await pinBankAccount(opts.chatId, deskPin.bank, deskPin.account, deskPin.name);
      await sendMessage(opts.chatId, C.pinView(result.pinned.map((b) => ({
        bank: b.bank_name,
        last4: accountLast4(b.account_number) ?? '????',
      }))));
    } catch (e: any) {
      await sendMessage(opts.chatId, { text: e?.message === 'PIN_LIMIT_REACHED' ? 'pin ครบ 3' : 'pin ไม่ติด' });
    }
    return true;
  }
  if (cmd === 'recent') {
    await sendMessage(opts.chatId, await renderRecent(opts.chatId, opts.admin.name));
    return true;
  }

  if (cmd === 'rate') {
    await armRatePrompt(opts.chatId, opts.userId);
    const rates = await opsRates(opts.chatId);
    await sendMessage(opts.chatId, C.askDeskRate(rates.desk || null));
    return true;
  }

  if (cmd === 'addadmin') {
    if (!isLead(opts.admin)) {
      await sendMessage(opts.chatId, { text: 'ใช้ได้เฉพาะหัวหน้าห้องครับ' });
      return true;
    }
    await armAdminPrompt(opts.chatId, opts.userId);
    await sendMessage(opts.chatId, C.askAdminId());
    return true;
  }

  const tgId = parseTelegramId(t);
  if (tgId != null) {
    let allowed = /^\/admin/i.test(t);
    if (!allowed) {
      try {
        const session = await getSession(opts.chatId, opts.userId);
        allowed = session?.state === 'AWAITING_ADMIN';
      } catch {
        allowed = false;
      }
    }
    if (!allowed) return false;
    if (!isLead(opts.admin)) {
      await sendMessage(opts.chatId, { text: 'ใช้ได้เฉพาะหัวหน้าห้องครับ' });
      return true;
    }
    try { await clearSession(opts.chatId, opts.userId); } catch { /* ignore */ }
    await addAdminById(opts.chatId, tgId);
    return true;
  }

  const deskRate = parseDeskRate(t);
  if (deskRate != null) {
    let allowed = hasRatePrefix(t);
    if (!allowed && isBareDeskRate(t)) {
      try {
        const session = await getSession(opts.chatId, opts.userId);
        allowed = session?.state === 'AWAITING_RATE';
      } catch {
        allowed = false;
      }
    }
    if (!allowed) return false;
    try {
      await clearSession(opts.chatId, opts.userId);
    } catch { /* ignore */ }
    const saved = await applyDeskRate(opts.chatId, opts.admin.id, deskRate);
    const open = await (await import('./store')).latestOpenSlip(opts.chatId, opts.userId);
    if (open && open.thb_in && (open.status === 'OCR_WEAK' || open.status === 'NEED_UNIT' || open.status === 'IN_READY' || open.status === 'IN_READY_REVIEW' || open.status === 'HOLD')) {
      const owed = shouldSend(open.thb_in, deskRate);
      const next = await patchSlip(open.id, {
        desk_rate: deskRate,
        should_send: owed,
        status: 'IN_READY',
      });
      const card = C.cardInReady({
        review: false,
        thb: next.thb_in ?? open.thb_in,
        shouldSend: owed,
        desk: deskRate,
        mkt: saved.mkt,
        bank: next.bank ?? '—',
        last4: (next.account_masked ?? '').replace(/\D/g, '').slice(-4),
        name: next.name,
        confidence: next.ocr_confidence ?? 95,
        ledger: next.ledger_ref,
        adminName: next.admin_name ?? opts.admin.name,
        short: next.short_ref,
      });
      if (open.message_id) await editMessage(opts.chatId, open.message_id, card);
      else await sendMessage(opts.chatId, card);
      return true;
    }
    await sendMessage(opts.chatId, C.deskRateSet(saved.desk, saved.mkt));
    return true;
  }

  const parsed = parseAmounts(t);
  if (parsed.thb && !parsed.ambiguous) {
    const open = await (await import('./store')).latestOpenSlip(opts.chatId, opts.userId);
    if (open && (open.status === 'OCR_WEAK' || open.status === 'NEED_UNIT' || open.status === 'IN_READY' || open.status === 'IN_READY_REVIEW' || open.status === 'HOLD')) {
      const desk = open.desk_rate || (await opsRates(opts.chatId)).desk;
      const owed = shouldSend(parsed.thb.value, desk);
      const next = await patchSlip(open.id, {
        thb_in: parsed.thb.value,
        should_send: owed,
        desk_rate: desk,
        status: 'IN_READY',
      });
      const card = C.cardInReady({
        review: false,
        thb: parsed.thb.value,
        shouldSend: owed,
        desk,
        mkt: next.mkt_rate,
        bank: next.bank ?? '—',
        last4: (next.account_masked ?? '').replace(/\D/g, '').slice(-4),
        name: next.name,
        confidence: next.ocr_confidence ?? 95,
        ledger: next.ledger_ref,
        adminName: next.admin_name ?? opts.admin.name,
        short: next.short_ref,
      });
      if (open.message_id) await editMessage(opts.chatId, open.message_id, card);
      else await sendMessage(opts.chatId, card);
      return true;
    }
  }
  return false;
}

export { adminKeyboard };
