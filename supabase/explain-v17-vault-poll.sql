-- Read these plans after patch-v17-vault-poll.sql.
-- Paste in Supabase SQL editor. Safe: EXPLAIN ANALYZE runs the SELECT but does not write.
--
-- Healthy: Index Scan / Index Only Scan on idx_tx_chat_type_created or idx_pending_slips_*.
-- Unhealthy: Seq Scan on transactions / pending_slips, or Filter: (chat_id = ...) after a type-only index.
-- Ignore the sample chat_id if empty — pick one from the CTE.

with sample as (
  select chat_id
  from public.transactions
  where chat_id is not null
  order by created_at desc
  limit 1
)
select chat_id as use_this_chat_id from sample;

-- 1) loadVault deposits (THB_DEPOSIT + room + today)
explain (analyze, buffers, verbose)
select id, ledger_ref, created_at, thb_amount, usdt_amount, sell_rate, status, chat_id
from public.transactions
where type = 'THB_DEPOSIT'
  and chat_id = (select chat_id from public.transactions where chat_id is not null order by created_at desc limit 1)
  and created_at >= date_trunc('day', timezone('Asia/Bangkok', now())) at time zone 'Asia/Bangkok'
order by created_at desc;

-- 2) loadVault sends
explain (analyze, buffers, verbose)
select ledger_ref, created_at, usdt_amount
from public.transactions
where type = 'USDT_SEND'
  and chat_id = (select chat_id from public.transactions where chat_id is not null order by created_at desc limit 1)
  and created_at >= date_trunc('day', timezone('Asia/Bangkok', now())) at time zone 'Asia/Bangkok'
order by created_at desc;

-- 3) open slip tape
explain (analyze, buffers, verbose)
select *
from public.pending_slips
where chat_id = (select chat_id from public.pending_slips order by created_at desc limit 1)
  and status in (
    'PIN_MISMATCH', 'OCR_WEAK', 'NEED_UNIT',
    'IN_READY', 'IN_READY_REVIEW', 'LOCKED', 'HOLD'
  )
order by created_at desc
limit 40;

-- 4) LOCKED queue
explain (analyze, buffers, verbose)
select *
from public.pending_slips
where chat_id = (select chat_id from public.pending_slips order by created_at desc limit 1)
  and status = 'LOCKED'
order by created_at
limit 100;

-- 5) short_ref lookup
explain (analyze, buffers, verbose)
select *
from public.pending_slips
where short_ref = (select short_ref from public.pending_slips order by created_at desc limit 1)
order by created_at desc
limit 1;
