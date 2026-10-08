# CE Vault Sandbox Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the distinct Vite/Express workflow-job and activity capabilities into the unified Next.js application as a disabled-by-default sandbox feature.

**Architecture:** Port the workflow state contract and data access to focused TypeScript modules. Use separate additive Supabase tables because job states do not equal settled financial transactions. Expose protected read views first, then sandbox-only transitions with version checks and idempotency.

**Tech Stack:** Next.js 15, TypeScript, Supabase/Postgres, Node test tooling.

**Spec:** `docs/superpowers/specs/2026-10-08-unified-ce-vault-design.md`

## Global Constraints

- Keep `transactions` and `pending_slips` authoritative for the existing ledger; sandbox jobs never debit or settle money.
- No production migration, webhook switch, outbox dispatch, or deployment in this plan.
- Disable all sandbox write routes unless `CE_VAULT_SANDBOX=true`, `LIVE_SETTLEMENT=false`, and `LIVE_SETTLEMENT_ENABLED=false`.
- Preserve existing user files, credentials, and the Vite reference checkout.

## Review Focus

- Duplicate idempotency key with different payload: reject without a second event; Task 2 tests this.
- Stale state version: return a conflict and preserve the job; Task 2 tests this.
- Non-admin reader: no access to jobs or activity; Task 3 tests this.
- Unconfigured sandbox flags: write route is disabled; Task 2 tests this.
- Outbox delivery fails: pending message remains retryable and no transfer is recorded; Task 3 tests this.

---

### Task 1: Port the workflow contract and prepare additive schema

**Files:**
- Create: `src/lib/sandbox/contract.ts`, `test/sandbox-contract.test.ts`, `supabase/patch-v17-sandbox-workflow.sql`, `docs/sandbox-workflow-migration.md`
- Modify: `package.json`
- Reference: `CE-VAULT-Bot/appsrc/server/domain/contract.mjs`, `CE-VAULT-Bot/appsrc/supabase/migrations/20261003_cevault_workflow_v1.sql`

**Interfaces:**
- Produces: `canTransition(from: JobState, to: JobState): boolean` and `targetForCommand(action: SandboxAction, from: JobState): JobState | null`.
- Produces: `workflow_jobs`, `job_events`, `command_idempotency`, and `outbox_messages` with an additive migration; existing ledger tables are untouched.

- [ ] Add contract tests for each allowed transition, unknown action, and any transition to a settlement state; expect the latter two to fail closed.
- [ ] Run `npx ts-node --project test/tsconfig.json test/sandbox-contract.test.ts`; expect a missing module failure.
- [ ] Implement the contract by translating the Vite state machine, with `LIVE_SETTLEMENT` permanently false in this sandbox.
- [ ] Write additive SQL for jobs, events, idempotency, and outbox with primary/unique keys and RLS. Document a rollback that removes only newly created sandbox objects after confirming no retained sandbox data.
- [ ] Run contract tests and a local SQL syntax/migration check against an isolated database when available; if no database exists, mark migration validation as outstanding and do not enable writes.
- [ ] Add `test/sandbox-contract.test.ts` to the existing `npm test` script.
- [ ] Commit Task 1 files.

### Task 2: Guarded job commands

**Files:**
- Create: `src/lib/sandbox/repository.ts`, `src/lib/sandbox/commands.ts`, `app/api/sandbox/jobs/route.ts`, `app/api/sandbox/jobs/[id]/commands/route.ts`, `test/sandbox-commands.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `createSandboxJob(input: NewSandboxJob, actor: AdminActor): Promise<SandboxJob>` and `transitionSandboxJob(input: { jobId: string; expectedVersion: number; action: SandboxAction; idempotencyKey: string }, actor: AdminActor): Promise<SandboxJob>`.

- [ ] Add tests for missing sandbox flags, non-admin actor, stale version, duplicate same-key request, conflicting same-key payload, and no financial ledger mutation.
- [ ] Run targeted tests and observe missing module failures.
- [ ] Implement commands using a database transaction/RPC so event, version, and idempotency changes are atomic. Return explicit conflict/error codes; do not create a payment or settlement route.
- [ ] Expose admin-only POST routes after the flags and repository check succeed. When schema is unavailable, return disabled/unavailable status without fallback writes.
- [ ] Add `test/sandbox-commands.test.ts` to the existing `npm test` script.
- [ ] Run targeted tests, `npm run typecheck`, and `npm run build`; commit Task 2 files.

### Task 3: Read-only activity and operator view

**Files:**
- Create: `app/api/sandbox/activity/route.ts`, `app/dashboard/sandbox/page.tsx`, `src/components/ops/SandboxActivity.tsx`, `test/sandbox-activity.test.ts`
- Modify: `package.json`
- Reference: `CE-VAULT-Bot/appsrc/server/ops-summary.mjs`, `CE-VAULT-Bot/appsrc/src/ops-main.js`

**Interfaces:**
- Produces: `GET /api/sandbox/activity?limit=25` for an authenticated admin and a dashboard showing job states and event history.

- [ ] Add tests for an empty result, redacted account data, non-admin denial, and an outbox delivery error that remains retryable without creating a financial transaction.
- [ ] Run targeted tests and observe missing route/module failures.
- [ ] Add paginated, read-only repository access and a dashboard with clear loading, empty, disabled, and error states. Do not open an SSE connection merely to render the first page.
- [ ] Add `test/sandbox-activity.test.ts` to the existing `npm test` script.
- [ ] Run targeted tests, `npm test`, `npm run typecheck`, `npm run build`, and a local authenticated smoke request.
- [ ] Update `docs/unified-app-parity.md` with sandbox coverage and the migration check result; commit Task 3 files.
