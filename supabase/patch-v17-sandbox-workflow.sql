-- Additive sandbox workflow. Does not alter the financial ledger.
create table if not exists public.workflow_jobs (
  id uuid primary key default gen_random_uuid(), public_ref text not null unique,
  state text not null default 'IDLE', state_version bigint not null default 1 check (state_version > 0),
  transaction_type text not null default 'SANDBOX_JOB', amount numeric(38,18) check (amount is null or amount >= 0),
  currency text not null default 'THB', worker text not null default 'INTAKE-01', summary text not null,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint workflow_job_state check (state in ('IDLE','SCANNING','OCR_EXTRACTING','VERIFYING','NEED_CONFIRMATION','PROCESSING','WAITING','SETTLING','COMPLETED','FAILED','DUPLICATE','TIMEOUT'))
);
create table if not exists public.job_events (
  id bigint generated always as identity primary key, event_id uuid not null unique default gen_random_uuid(),
  job_id uuid not null references public.workflow_jobs(id) on delete restrict, event_type text not null,
  from_state text, to_state text, actor_id text, idempotency_key text, payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create table if not exists public.command_idempotency (
  job_id uuid not null references public.workflow_jobs(id) on delete restrict, idempotency_key text not null,
  request_hash text not null, response jsonb not null, created_at timestamptz not null default now(), primary key(job_id,idempotency_key)
);
create table if not exists public.outbox_messages (
  id uuid primary key default gen_random_uuid(), aggregate_id uuid not null references public.workflow_jobs(id) on delete restrict,
  topic text not null, payload jsonb not null, dedupe_key text not null unique,
  status text not null default 'PENDING' check (status in ('PENDING','DISPATCHED','FAILED')),
  attempt_count integer not null default 0, available_at timestamptz not null default now(), last_error_code text, created_at timestamptz not null default now()
);
create index if not exists workflow_jobs_updated_idx on public.workflow_jobs(updated_at desc);
create index if not exists job_events_job_idx on public.job_events(job_id, occurred_at desc);
create index if not exists outbox_pending_idx on public.outbox_messages(available_at) where status='PENDING';
alter table public.workflow_jobs enable row level security;
alter table public.job_events enable row level security;
alter table public.command_idempotency enable row level security;
alter table public.outbox_messages enable row level security;
revoke all on public.workflow_jobs, public.job_events, public.command_idempotency, public.outbox_messages from anon, authenticated;

create or replace function public.create_sandbox_workflow_job(p_summary text,p_amount numeric,p_currency text,p_actor_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j public.workflow_jobs; result jsonb;
begin
  insert into public.workflow_jobs(public_ref,summary,amount,currency)
  values('SBX-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),trim(p_summary),p_amount,upper(p_currency)) returning * into j;
  insert into public.job_events(job_id,event_type,to_state,actor_id) values(j.id,'job.created.v1',j.state,p_actor_id);
  result=jsonb_build_object('job_id',j.id,'public_ref',j.public_ref,'state',j.state,'state_version',j.state_version);
  insert into public.outbox_messages(aggregate_id,topic,payload,dedupe_key) values(j.id,'workflow.job.created.v1',result,'created:'||j.id);
  return result;
end $$;
revoke execute on function public.create_sandbox_workflow_job(text,numeric,text,text) from public,anon,authenticated;
grant execute on function public.create_sandbox_workflow_job(text,numeric,text,text) to service_role;

create or replace function public.transition_sandbox_job(p_job_id uuid,p_expected_version bigint,p_to_state text,p_idempotency_key text,p_request_hash text,p_actor_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j public.workflow_jobs; prior public.command_idempotency; result jsonb;
begin
  select * into prior from public.command_idempotency where job_id=p_job_id and idempotency_key=p_idempotency_key;
  if found then
    if prior.request_hash<>p_request_hash then raise exception 'IDEMPOTENCY_KEY_CONFLICT'; end if;
    return prior.response || jsonb_build_object('idempotent_replay',true);
  end if;
  select * into j from public.workflow_jobs where id=p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if j.state_version<>p_expected_version then raise exception 'STATE_VERSION_STALE'; end if;
  if not (case j.state when 'IDLE' then p_to_state='SCANNING' when 'SCANNING' then p_to_state in ('OCR_EXTRACTING','FAILED','TIMEOUT') when 'OCR_EXTRACTING' then p_to_state in ('VERIFYING','FAILED','DUPLICATE') when 'VERIFYING' then p_to_state in ('NEED_CONFIRMATION','FAILED','DUPLICATE') when 'NEED_CONFIRMATION' then p_to_state in ('PROCESSING','TIMEOUT') when 'PROCESSING' then p_to_state in ('WAITING','SETTLING','FAILED','TIMEOUT') when 'WAITING' then p_to_state in ('PROCESSING','SETTLING','FAILED','TIMEOUT') when 'SETTLING' then p_to_state in ('COMPLETED','FAILED','TIMEOUT') else false end) then raise exception 'INVALID_STATE_TRANSITION'; end if;
  update public.workflow_jobs set state=p_to_state,state_version=state_version+1,updated_at=now() where id=p_job_id returning * into j;
  insert into public.job_events(job_id,event_type,from_state,to_state,actor_id,idempotency_key) values(j.id,'job.state_changed.v1',null,j.state,p_actor_id,p_idempotency_key);
  result=jsonb_build_object('job_id',j.id,'state',j.state,'state_version',j.state_version,'idempotent_replay',false);
  insert into public.command_idempotency values(j.id,p_idempotency_key,p_request_hash,result,now());
  insert into public.outbox_messages(aggregate_id,topic,payload,dedupe_key) values(j.id,'workflow.job.state_changed.v1',result,'state:'||j.id||':'||j.state_version);
  return result;
end $$;
revoke execute on function public.transition_sandbox_job(uuid,bigint,text,text,text,text) from public,anon,authenticated;
grant execute on function public.transition_sandbox_job(uuid,bigint,text,text,text,text) to service_role;
