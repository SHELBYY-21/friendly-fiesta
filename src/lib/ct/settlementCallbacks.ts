/**
 * settleui:* callbacks — IN · OUT · CONFIRM · SETTLED · DONE · BACK
 * Draft stored in bot_sessions.caption as SETTLEUI|<json>
 */
import { answerCallback, editMessage, sendMessage } from '../telegram';
import { getSession, setSession, clearSession, getRoom } from '../botSessions';
import { SettlementCard, SettlementState } from './settlementCard';
import { SettlementRichMessage, type SettlementUiPhase } from './settlementRichMessage';
import { handleSettlementSend } from './settlementSend';
import { setupSettlementRuntime } from './settlementBootstrap';

const PREFIX = 'SETTLEUI|';

export type SettleDraft = {
  direction: 'IN' | 'OUT';
  depositThb: number;
  depositCount: number;
  roomRate: number;
  sentUsdt: number | null;
  phase: SettlementUiPhase;
  confirmLocked?: boolean;
  state?: SettlementState;
  /** progressive intake: deposit → count → rate? → sent */
  intakeStep?: 'deposit' | 'count' | 'rate' | 'sent';
};

function parseDraft(caption?: string | null): SettleDraft | null {
  if (!caption || !caption.startsWith(PREFIX)) return null;
  try {
    return JSON.parse(caption.slice(PREFIX.length)) as SettleDraft;
  } catch {
    return null;
  }
}

async function saveDraft(chatId: number, userId: number, draft: SettleDraft) {
  await setSession(chatId, userId, {
    state: 'AWAITING_AMOUNT',
    caption: PREFIX + JSON.stringify(draft),
    pending_type: draft.direction === 'OUT' ? 'USDT_SEND' : 'THB_DEPOSIT',
  });
}

function cardFromDraft(d: SettleDraft): SettlementCard {
  return new SettlementCard({
    depositThb: d.depositThb,
    depositCount: d.depositCount,
    roomRate: d.roomRate,
    sentUsdt: d.sentUsdt,
    direction: d.direction,
    state: d.state,
    confirmLocked: d.confirmLocked,
  });
}

export function isSettleUiCallback(data: string): boolean {
  return (data || '').split(':')[0] === 'settleui';
}

export async function handleSettleUiCallback(opts: {
  id: string;
  chatId: number;
  userId: number;
  messageId: number;
  data: string;
}): Promise<void> {
  await setupSettlementRuntime();
  const action = (opts.data.split(':')[1] || '').toLowerCase();
  const session = await getSession(opts.chatId, opts.userId);
  let draft = parseDraft(session?.caption) || {
    direction: 'IN' as const,
    depositThb: 0,
    depositCount: 0,
    roomRate: 0,
    sentUsdt: null as number | null,
    phase: 'pick_direction' as SettlementUiPhase,
    intakeStep: 'deposit' as const,
  };

  const room = await getRoom(opts.chatId);
  if (draft.roomRate <= 0 && room.rate) draft.roomRate = Number(room.rate);

  if (action === 'noop') {
    await answerCallback(opts.id);
    return;
  }

  if (action === 'back') {
    await answerCallback(opts.id, 'กลับ VAULT');
    await clearSession(opts.chatId, opts.userId);
    await editMessage(opts.chatId, opts.messageId, {
      text: '◈ <b>CE VAULT</b>\nกลับเมนูหลักแล้ว — พิมพ์ <code>VAULT</code> หรือ <code>SETTLE</code>',
    });
    return;
  }

  if (action === 'in' || action === 'out') {
    draft.direction = action === 'out' ? 'OUT' : 'IN';
    draft.phase = 'await_deposit';
    draft.intakeStep = 'deposit';
    draft.depositThb = 0;
    draft.depositCount = 0;
    draft.sentUsdt = null;
    draft.state = undefined;
    draft.confirmLocked = false;
    await saveDraft(opts.chatId, opts.userId, draft);
    await answerCallback(opts.id, draft.direction);
    await editMessage(opts.chatId, opts.messageId, {
      text:
        `◈ <b>SETTLEMENT · ${draft.direction}</b>\n` +
        `ส่งยอดฝากรวมเป็นตัวเลข เช่น <code>10000</code>\n` +
        `แล้วส่งจำนวนรายการ เช่น <code>3</code>\n` +
        `เรทห้อง: <code>${draft.roomRate > 0 ? draft.roomRate : 'ยังไม่ตั้ง — ส่งเรท เช่น 36.70'}</code>\n` +
        `จากนั้นส่งยอด USDT ที่ส่งแล้ว เช่น <code>272.48</code>`,
    });
    return;
  }

  if (action === 'confirm') {
    const card = cardFromDraft(draft);
    if (!card.canConfirm()) {
      const msg = new SettlementRichMessage(card, { phase: 'review', shakeHint: true }).buildMessage();
      await answerCallback(opts.id, 'ยังยืนยันไม่ได้');
      await editMessage(opts.chatId, opts.messageId, msg);
      return;
    }
    draft.confirmLocked = true;
    draft.phase = 'confirming';
    await saveDraft(opts.chatId, opts.userId, draft);
    await answerCallback(opts.id, 'กำลังยืนยัน');
    await editMessage(
      opts.chatId,
      opts.messageId,
      new SettlementRichMessage(card.withConfirmLocked(true), { phase: 'confirming' }).buildMessage(),
    );

    draft.state = SettlementState.SETTLED;
    draft.confirmLocked = true;
    draft.phase = 'settled';
    await saveDraft(opts.chatId, opts.userId, draft);
    await editMessage(
      opts.chatId,
      opts.messageId,
      new SettlementRichMessage(cardFromDraft(draft), { phase: 'settled' }).buildMessage(),
    );
    return;
  }

  if (action === 'settled') {
    const card = cardFromDraft(draft);
    if (!card.canConfirm() && card.state !== SettlementState.SETTLED) {
      await answerCallback(opts.id, 'ยังปิดรายการไม่ได้');
      return;
    }
    draft.state = SettlementState.SETTLED;
    draft.phase = 'settled';
    draft.confirmLocked = true;
    await saveDraft(opts.chatId, opts.userId, draft);
    await answerCallback(opts.id, 'SETTLED');
    await editMessage(
      opts.chatId,
      opts.messageId,
      new SettlementRichMessage(cardFromDraft(draft), { phase: 'settled' }).buildMessage(),
    );
    return;
  }

  if (action === 'done') {
    await answerCallback(opts.id, 'DONE');
    await clearSession(opts.chatId, opts.userId);
    await editMessage(opts.chatId, opts.messageId, {
      text: '✅ <b>DONE</b>\nปิด Settlement แล้ว — พิมพ์ <code>VAULT</code> หรือ <code>SETTLE</code>',
    });
    return;
  }

  await answerCallback(opts.id);
}

/** Open settlement picker — command SETTLE / SETTLEMENT */
export async function openSettlementUi(chatId: number, userId: number): Promise<void> {
  await setupSettlementRuntime();
  const room = await getRoom(chatId);
  const draft: SettleDraft = {
    direction: 'IN',
    depositThb: 0,
    depositCount: 0,
    roomRate: room.rate ? Number(room.rate) : 0,
    sentUsdt: null,
    phase: 'pick_direction',
    intakeStep: 'deposit',
  };
  await saveDraft(chatId, userId, draft);
  const card = new SettlementCard({
    depositThb: 0,
    depositCount: 0,
    roomRate: draft.roomRate,
    sentUsdt: null,
    direction: 'IN',
  });
  await handleSettlementSend({ chatId, card, phase: 'pick_direction' });
}

/**
 * Progressive number intake while SETTLEUI session active.
 * Returns true if consumed.
 */
export async function handleSettleUiText(opts: {
  chatId: number;
  userId: number;
  text: string;
}): Promise<boolean> {
  const session = await getSession(opts.chatId, opts.userId);
  const draft = parseDraft(session?.caption);
  if (!draft) return false;

  const raw = opts.text.trim().replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(raw)) return false;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return false;

  const step = draft.intakeStep || 'deposit';

  if (step === 'deposit') {
    draft.depositThb = n;
    draft.intakeStep = 'count';
    draft.phase = 'await_deposit';
    await saveDraft(opts.chatId, opts.userId, draft);
    await sendMessage(opts.chatId, {
      text: `รับยอดฝาก <code>${n}</code> THB แล้ว\nส่งจำนวนรายการ เช่น <code>3</code>`,
    });
    return true;
  }

  if (step === 'count') {
    draft.depositCount = Math.max(0, Math.floor(n));
    if (draft.roomRate > 0) {
      draft.intakeStep = 'sent';
      draft.phase = 'await_sent';
      await saveDraft(opts.chatId, opts.userId, draft);
      await sendMessage(opts.chatId, {
        text: `รับ <code>${draft.depositCount}</code> รายการ · เรท <code>${draft.roomRate}</code>\nส่งยอด USDT ที่ส่งแล้ว เช่น <code>272.48</code>`,
      });
    } else {
      draft.intakeStep = 'rate';
      draft.phase = 'await_rate';
      await saveDraft(opts.chatId, opts.userId, draft);
      await sendMessage(opts.chatId, {
        text: `รับ <code>${draft.depositCount}</code> รายการแล้ว\nส่งเรทโต๊ะ เช่น <code>36.70</code>`,
      });
    }
    return true;
  }

  if (step === 'rate') {
    draft.roomRate = n;
    draft.intakeStep = 'sent';
    draft.phase = 'await_sent';
    await saveDraft(opts.chatId, opts.userId, draft);
    await sendMessage(opts.chatId, {
      text: `เรท <code>${n}</code> แล้ว\nส่งยอด USDT ที่ส่งแล้ว เช่น <code>272.48</code>`,
    });
    return true;
  }

  if (step === 'sent') {
    draft.sentUsdt = n;
    draft.phase = 'review';
    draft.state = undefined;
    draft.confirmLocked = false;
    await saveDraft(opts.chatId, opts.userId, draft);
    const card = cardFromDraft(draft);
    await handleSettlementSend({ chatId: opts.chatId, card, phase: 'review' });
    return true;
  }

  return false;
}
