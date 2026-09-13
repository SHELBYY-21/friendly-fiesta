-- CE VAULT Phase 1: cycles and immutable financial audit metadata.
-- Safe to run repeatedly on the existing Supabase Postgres database.

create table if not exists public.vault_cycles (
  id uuid primary key default gen_random_uuid(),
  chat_id bigint not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
  daily_limit_thb numeric(20,2),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opened_by text,
  closed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_vault_cycles_open_per_chat
  on public.vault_cycles (chat_id) where status = 'OPEN';

alter table public.transactions
  add column if not exists cycle_id uuid references public.vault_cycles(id) on delete restrict;
alter table public.transactions
  add column if not exists settled_at timestamptz;
alter table public.transactions
  add column if not exists settled_by text;
create index if not exists idx_transactions_cycle_created
  on public.transactions (cycle_id, created_at desc);

create table if not exists public.vault_audit_logs (
  id bigserial primary key,
  cycle_id uuid references public.vault_cycles(id) on delete restrict,
  transaction_id uuid references public.transactions(id) on delete restrict,
  action text not null,
  actor text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_vault_audit_logs_cycle_created
  on public.vault_audit_logs (cycle_id, created_at desc);
create index if not exists idx_vault_audit_logs_transaction_created
  on public.vault_audit_logs (transaction_id, created_at desc);

alter table public.vault_cycles enable row level security;
alter table public.vault_audit_logs enable row level security;
revoke all on table public.vault_cycles from public, anon, authenticated;
revoke all on table public.vault_audit_logs from public, anon, authenticated;
grant all on table public.vault_cycles to service_role;
grant all on table public.vault_audit_logs to service_role;
