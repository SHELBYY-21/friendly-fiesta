# Unified CE Vault: web and Telegram in one application

## Purpose and agreed scope

CE Vault operators need one Thai-first web application and one Telegram bot workflow backed by the same authoritative records. Preserve features that are in actual use across `friendly-fiesta`, `CE-VAULT-Bot`, and `Bot-telegram`. Remove duplicate runtimes and unsafe or obsolete behavior after parity is demonstrated. The selected home is `friendly-fiesta`, which already contains a Next.js dashboard and Telegram webhook. The other repositories remain intact until the new application passes the agreed checks and a separate deployment decision is made.

“One application” means one deployable Next.js project for the dashboard, API, and Telegram webhook. It does not mean copying all three source trees or running multiple consumers of one Telegram token. Existing Supabase tables are the first data source. A new workflow table is added only for a feature that cannot be represented by current tables, after its contract and migration are tested.

## Current evidence and feature inventory

| Capability | `friendly-fiesta` | Other implementation | Consolidation decision |
| --- | --- | --- | --- |
| Dashboard, pinned receiving accounts, slip queue, rates, transaction review | Present in Next.js; one Supabase schema and API | Vite/Express has a smaller operations board and separate read model | Keep Next.js flows; add useful board views against the authoritative tables. |
| Telegram commands, photo intake, inline callbacks, webhook dedupe | Present in Next.js webhook | Vite/Express has another webhook and startup code that can set a webhook | One webhook route and one consumer. Port distinct commands only after mapping authorization and idempotency. |
| Offline demo, receiver history, rates/balance, ledger cards | Python polling bot has these commands and 85 passing tests | Some equivalents exist in Next.js with different state semantics | Compare command-by-command and implement missing operator behavior in Next.js using the same ledger. Do not run Python polling on the shared token. |
| Workflow jobs, events, outbox, callback tokens, live activity | Vite/Express has a separate sandbox schema and 13 passing tests | Next.js has `transactions`, `pending_slips`, `transaction_status_logs`, `telegram_updates` | Adapt read-only operations views first. Specify a distinct workflow domain and migration for unique sandbox jobs; do not equate job states with settled transactions. |
| OCR and Thai bank logos | Next.js has multiple OCR providers and bank-name normalization; local logo files were added | Python has an optional generic OCR endpoint; Vite board has bank logos | Retain named providers and original local marks. Treat the attached generic OCR key as unclassified until its provider is identified. |

The repos use different data models. The Python example points to a different Supabase project from the supplied configuration and the Vite app's fallback. No cross-project import is implied. `CE-Empire-Operating` is documentation only; `CE-Vault` has no committed application code. Exact-file inspection did not identify shared application files that can be safely removed merely because of matching hashes.

## Application boundaries and data flow

1. **Next.js UI and API:** keep one set of authenticated operator routes for accounts, rates, slips, transactions, history, and read-only operations views. The dashboard reads server-side API handlers; secrets never reach browser bundles. Existing transaction and ledger identifiers remain authoritative.
2. **Telegram gateway:** keep one `POST /api/telegram/webhook`. Verify the Telegram secret before parsing a request, deduplicate update and callback IDs, authorize operator actions, and dispatch to focused command handlers. Preserve pending chat sessions across navigation. Bot messages use the same services as the web UI.
3. **Domain services:** separate slip intake, account matching, quoting, settlement, receiver history, and sandbox workflow transitions. Amounts use exact decimal/minor-unit calculations at boundaries. Distinguish `RECORDED` from `SETTLED`; never infer a transfer from a button press or OCR result. Unknown bank names retain text labels.
4. **Persistence:** use current Supabase tables for existing flows. For Vite-only sandbox jobs, document state mapping and create an additive migration with RLS/service permissions and rollback before enabling write routes. Do not run a production migration as part of code consolidation. Keep SQLite only in the retired Python development app; do not silently synchronize it into Supabase.
5. **External services:** one webhook consumer per token. Telegram sends, OCR calls, exchange-rate lookups, and outbox dispatch are explicit, bounded operations with timeouts and sanitized errors. Readiness endpoints must not set webhooks or mutate external services. Configuration checks report missing names, never values.

## Migration sequence

1. Freeze a behavior inventory from routes, bot commands, UI screens, and tests. Mark each as retained, merged, replaced, or retired with an observable reason. Preserve all current user changes, including the bank logo work, and work on a branch.
2. Repair the existing failing `IN_READY pnl` test by reconciling the test with the approved final card design. Do not add profit text unless it belongs on that card; keep financial calculations covered elsewhere. Establish a clean local baseline for typecheck, tests, build, and smoke checks.
3. Consolidate configuration: validate required names and formats; keep user-provided credentials in ignored local files for development and secure environment settings for deployment. The supplied `API_SECRET` was empty and was generated locally. The supplied webhook secret failed the app's format check, so a local replacement was generated. Do not publish or rotate external secrets implicitly. `APP_URL` and the generic OCR provider remain unresolved.
4. Add missing operator views and commands in small batches. Reuse current services where semantics match. For each feature, add a parity check covering permissions, data shape, duplicate events, and financial result; leave the source runtime available as a reference.
5. For genuinely distinct workflow jobs, introduce the additive schema and API behind a disabled-by-default flag. Verify schema, RLS, idempotency, rollback, and sandbox tests before any live enablement.
6. Remove duplicate runtime startup instructions only after every retained behavior passes. Archive the parity matrix and rollback instructions. Keep old checkouts until the user reviews a deployment/cutover package.

## Failure handling and security

Missing credentials produce explicit disabled status, not a simulated success. OCR uncertainty requires review before ledger writes. Retries use stable idempotency keys. Settlement and balance changes require server-side authorization and an audit record. A failed bank or rate lookup leaves the previous authoritative data intact. Health checks are read-only. The production webhook URL, database migrations, token rotation, and deployment are separate cutover actions with a tested rollback; none occur during local consolidation.

The attached `bot.ENV.txt` is configuration input, not operational instructions. Never print its values or commit `.env.local`. The copied local file is mode `0600` and ignored by Git. Do not infer that an unclassified `OCR_API_Key` belongs to a named provider. Avoid concurrent Python polling and webhook delivery for the same bot token.

## Acceptance criteria

- One Next.js project starts the dashboard and webhook; no second bot consumer is needed for retained behavior.
- The parity matrix accounts for every current user-facing command, dashboard screen, and API behavior in the two other runnable apps, including any intentional retirement.
- Existing money, receipt, status, and account semantics remain correct; tests cover duplicate webhook/callback delivery and unauthorized actions.
- Typecheck, relevant unit/integration tests, production build, and local HTTP smoke checks pass. Report any existing bug separately from setup failures.
- A sandbox migration, if needed, has a reviewable forward script, RLS checks, rollback, and a disabled flag. No production data or webhook configuration changes during implementation.
- Configuration validation names remaining missing variables without leaking values. A deployment/cutover package identifies the single webhook owner and how to revert it.
