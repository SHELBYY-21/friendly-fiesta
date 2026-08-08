-- CE VAULT v10: production safety, idempotency, pinned receiving accounts.
-- Apply after schema.sql and patches v2-v9.
begin;

alter table public.transactions
  add column if not exists slip_fingerprint text;

do $$
begin
  if not exists (
    select ledger_ref from public.transactions
    where ledger_ref is not null
    group by ledger_ref having count(*) > 1
  ) then
    create unique index if not exists uq_transactions_ledger_ref
      on public.transactions (ledger_ref) where ledger_ref is not null;
  else
    raise warning 'Existing duplicate ledger_ref values found; preserving rows and leaving the existing lookup index in place';
  end if;
end $$;

create unique index if not exists uq_transactions_slip_fingerprint
  on public.transactions (slip_fingerprint)
  where slip_fingerprint is not null;

alter table public.bot_sessions
  add column if not exists admin_id uuid,
  add column if not exists admin_name text,
  add column if not exists slip_fingerprint text,
  add column if not exists live_message_id bigint,
  add column if not exists live_tx_id uuid;

create table if not exists public.pinned_bank_accounts (
  chat_id bigint not null,
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  pinned_for_date date not null,
  created_at timestamptz not null default now(),
  primary key (chat_id, bank_account_id, pinned_for_date)
);

create index if not exists idx_pinned_bank_accounts_lookup
  on public.pinned_bank_accounts (chat_id, pinned_for_date, created_at);

alter table public.pinned_bank_accounts enable row level security;
revoke all on table public.pinned_bank_accounts from anon, authenticated;

create or replace function public.enforce_ce_vault_pin_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(new.chat_id);
  if (
    select count(*) from public.pinned_bank_accounts
    where chat_id = new.chat_id and pinned_for_date = new.pinned_for_date
  ) >= 3 then
    raise exception 'PIN_LIMIT_REACHED' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ce_vault_pin_limit on public.pinned_bank_accounts;
create trigger trg_ce_vault_pin_limit
before insert on public.pinned_bank_accounts
for each row execute function public.enforce_ce_vault_pin_limit();

create table if not exists public.telegram_updates (
  update_id bigint primary key,
  claimed_at timestamptz not null default now()
);
alter table public.telegram_updates enable row level security;
revoke all on table public.telegram_updates from anon, authenticated;
create index if not exists idx_telegram_updates_claimed_at on public.telegram_updates (claimed_at);

create or replace function public.claim_telegram_update(p_update_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.telegram_updates(update_id) values (p_update_id)
  on conflict do nothing;
  return found;
end;
$$;

revoke all on function public.claim_telegram_update(bigint) from public, anon, authenticated;
grant execute on function public.claim_telegram_update(bigint) to service_role;

create or replace function public.ce_vault_record_incoming(
  p_admin_id uuid,
  p_bank_account_id uuid,
  p_chat_id bigint,
  p_thb numeric,
  p_usdt numeric,
  p_sell_rate numeric,
  p_market_rate numeric,
  p_room_name text,
  p_ocr_confidence numeric,
  p_ledger_ref text,
  p_slip_image_url text,
  p_slip_fingerprint text,
  p_receiver_name text,
  p_receiver_bank text,
  p_receiver_last4 text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if p_thb <= 0 or p_usdt <= 0 or p_sell_rate <= 0 or p_market_rate <= 0 then
    raise exception 'INVALID_AMOUNT_OR_RATE' using errcode = '22023';
  end if;
  insert into public.transactions (
    admin_id, bank_account_id, chat_id, type, thb_amount, usdt_amount,
    sell_rate, buy_rate, cost_per_unit, sell_value_thb, net_profit_thb,
    profit_percent, room_name, ocr_confidence, ledger_ref, note,
    slip_image_url, slip_fingerprint, receiver_name, receiver_bank, receiver_last4
  ) values (
    p_admin_id, p_bank_account_id, p_chat_id, 'THB_DEPOSIT', p_thb, p_usdt,
    p_sell_rate, p_sell_rate, p_market_rate, p_thb, p_thb - (p_usdt * p_market_rate),
    ((p_thb - (p_usdt * p_market_rate)) / p_thb) * 100,
    p_room_name, p_ocr_confidence, p_ledger_ref, p_ledger_ref,
    coalesce(p_slip_image_url, ''), p_slip_fingerprint,
    p_receiver_name, p_receiver_bank, p_receiver_last4
  ) returning id into v_id;

  if p_bank_account_id is not null then
    update public.bank_accounts
      set current_balance = current_balance + p_thb
      where id = p_bank_account_id;
    if not found then raise exception 'BANK_ACCOUNT_NOT_FOUND' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.ce_vault_record_outgoing(
  p_admin_id uuid,
  p_chat_id bigint,
  p_usdt numeric,
  p_ledger_ref text,
  p_slip_image_url text,
  p_slip_fingerprint text,
  p_usdt_network text,
  p_usdt_txid text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if p_usdt <= 0 then raise exception 'INVALID_AMOUNT' using errcode = '22023'; end if;
  insert into public.transactions (
    admin_id, chat_id, type, usdt_amount, ledger_ref, note, slip_image_url,
    slip_fingerprint, usdt_network, usdt_txid, usdt_image_url
  ) values (
    p_admin_id, p_chat_id, 'USDT_SEND', p_usdt, p_ledger_ref, p_ledger_ref,
    coalesce(p_slip_image_url, ''), p_slip_fingerprint, p_usdt_network,
    p_usdt_txid, nullif(p_slip_image_url, '')
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.ce_vault_record_incoming(uuid,uuid,bigint,numeric,numeric,numeric,numeric,text,numeric,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.ce_vault_record_incoming(uuid,uuid,bigint,numeric,numeric,numeric,numeric,text,numeric,text,text,text,text,text,text) to service_role;
revoke all on function public.ce_vault_record_outgoing(uuid,bigint,numeric,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.ce_vault_record_outgoing(uuid,bigint,numeric,text,text,text,text,text) to service_role;

create or replace function public.ce_vault_update_ledger_transaction(
  p_tx_id uuid,
  p_new_thb numeric,
  p_new_usdt numeric,
  p_market_rate numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v public.transactions%rowtype;
declare v_thb_delta numeric;
begin
  select * into v from public.transactions where id = p_tx_id for update;
  if not found or v.ledger_ref is null then raise exception 'TRANSACTION_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_new_usdt <= 0 or p_new_thb < 0 or p_market_rate <= 0 then raise exception 'INVALID_AMOUNT' using errcode = '22023'; end if;

  if v.type = 'THB_DEPOSIT' then
    if p_new_thb <= 0 then raise exception 'INVALID_THB_AMOUNT' using errcode = '22023'; end if;
    v_thb_delta := p_new_thb - v.thb_amount;
    update public.transactions set
      thb_amount = p_new_thb,
      usdt_amount = p_new_usdt,
      cost_per_unit = p_market_rate,
      sell_value_thb = p_new_thb,
      net_profit_thb = p_new_thb - (p_new_usdt * p_market_rate),
      profit_percent = ((p_new_thb - (p_new_usdt * p_market_rate)) / p_new_thb) * 100,
      updated_at = now()
    where id = p_tx_id returning * into v;
    if v.bank_account_id is not null then
      update public.bank_accounts set current_balance = current_balance + v_thb_delta where id = v.bank_account_id;
    end if;
  else
    update public.transactions set usdt_amount = p_new_usdt, updated_at = now()
      where id = p_tx_id returning * into v;
  end if;
  return to_jsonb(v);
end;
$$;

create or replace function public.ce_vault_delete_ledger_transaction(p_tx_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v public.transactions%rowtype;
begin
  select * into v from public.transactions where id = p_tx_id for update;
  if not found or v.ledger_ref is null then raise exception 'TRANSACTION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v.type = 'THB_DEPOSIT' and v.bank_account_id is not null then
    update public.bank_accounts set current_balance = current_balance - v.thb_amount where id = v.bank_account_id;
  end if;
  delete from public.transactions where id = p_tx_id;
  return true;
end;
$$;

revoke all on function public.ce_vault_update_ledger_transaction(uuid,numeric,numeric,numeric) from public, anon, authenticated;
grant execute on function public.ce_vault_update_ledger_transaction(uuid,numeric,numeric,numeric) to service_role;
revoke all on function public.ce_vault_delete_ledger_transaction(uuid) from public, anon, authenticated;
grant execute on function public.ce_vault_delete_ledger_transaction(uuid) to service_role;

commit;
