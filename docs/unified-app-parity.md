# CE Vault unified application parity

The Next.js project in this repository is the consolidation target. Statuses are evidence-based: **existing** means the current Next.js implementation has the behavior; **port** means it belongs in the unified core; **sandbox** means it is a separate non-financial workflow; **retire** means another implementation is intentionally replaced.

## Telegram operator commands

| Source command | Destination | Status | Evidence / reason |
| --- | --- | --- | --- |
| `/start`, `/console`, `/help` | Existing webhook menu and help | existing | `app/api/telegram/webhook/route.ts`; navigation preserves room sessions. |
| `/rates`, `/setrates` | `/rate`, `/setrate` | existing | One room-scoped desk rate implementation avoids two rate stores. |
| `/today`, `/ledger`, `/staff` | `/today`, `/ledger`, dashboard summary | existing | Current Supabase transaction ledger and leaderboard services. |
| `/history` | Operator command handler backed by receivers | port | Python behavior is useful; SQLite is not copied. |
| `/status` | Operator command handler backed by transaction ledger | port | Must retain recorded versus settled distinction. |
| `/balance` | Read-only operator command | port | Amount-changing form remains blocked until it uses an audited existing holding service. |
| `/demo` | Pure preview card | port | Must never persist a transaction. |
| `/delete` | Existing callback/delete flow | existing | Current flow has confirmation and authorization. |
| Python long polling | Next.js webhook | retire | One bot token must have one update consumer. |

## Vite/Express endpoints and screens

| Source capability | Destination | Status | Evidence / reason |
| --- | --- | --- | --- |
| Health, market rate, intake status | Existing Next.js health/market/dashboard APIs | existing | Health must be made read-only; no webhook registration on GET. |
| Operations overview | `/dashboard/operations` | port | Read current `transactions`, `pending_slips`, rates, and bank accounts. |
| Jobs, commands, activity | `/api/sandbox/*`, `/dashboard/sandbox` | sandbox | Separate job states must not be treated as financial settlement. |
| Activity SSE | Paginated activity view | retire | Initial unified view does not require a persistent connection. |
| Vite Telegram webhook | Next.js Telegram webhook | retire | Duplicate consumer and duplicate command state. |
| Vite static shell | Next.js dashboard | retire | The unified app keeps the richer authenticated dashboard. |

## Next.js surface retained

The unified app retains the root and dashboard pages, transaction detail and public status pages, admin APIs, dashboard account/rate/queue APIs, transaction APIs, export, cron handlers, market rate, read-only health, Telegram webhook and explicit webhook setup route. External webhook setup remains a separate approved cutover action.

## Baseline on 2026-10-08

- `npm test`: failed at the stale `IN_READY pnl` assertion after all earlier assertions passed. The approved final slip card intentionally omits profit from the confirmation card; profit remains tested on completion/deal-success cards.
- `npm run typecheck`: the concurrent baseline run collided with `next build` over `.next/types` and reported missing generated files. Verification gates run build and typecheck sequentially.
- `npm run build`: started successfully in the baseline run; its final result is recorded by the sequential Task 1 gate.
- Python reference suite previously passed 85 tests; Vite reference suite previously passed 13 tests. They remain reference evidence until parity rows are covered in this project.

## Current blockers

- `APP_URL` is not configured for a real HTTPS deployment origin.
- The attached generic `OCR_API_Key` has no identified provider and is not mapped to a named OCR variable.
- No production migration, webhook switch, or runtime retirement has been performed.
