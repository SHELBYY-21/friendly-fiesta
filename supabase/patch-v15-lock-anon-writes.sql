-- Lock public tables: anon must not mutate money/ops data.
-- Customer status page still SELECTs transactions/rates/bank_accounts.

drop policy if exists bot_metrics_open_access on public.bot_metrics;
alter table public.bot_metrics enable row level security;
revoke all on table public.bot_metrics from public, anon, authenticated;
grant all on table public.bot_metrics to service_role;

drop policy if exists "anon can read admins" on public.admins;
alter table public.admins enable row level security;
revoke all on table public.admins from public, anon, authenticated;
grant all on table public.admins to service_role;

do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format(
      'revoke insert, update, delete, truncate, references, trigger on table public.%I from public, anon, authenticated',
      r.tablename
    );
  end loop;
end $$;

grant select on table public.transactions to anon;
grant select on table public.rates to anon;
grant select on table public.bank_accounts to anon;
