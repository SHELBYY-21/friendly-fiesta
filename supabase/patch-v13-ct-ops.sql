-- CE VAULT CT ops: pending slips before ledger lock
create table if not exists public.pending_slips (
  id               uuid primary key default gen_random_uuid(),
  short_ref        text not null,
  date_key         text not null,
  ledger_ref       text not null,
  chat_id          bigint not null,
  admin_tg_id      bigint not null,
  admin_name       text,
  status           text not null,
  thb_in           numeric(20,2),
  should_send      numeric(20,2),
  desk_rate        numeric(20,4),
  mkt_rate         numeric(20,4),
  bot_usd          numeric(20,4),
  bank             text,
  account_masked   text,
  name             text,
  pin_match        boolean not null default false,
  ocr_confidence   numeric(6,2),
  source_file_id   text,
  slip_url         text,
  slip_fingerprint text,
  message_id       bigint,
  undo_until       timestamptz,
  tx_id            uuid,
  note             text,
  bank_account_id  uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (date_key, short_ref)
);
create index if not exists idx_pending_slips_chat_date on public.pending_slips (chat_id, date_key, created_at desc);
create index if not exists idx_pending_slips_ledger on public.pending_slips (ledger_ref);

alter table public.pending_slips enable row level security;
drop policy if exists pending_slips_service on public.pending_slips;
create policy pending_slips_service on public.pending_slips for all to public using (true) with check (true);
