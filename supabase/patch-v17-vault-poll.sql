-- CE VAULT v17: indexes for the Singapore vault poll + open slip tape
-- Idempotent. Paste in Supabase SQL editor (service role not required).
-- Hot paths: loadVault (chat+type+time), listOpenPending, listLockedOpen, short_ref lookup.

create index if not exists idx_tx_chat_type_created
  on public.transactions (chat_id, type, created_at desc)
  where chat_id is not null;

create index if not exists idx_pending_slips_short
  on public.pending_slips (short_ref, created_at desc);

create index if not exists idx_pending_slips_open
  on public.pending_slips (chat_id, created_at desc)
  where status in (
    'PIN_MISMATCH',
    'OCR_WEAK',
    'NEED_UNIT',
    'IN_READY',
    'IN_READY_REVIEW',
    'LOCKED',
    'HOLD'
  );

create index if not exists idx_pending_slips_locked
  on public.pending_slips (chat_id, created_at)
  where status = 'LOCKED';

analyze public.transactions;
analyze public.pending_slips;
analyze public.rates;
analyze public.pinned_bank_accounts;
