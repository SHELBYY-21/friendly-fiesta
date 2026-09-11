import { supabaseAdmin } from '../supabaseAdmin';

export type AuditKind =
  | 'slip_ingest'
  | 'slip_approve'
  | 'slip_settle'
  | 'tx_edit'
  | 'tx_delete';

/** Best-effort append-only audit. Never throws to callers. */
export async function appendAuditEvent(input: {
  kind: AuditKind;
  chatId?: number | null;
  actorTgId?: number | null;
  fingerprint?: string | null;
  txId?: string | null;
  pendingId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('audit_events').insert({
      kind: input.kind,
      chat_id: input.chatId ?? null,
      actor_tg_id: input.actorTgId ?? null,
      fingerprint: input.fingerprint ?? null,
      tx_id: input.txId ?? null,
      pending_id: input.pendingId ?? null,
      payload: input.payload ?? {},
      created_at: new Date().toISOString(),
    });
    if (error) console.warn('audit_events insert failed', error.message);
  } catch (e) {
    console.warn('audit_events error', e instanceof Error ? e.message : e);
  }
}
