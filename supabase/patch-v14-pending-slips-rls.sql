-- pending_slips is server-only. Anon must not read/write slips.
alter table public.pending_slips enable row level security;
drop policy if exists pending_slips_service on public.pending_slips;
revoke all on table public.pending_slips from public, anon, authenticated;
grant all on table public.pending_slips to service_role;
