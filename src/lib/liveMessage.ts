import { supabaseAdmin } from './supabaseAdmin';
import { sendMessage, editMessage } from './telegram';
import * as UI from './botUi';
import { setSession } from './botSessions';

type CreateOpts = {
  transactionId: string;
  chatId: number;
  userId?: number;
  ledgerRef: string;
  adminName?: string | null;
};

/** One live message. Stickers are opt-in via sendStickerFor, never extra spam here. */
export default class LiveMessageService {
  static async create(opts: CreateOpts): Promise<{ liveMessageId: number | null }> {
    const { transactionId, chatId, userId, ledgerRef, adminName } = opts;
    try {
      const msgId = await sendMessage(chatId, UI.liveInitial(ledgerRef, adminName ?? undefined));
      try {
        if (userId) await setSession(chatId, userId, { live_message_id: msgId, live_tx_id: transactionId });
      } catch { /* ignore */ }
      try {
        await supabaseAdmin.from('transactions').update({ live_message_id: msgId, live_chat_id: chatId, live_status: 'Receiving', updated_at: new Date().toISOString() }).eq('id', transactionId);
        await supabaseAdmin.from('transaction_status_logs').insert({ transaction_id: transactionId, status: 'Receiving', meta: { ledgerRef } });
      } catch { /* ignore */ }
      return { liveMessageId: msgId };
    } catch {
      return { liveMessageId: null };
    }
  }

  static async update(transactionId: string, chatId: number, messageId: number, status: string, m: { text: string }): Promise<void> {
    try {
      await editMessage(chatId, messageId, { text: m.text });
    } catch { /* ignore */ }
    try {
      await supabaseAdmin.from('transactions').update({ live_status: status, updated_at: new Date().toISOString() }).eq('id', transactionId);
      await supabaseAdmin.from('transaction_status_logs').insert({ transaction_id: transactionId, status, meta: { message: m.text } });
    } catch { /* ignore */ }
  }

  static async complete(transactionId: string, chatId: number, messageId: number, payload: any): Promise<void> {
    const text = UI.liveCompleted({
      ledgerRef: payload.ledgerRef,
      thb: payload.thb,
      usdt: payload.usdt,
      profitThb: payload.profitThb ?? 0,
      remaining: payload.remaining ?? 0,
      todayTotalThb: payload.todayTotalThb ?? undefined,
    }).text;
    await this.update(transactionId, chatId, messageId, 'Completed', { text });
  }

  static async error(transactionId: string, chatId: number, messageId: number, errMsg: string): Promise<void> {
    const text = UI.error(uiSafe(errMsg)).text;
    try {
      await editMessage(chatId, messageId, { text });
    } catch { /* ignore */ }
    try {
      await supabaseAdmin.from('transactions').update({ live_status: 'Error', updated_at: new Date().toISOString() }).eq('id', transactionId);
      await supabaseAdmin.from('transaction_status_logs').insert({ transaction_id: transactionId, status: 'Error', meta: { error: errMsg } });
    } catch { /* ignore */ }
  }
}

function uiSafe(s: any) {
  if (s == null) return '';
  return UI.escapeHtml(String(s).slice(0, 1000));
}
