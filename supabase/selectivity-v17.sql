-- Index selectivity for CE Vault v17.
-- Paste in Supabase SQL editor. Read-only.
--
-- Selectivity ≈ how well a predicate shrinks the table.
-- 1 / n_distinct  is a rough fraction for an equality (chat_id = ?).
-- Good: n_distinct high vs row count for the leading column, or a partial index
-- whose predicate already drops SETTLED/DONE rows.
-- Bad: n_distinct = 1 (every row same chat), or idx_scan = 0 after a week of desk use.

-- 1) Planner stats on the columns we filter
select
  c.relname as tbl,
  a.attname as col,
  s.n_distinct,
  s.null_frac,
  s.correlation,
  left(s.most_common_vals::text, 80) as most_common
from pg_stats s
join pg_class c on c.relname = s.tablename
join pg_attribute a on a.attrelid = c.oid and a.attname = s.attname
where s.schemaname = 'public'
  and s.tablename in ('transactions', 'pending_slips', 'rates', 'pinned_bank_accounts')
  and s.attname in (
    'chat_id', 'type', 'created_at', 'status',
    'short_ref', 'ledger_ref', 'slip_fingerprint'
  )
order by tbl, col;

-- 2) Index size vs table, and whether the desk actually uses them
select
  psui.relname as tbl,
  psui.indexrelname as idx,
  pg_size_pretty(pg_relation_size(psui.indexrelid)) as idx_bytes,
  pg_size_pretty(pg_relation_size(psui.relid)) as tbl_bytes,
  psui.idx_scan,
  psui.idx_tup_read,
  psui.idx_tup_fetch,
  round(
    case when psui.idx_tup_read = 0 then 0
         else psui.idx_tup_fetch::numeric / psui.idx_tup_read
    end
  , 3) as fetch_per_read
from pg_stat_user_indexes psui
where psui.schemaname = 'public'
  and psui.relname in ('transactions', 'pending_slips', 'rates', 'pinned_bank_accounts')
order by psui.relname, psui.idx_scan desc;

-- 3) Live fraction for the vault predicates (true selectivity)
select 'tx chat_id not null' as pred,
       count(*) filter (where chat_id is not null)::numeric / nullif(count(*), 0) as frac,
       count(*) as n
from public.transactions
union all
select 'tx THB_DEPOSIT today-ish (7d)',
       count(*) filter (
         where type = 'THB_DEPOSIT'
           and created_at >= now() - interval '7 days'
       )::numeric / nullif(count(*), 0),
       count(*) filter (
         where type = 'THB_DEPOSIT'
           and created_at >= now() - interval '7 days'
       )
from public.transactions
union all
select 'pending open statuses',
       count(*) filter (
         where status in (
           'PIN_MISMATCH', 'OCR_WEAK', 'NEED_UNIT',
           'IN_READY', 'IN_READY_REVIEW', 'LOCKED', 'HOLD'
         )
       )::numeric / nullif(count(*), 0),
       count(*) filter (
         where status in (
           'PIN_MISMATCH', 'OCR_WEAK', 'NEED_UNIT',
           'IN_READY', 'IN_READY_REVIEW', 'LOCKED', 'HOLD'
         )
       )
from public.pending_slips
union all
select 'pending LOCKED',
       count(*) filter (where status = 'LOCKED')::numeric / nullif(count(*), 0),
       count(*) filter (where status = 'LOCKED')
from public.pending_slips;

-- How to read
-- n_distinct on chat_id: should be ~number of rooms (small but equality is exact).
-- n_distinct on type: ~2 — weak alone; that is why v17 leads with chat_id then type.
-- pending open frac << 1: partial idx_pending_slips_open is worth it.
-- idx_scan = 0 after staff used the desk: the planner is still using Seq Scan / an older index.
