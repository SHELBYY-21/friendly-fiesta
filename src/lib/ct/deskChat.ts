import { supabaseAdmin } from '../supabaseAdmin';
import { configuredAdminIds } from '../runtimeEnv';

function envChatId(): number | null {
  for (const key of ['OPS_CHAT_ID', 'NOTIFY_CHAT_ID']) {
    const raw = process.env[key];
    if (!raw) continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n !== 0) return n;
  }
  return null;
}

export async function opsChatId(preferred?: number | null): Promise<number | null> {
  if (preferred != null && Number.isFinite(preferred) && preferred !== 0) return preferred;
  const fromEnv = envChatId();
  if (fromEnv != null) return fromEnv;
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
  if (slip?.chat_id != null) return Number(slip.chat_id);
  const admins = configuredAdminIds();
  return admins[0] ?? null;
}
