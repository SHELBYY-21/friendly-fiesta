# CE Vault

Crown Tether ops desk. Telegram bot + live vault. Not a customer bot.

**Prod:** https://ce-vault.vercel.app

## Flow
Slip photo → OCR → pin match → DESK rate → keep → sent.

| | |
|---|---|
| DESK | per room (`/setrate` or **rate**) |
| MKT | Bitkub USDT_THB, fallback Binance TH |
| USDT | THB ÷ DESK |

## Run
```bash
npm i
npm test
npm run dev
```

## Env
Copy `.env.local.example`. Required: `BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_TELEGRAM_IDS`, `API_SECRET`, Supabase URL + secret key, `APP_URL`, `GROK_API_KEY`.

Do not set `DEFAULT_SELL_RATE` / `DEFAULT_MARKET_RATE`.

## Ops
1. `/start`
2. pin the receiving account (same bank + last4 as the slip)
3. `/setrate 36.70`
4. send one slip → **keep** → **sent**

Webhook: `POST /api/telegram/set-webhook` with `x-api-key`.
