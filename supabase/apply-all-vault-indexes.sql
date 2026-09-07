-- CE VAULT: one paste in Supabase SQL Editor > Run
-- Creates open-slip indexes + covering vault poll index. Idempotent.

create index if not exists idx_pending_slips_short
  on public.pending_slips (short_ref, created_at desc);

create index if not exists idx_pending_slips_open
  on public.pending_slips (chat_id, created_at desc)
  where status in (
    'PIN_MISMATCH', 'OCR_WEAK', 'NEED_UNIT',
    'IN_READY', 'IN_READY_REVIEW', 'LOCKED', 'HOLD'
  );

create index if not exists idx_pending_slips_locked
  on public.pending_slips (chat_id, created_at)
  where status = 'LOCKED';

drop index if exists public.idx_tx_chat_type_created;

create index idx_tx_chat_type_created
  on public.transactions (chat_id, type, created_at desc)
  include (
    id, ledger_ref, thb_amount, usdt_amount, sell_rate, status,
    receiver_name, receiver_bank, receiver_last4
  )
  where chat_id is not null;

analyze public.transactions;
analyze public.pending_slips;
analyze public.rates;

select indexrelname as idx, pg_size_pretty(pg_relation_size(indexrelid)) as bytes
from pg_stat_user_indexes
where schemaname = 'public'
  and indexrelname in (
    'idx_tx_chat_type_created',
    'idx_pending_slips_short',
    'idx_pending_slips_open',
    'idx_pending_slips_locked'
  )
order by indexrelname;
