# Unified CE Vault Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `friendly-fiesta` the single web and Telegram application for the existing CE Vault ledger, retaining the operator behavior currently used in the Vite and Python applications.

**Architecture:** Keep the Next.js dashboard, API, webhook, and existing Supabase tables as the authority. Add only missing operator commands and read-only board views through existing services. Keep the old runtimes as references until parity is verified, then document a single-consumer cutover without performing it.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase, Telegram Bot API, Node 24.

**Spec:** `docs/superpowers/specs/2026-10-08-unified-ce-vault-design.md`

## Global Constraints

- One deployable Next.js project for dashboard, API, and one Telegram webhook.
- Preserve current transaction identifiers and distinguish recorded entries from settled transfers.
- No production migration, webhook switch, transfer, message send, or credential publication during implementation.
- Preserve existing uncommitted bank-logo files and ignored `.env.local`; never add secret values to Git.
- Do not infer a named OCR provider from the attached generic `OCR_API_Key`.
- Keep old checkouts recoverable until a separately reviewed cutover.

## Review Focus

- Repeated Telegram update: one ledger effect and a stable reply; Task 3 tests this.
- Unauthorized command/callback: no account, rate, or ledger change; Task 3 tests this.
- Unknown bank string: text remains visible without a broken logo; Task 2 tests this.
- Missing Supabase or Telegram settings: health reports disabled/readiness without a remote mutation; Task 2 tests this.
- Money rounding near a fraction of USDT: authoritative result remains unchanged across web and bot; Task 3 tests this.

---

### Task 1: Baseline and feature parity inventory

**Files:**
- Create: `docs/unified-app-parity.md`
- Modify: `test/run-test.ts`
- Test: `test/run-test.ts`, `test/desk-ops.test.ts`, `test/fifty-rounds.ts`

**Interfaces:**
- Consumes: current routes, UI, and commands in all three runnable repositories.
- Produces: a table with each command/screen/route and the exact destination, parity check, or documented retirement reason.

- [ ] List commands from `Bot-telegram/bot.py`, endpoints from `CE-VAULT-Bot/appsrc/server/index.mjs`, and current Next.js routes in `docs/unified-app-parity.md`; classify each as existing, to port, sandbox-only, or deliberately retired with reason.
- [ ] Run `npm run typecheck && npm test && npm run build` in `friendly-fiesta`; record counts and the first failure in the parity document. The known failure is `IN_READY pnl`.
- [ ] Resolve the `IN_READY pnl` assertion in `test/run-test.ts` against the approved final slip card in `src/lib/ct/slipView.ts`: assert the displayed amount, rate, and state, and retain profit assertions on `UI.liveCompleted` and `UI.dealSuccess`. Do not add profit copy to the slip card solely to satisfy the stale test.
- [ ] Run `npm test`, `npm run typecheck`, and `npm run build`; expect all to pass and `fifty-rounds` to report 50/50.
- [ ] Commit only the parity document and test adjustment.

### Task 2: Safe configuration and read-only operations view

**Files:**
- Create: `src/lib/ops/overview.ts`, `src/components/ops/Overview.tsx`, `app/dashboard/operations/page.tsx`, `test/ops-overview.test.ts`
- Modify: `app/api/health/route.ts`, `src/lib/runtimeEnv.ts`, `src/components/BankLogo.tsx`, `package.json`
- Reference: `CE-VAULT-Bot/appsrc/server/ops-summary.mjs`, `CE-VAULT-Bot/appsrc/src/ops-main.js`

**Interfaces:**
- Produces: `buildOpsOverview(input: { transactions: OpsTransaction[]; pendingSlips: OpsPendingSlip[]; rates: OpsRate[]; bankAccounts: OpsBankAccount[]; now: Date }): OpsOverview` in `src/lib/ops/overview.ts`; these narrow data types are declared and exported in that file, using fields already selected by the existing dashboard services.
- Produces: `GET /dashboard/operations`, server-rendered for an authenticated operator and reading the current Supabase tables.

- [ ] Add `test/ops-overview.test.ts` with fixtures for an empty day, one pending slip, one completed transaction, reversed transaction exclusion, masked account, and a transaction read cap; assert totals and data-quality status.
- [ ] Run `npx ts-node --project test/tsconfig.json test/ops-overview.test.ts`; expect a missing module failure.
- [ ] Implement `buildOpsOverview` using existing transaction status semantics and exact decimal utilities; no separate workflow schema or browser-side service key.
- [ ] Add a test for unknown bank name rendering text with no image; implement the fallback in `BankLogo` only if the current behavior fails.
- [ ] Add a protected `/dashboard/operations` view that uses `buildOpsOverview` and the current authenticated data access. Show unavailable/partial data explicitly; do not display placeholder financial totals.
- [ ] Add a test that a missing credential returns a read-only degraded health result without calling `ensureTelegramWebhook`; adjust `app/api/health/route.ts` to stop registering webhooks on GET.
- [ ] Add `test/ops-overview.test.ts` to the existing `npm test` script.
- [ ] Run targeted tests, `npm run typecheck`, `npm test`, and `npm run build`; commit only Task 2 files.

### Task 3: Telegram command parity on one ledger

**Files:**
- Create: `src/lib/telegram/operatorCommands.ts`, `test/operator-commands.test.ts`
- Modify: `app/api/telegram/webhook/route.ts`, `src/lib/telegram/botCommands.ts`, `package.json`
- Reference: `Bot-telegram/ce_vault/handlers.py`, `Bot-telegram/ce_vault/rates.py`, `Bot-telegram/ce_vault/ledger.py`

**Interfaces:**
- Produces: `handleOperatorCommand(input: { chatId: number; userId: number; text: string; updateId: number }): Promise<OutgoingMessage | null>`; import `OutgoingMessage` from `src/lib/telegram.ts`. Returns `null` for commands handled by existing code. It uses existing Supabase services for rates, receiver history, ledger lookup, and balances.

- [ ] Add fixtures for `/history`, `/status`, `/rates`, `/balance`, and `/demo` in `test/operator-commands.test.ts`. `/balance` without an amount reads; an amount-changing variant must reuse the existing audited admin holding service or remain a documented parity blocker. Demo never persists a real transaction. Compare against `docs/unified-app-parity.md`.
- [ ] Add duplicate-update, unauthorized-user, unknown-command, and 0.0001 USDT rounding tests; run the targeted test and expect it to fail before implementation.
- [ ] Implement `handleOperatorCommand` by calling existing services. Do not copy Python SQLite state or start polling. Reuse the webhook's update dedupe and admin authorization before invocation.
- [ ] Register only newly implemented commands through the existing webhook dispatcher and command list. Keep existing `/pin`, `/rate`, `/ledger`, and slip flows intact.
- [ ] Add `test/operator-commands.test.ts` to the existing `npm test` script.
- [ ] Run targeted tests, `npm test`, `npm run typecheck`, and `npm run build`; commit only Task 3 files.

### Task 4: One-runtime handoff package

**Files:**
- Modify: `docs/unified-app-parity.md`, `README.md`
- Create: `docs/unified-app-cutover.md`

**Interfaces:**
- Produces: a reviewable cutover checklist and rollback for one Telegram webhook and one Next.js deployment; does not perform the cutover.

- [ ] Check every non-sandbox parity row against a passing test or a documented manual check; list gaps as blockers instead of marking them complete.
- [ ] Document exact credential names, the `APP_URL` origin requirement, the unclassified OCR key, and secure environment-setting entry. Do not include secret values or the attached file contents.
- [ ] Document how to verify the current Telegram webhook read-only, how to switch only after approval, and how to revert to the previous URL. Do not run `setWebhook`, polling, or deployment.
- [ ] Start the local Next.js app and check `/`, `/dashboard/operations` through its intended auth flow, `/banks/SCB.png`, and a non-mutating health request. Verify there is no second local consumer.
- [ ] Run `git diff --check`, `npm test`, `npm run typecheck`, and `npm run build`; commit only Task 4 docs.
