import { supabaseAdmin } from '../supabaseAdmin';

export async function opsChatId(preferred?: number | null): Promise<number | null> {
  if (preferred != null && Number.isFinite(preferred) && preferred !== 0) return preferred;
  const { data: pinned } = await supabaseAdmin
    .from('pinned_bank_accounts')
    .select('chat_id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pinned?.chat_id != null) return Number(pinned.chat_id);
  const { data: slip } = await supabaseAdmin
    .from('pending_slips')
    .select('chat_id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return slip?.chat_id != null ? Number(slip.chat_id) : null;
}
