# Unified CE Vault cutover runbook

This runbook makes the Next.js project in this repository the only web and Telegram runtime. It is a review checklist; following it changes production, so migration, deployment, and webhook switching remain separate approved actions.

## Preflight

- Verify `npm test`, `npm run typecheck`, and `npm run build` on the exact commit to deploy.
- Set server-only values through the deployment provider's encrypted environment controls. Never paste values into Git, logs, issue comments, or browser-visible variables.
- Required names: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy anon key), `SUPABASE_SECRET_KEY` (or legacy service-role key), `BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_TELEGRAM_IDS`, `API_SECRET`, `DASHBOARD_PIN`, `DASHBOARD_SESSION_SECRET`, and `APP_URL`.
- `APP_URL` must be the public HTTPS origin only, with no path, query, or trailing slash. Example shape: `https://vault.example.com`.
- Configure at least one named OCR provider: `GROK_API_KEY`, `OCR_SPACE_API_KEY`, `AKSONOCR_API_KEY`, or `TYPHOON_API_KEY`. The uploaded generic `OCR_API_Key` is unclassified and must not be assigned to a provider until its issuer is identified.
- Optional values and provider-specific verification keys are listed in `.env.local.example`.
- Confirm the additive database patches required by the current app have been reviewed and applied to the target Supabase project. Do not apply sandbox workflow SQL unless that separately disabled feature is being reviewed.

## Read-only verification

1. Open `/api/health`. It may read Telegram `getWebhookInfo`, but the response must report `webhook.set: false`; this GET does not register a webhook.
2. Check the current Telegram destination directly with Bot API `getWebhookInfo` from an approved secret-aware terminal. Record only the URL, pending count, and last error; do not record the token.
3. Open `/`, authenticate through the dashboard PIN flow, and open `/dashboard/operations`.
4. Request `/banks/SCB.png` and confirm a successful image response. Unknown bank codes must render their text fallback.
5. Confirm no Python polling process, Vite webhook server, or second Next.js webhook consumer is running for the same bot token.

Local smoke on 2026-10-08 returned 200 for `/`, redirected `/dashboard/operations` to its intended PIN auth flow, and returned an SCB PNG. The health request waited on configured external services in this workspace and did not complete within 30 seconds; repeat that check against the deployed environment before cutover.

## Switch procedure (approval required)

1. Record the previous webhook URL for rollback.
2. Deploy this exact reviewed commit and complete the read-only checks against its public HTTPS origin.
3. Stop the old long-polling process before changing the webhook. Keep the old checkout and configuration recoverable.
4. Send one authenticated `POST /api/telegram/set-webhook` with `x-api-key: <API_SECRET>`. Never put the API key in a URL.
5. Re-run `getWebhookInfo` and confirm its URL is `${APP_URL}/api/telegram/webhook`, pending updates are stable, and no recent error is present.
6. From an authorized admin account, test `/rates`, `/history 1234` with a known safe lookup, and one controlled slip through the existing confirmation flow. Confirm a repeated Telegram update ID creates no second ledger effect.
7. Keep the old runtimes stopped. Archive them only after the agreed observation window.

## Rollback

1. Stop traffic to the new deployment if it is producing incorrect effects.
2. Restore the recorded previous webhook URL through Telegram `setWebhook`, preserving pending updates (`drop_pending_updates: false`).
3. Start only the matching previous consumer; never run polling and webhook consumers together.
4. Confirm `getWebhookInfo`, inspect pending/error counts, and compare ledger records before replaying any operator action.
5. Do not delete new ledger rows automatically. Reconcile them through the audited edit/reversal flow.

## Remaining gates

- A production `APP_URL` and provider-managed secret values must be confirmed at deployment time.
- The generic OCR key must be identified before use.
- Production migration validation, deployment, webhook switch, and old-runtime shutdown have not been performed by this implementation.
