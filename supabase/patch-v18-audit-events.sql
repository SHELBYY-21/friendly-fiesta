-- Append-only audit trail for slip ingest / approve / settle / mutations
-- paste in Supabase SQL Editor > Run (idempotent)

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  chat_id bigint,
  actor_tg_id bigint,
  fingerprint text,
  tx_id uuid,
  pending_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_created_at_idx on public.audit_events (created_at desc);
create index if not exists audit_events_fingerprint_idx on public.audit_events (fingerprint);
create index if not exists audit_events_kind_idx on public.audit_events (kind);

alter table public.audit_events enable row level security;

drop policy if exists audit_events_service_role on public.audit_events;
create policy audit_events_service_role on public.audit_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
