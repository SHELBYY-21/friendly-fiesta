# CE Vault

CE Vault ops desk. Telegram bot + live vault. Not a customer bot.

Production runs as a Docker Compose stack with Caddy HTTPS on the configured `DOMAIN`.

## เปิดใช้จริง
1. ตั้ง `.env.production` บน VPS โดยให้ `APP_URL=https://<DOMAIN>`
2. ตั้ง `OPS_CHAT_ID` เป็น chat กลุ่มโต๊ะ (หลังเลขลบ) ให้ desk กับสลิปจากบอท
3. ผูก webhook หลัง deploy:
   สคริปต์ `scripts/deploy-production.sh` จะ migrate, deploy, ตรวจ HTTPS และตั้ง webhook ให้อัตโนมัติ
4. ในกลุ่ม: `/start` → ปักบัญชีรับ → `/setrate 36.70` → ส่งสลิป → **KEEP** → **บันทึกส่งรวม**
5. กดเริ่มใหม่ = จอดคิวเป็น HOLD ไม่ลบประวัติ ไม่โอน USDT — ดึงกลับด้วย KEEP บนแท็บ HOLD

Health: `GET /api/health`

Operations: `/dashboard/operations` (ใช้ dashboard session เดิม)

แผนรวมระบบและ rollback: [`docs/unified-app-cutover.md`](docs/unified-app-cutover.md)

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

## Production on Docker VPS

ต้องมี Docker Engine, Docker Compose, DNS ของ `DOMAIN` ชี้ไปยัง VPS และ `.env.production` ที่ไม่อยู่ใน Git จากนั้นรัน `./scripts/deploy-production.sh` หรือกำหนด GitHub Environment `production` พร้อม secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_DEPLOY_PATH` เพื่อ deploy อัตโนมัติทุกครั้งที่ push เข้า `main`.

## Env
Copy `.env.local.example`. Required: `BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_TELEGRAM_IDS`, `API_SECRET`, Supabase URL + secret key, `APP_URL`, and at least one named OCR provider key.

`APP_URL` ต้องเป็น HTTPS origin ที่เข้าถึงได้จริงและไม่มี path/query ใช้หน้า secret settings ของผู้ให้บริการ deployment สำหรับค่าลับ ห้าม commit `.env.local` คีย์ OCR ชื่อทั่วไปต้องระบุผู้ให้บริการก่อนจึงจะนำไปใช้ได้

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
