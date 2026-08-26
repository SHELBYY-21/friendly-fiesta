-- Production lock: no anon SELECT on money tables.
-- Customer status goes through /api/public/status/[id] (service_role).

drop policy if exists "anon can read transactions" on public.transactions;
drop policy if exists "anon can read rates" on public.rates;
drop policy if exists "anon can read bank_accounts" on public.bank_accounts;

revoke all on table public.transactions from public, anon, authenticated;
revoke all on table public.rates from public, anon, authenticated;
revoke all on table public.bank_accounts from public, anon, authenticated;
revoke all on table public.pinned_bank_accounts from public, anon, authenticated;
revoke all on table public.chat_settings from public, anon, authenticated;
revoke all on table public.bot_sessions from public, anon, authenticated;
revoke all on table public.receivers from public, anon, authenticated;
revoke all on table public.system_settings from public, anon, authenticated;
revoke all on table public.telegram_updates from public, anon, authenticated;
revoke all on table public.transaction_status_logs from public, anon, authenticated;
revoke all on table public.dashboard_login_attempts from public, anon, authenticated;

grant all on table public.transactions to service_role;
grant all on table public.rates to service_role;
grant all on table public.bank_accounts to service_role;

alter table public.pending_slips enable row level security;
create unique index if not exists uq_pending_slips_fingerprint
  on public.pending_slips (slip_fingerprint)
  where slip_fingerprint is not null;
