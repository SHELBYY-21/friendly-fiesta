# Sandbox workflow migration

`supabase/patch-v17-sandbox-workflow.sql` adds four isolated tables and one atomic transition RPC. It does not alter `transactions`, `pending_slips`, balances, or settlement services. RLS is enabled and browser roles receive no table or RPC access.

Apply only to an isolated staging database first with `psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/patch-v17-sandbox-workflow.sql`. This workspace has no isolated database configured, so SQL execution remains an explicit deployment gate and sandbox writes stay disabled.

Enable runtime access only when all three values are exact: `CE_VAULT_SANDBOX=true`, `LIVE_SETTLEMENT=false`, `LIVE_SETTLEMENT_ENABLED=false`.

Rollback after confirming sandbox data is no longer required:

```sql
drop function if exists public.transition_sandbox_job(uuid,bigint,text,text,text,text);
drop function if exists public.create_sandbox_workflow_job(text,numeric,text,text);
drop table if exists public.outbox_messages;
drop table if exists public.command_idempotency;
drop table if exists public.job_events;
drop table if exists public.workflow_jobs;
```
