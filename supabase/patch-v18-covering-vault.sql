-- CE VAULT v18: covering index so loadVault can Index Only Scan
-- Recreates v17 idx_tx_chat_type_created with INCLUDE of the selected columns.
-- Run after v17 (or instead of it). Idempotent drop + create.

drop index if exists public.idx_tx_chat_type_created;

create index idx_tx_chat_type_created
  on public.transactions (chat_id, type, created_at desc)
  include (
    id,
    ledger_ref,
    thb_amount,
    usdt_amount,
    sell_rate,
    status,
    receiver_name,
    receiver_bank,
    receiver_last4
  )
  where chat_id is not null;

analyze public.transactions;
