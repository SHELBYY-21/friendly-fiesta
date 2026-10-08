# CE Vault unified application parity

The Next.js project in this repository is the consolidation target. Statuses are evidence-based: **existing** means the current Next.js implementation has the behavior; **port** means it belongs in the unified core; **sandbox** means it is a separate non-financial workflow; **retire** means another implementation is intentionally replaced.

## Telegram operator commands

| Source command | Destination | Status | Evidence / reason |
| --- | --- | --- | --- |
| `/start`, `/console`, `/help` | Existing webhook menu and help | existing | `app/api/telegram/webhook/route.ts`; navigation preserves room sessions. |
| `/rates`, `/setrates` | `/rate`, `/setrate` | existing | One room-scoped desk rate implementation avoids two rate stores. |
| `/today`, `/ledger`, `/staff` | `/today`, `/ledger`, dashboard summary | existing | Current Supabase transaction ledger and leaderboard services. |
| `/history` | Operator command handler backed by receivers | existing | Covered by `test/operator-commands.test.ts`; Python SQLite is not copied. |
| `/status` | Operator command handler backed by transaction ledger | existing | Read-only lookup retains the stored transaction status. |
| `/rates` | Read-only operator command | existing | Reads the current shared rate service. |
| `/balance` | Read-only operator command | existing | Reads account totals; amount-changing variants are intentionally unavailable. |
| `/demo` | Pure preview card | existing | Covered by a dependency-injected test with no persistence call. |
| `/delete` | Existing callback/delete flow | existing | Current flow has confirmation and authorization. |
| Python long polling | Next.js webhook | retire | One bot token must have one update consumer. |

## Vite/Express endpoints and screens

| Source capability | Destination | Status | Evidence / reason |
| --- | --- | --- | --- |
| Health, market rate, intake status | Existing Next.js health/market/dashboard APIs | existing | Health must be made read-only; no webhook registration on GET. |
| Operations overview | `/dashboard/operations` | existing | Reads current `transactions`, `pending_slips`, rates, and bank accounts; covered by `test/ops-overview.test.ts`. |
| Jobs, commands, activity | `/api/sandbox/*`, `/dashboard/sandbox` | sandbox | Implemented behind three fail-closed flags and an additive, unapplied schema; separate job states never write the financial ledger. |
| Activity SSE | Paginated activity view | retire | Initial unified view does not require a persistent connection. |
| Vite Telegram webhook | Next.js Telegram webhook | retire | Duplicate consumer and duplicate command state. |
| Vite static shell | Next.js dashboard | retire | The unified app keeps the richer authenticated dashboard. |

## Next.js surface retained

The unified app retains the root and dashboard pages, transaction detail and public status pages, admin APIs, dashboard account/rate/queue APIs, transaction APIs, export, cron handlers, market rate, read-only health, Telegram webhook and explicit webhook setup route. External webhook setup remains a separate approved cutover action.

## Verified core on 2026-10-08

- `npm test`: passes, including the 50/50 workflow rounds, operations overview, and operator commands.
- `npm run typecheck`: passes when run sequentially from the build because both commands manage `.next` generated types.
- `npm run build`: passes and includes `/dashboard/operations`.
- Telegram update IDs are claimed through the existing `claim_telegram_update` RPC before dispatch; duplicate claims return without a second effect.
- Python and Vite runtimes remain reference checkouts and must stay stopped for the bot token after cutover.

## Current blockers

- `APP_URL` is not configured for a real HTTPS deployment origin.
- The attached generic `OCR_API_Key` has no identified provider and is not mapped to a named OCR variable.
- No production migration, webhook switch, or runtime retirement has been performed.
