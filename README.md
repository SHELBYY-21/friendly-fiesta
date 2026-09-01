# CE Vault

Crown Tether ops desk. Telegram bot + live vault. Not a customer bot.

**Prod:** https://ce-vault.vercel.app

## เปิดใช้จริง
1. ตั้ง env บน Vercel ตาม README Env — `APP_URL=https://ce-vault.vercel.app`
2. ตั้ง `OPS_CHAT_ID` เป็น chat กลุ่มโต๊ะ (หลังเลขลบ) ให้ desk กับสลิปจากบอท
3. ผูก webhook หลัง deploy:
   `POST https://ce-vault.vercel.app/api/telegram/set-webhook` หัว `x-api-key`
4. ในกลุ่ม: `/start` → ปักบัญชีรับ → `/setrate 36.70` → ส่งสลิป → **KEEP** → **บันทึกส่งรวม**
5. กดเริ่มใหม่ = จอดคิวเป็น HOLD ไม่ลบประวัติ ไม่โอน USDT — ดึงกลับด้วย KEEP บนแท็บ HOLD

Health: `GET /api/health`

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

ใช้งาน: `OPS_CHAT_ID` (chat โต๊ะ), `DASHBOARD_PIN` (รหัส 6 หลัก).

Test Vision without Telegram:

```bash
export GROK_API_KEY=xai-...
python3 scripts/test_vision.py slip.jpg
```

Do not set `DEFAULT_SELL_RATE` / `DEFAULT_MARKET_RATE`.

## Ops
1. `/start`
2. pin the receiving account (same bank + last4 as the slip)
3. `/setrate 36.70`
4. send one slip → **keep** → **sent**

Webhook: `POST /api/telegram/set-webhook` with `x-api-key`.
