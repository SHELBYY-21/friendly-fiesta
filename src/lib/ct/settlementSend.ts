/**
 * handle_settlement equivalent — send card + smart media + state effect cue.
 */
import type { OutgoingMessage } from '../telegram';
import { SettlementCard, SettlementState } from './settlementCard';
import { SettlementRichMessage, type SettlementUiPhase } from './settlementRichMessage';
import { effectForState } from './settlementEffects';
import { sendSmartMedia } from './settlementMedia';
import { setupSettlementRuntime } from './settlementBootstrap';

export async function handleSettlementSend(opts: {
  chatId: number;
  card: SettlementCard;
  phase?: SettlementUiPhase;
  shakeHint?: boolean;
}): Promise<{ messageId: number; effect: string | null }> {
  await setupSettlementRuntime();
  const rich = new SettlementRichMessage(opts.card, {
    phase: opts.phase,
    shakeHint: opts.shakeHint,
  });
  let message: OutgoingMessage = rich.buildMessage();
  const fx = await effectForState(opts.card.state);
  if (fx?.telegramCue && fx.allowed) {
    // Append soft cue only — never mutate amounts
    message = { ...message, text: `${message.text}\n${fx.telegramCue}` };
  }
  const messageId = await sendSmartMedia(opts.chatId, opts.card.state, message);
  return { messageId, effect: fx?.allowed ? fx.name : null };
}

export function settlementCardFromDraft(d: {
  depositThb: number;
  depositCount: number;
  roomRate: number;
  sentUsdt?: number | null;
  direction?: 'IN' | 'OUT';
  state?: SettlementState;
}): SettlementCard {
  return new SettlementCard(d);
}
