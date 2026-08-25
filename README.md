# USDT Arbitrage — Telegram Bot + Next.js Dashboard

ระบบบันทึกสลิปโอน THB → แลก USDT ผ่าน Telegram พร้อมแดชบอร์ด Next.js + Supabase (Realtime)

## โครงสร้างโปรเจกต์

```
BOT/
├─ app/                                     # Next.js App Router
│  ├─ api/transactions/thb-deposit/route.ts # API เฟส 1 (ฝาก THB -> USDT)
│  ├─ api/transactions/usdt-send/route.ts   # API เฟส 2 (ส่ง USDT)
│  ├─ dashboard/page.tsx                     # แดชบอร์ด (Realtime)
│  ├─ dashboard/transactions/[id]/page.tsx   # หน้ารายละเอียด + ภาพสลิป
│  ├─ layout.tsx / page.tsx / globals.css
├─ src/
│  ├─ components/AverageFeeCard.tsx
│  ├─ components/TransactionsTable.tsx
│  ├─ lib/profit.ts / fees.ts                # ฟังก์ชันคำนวณ
│  ├─ lib/supabaseClient.ts / supabaseAdmin.ts
│  └─ types/transactions.ts                  # Interfaces กลาง
├─ supabase/schema.sql                       # SQL สร้างตาราง + RPC + RLS + bucket
├─ bot/                                      # Telegram Bot (แยกโปรเจกต์)
│  ├─ src/index.ts
│  ├─ package.json / tsconfig.json / .env.example
├─ package.json / tsconfig.json / tailwind.config.ts ...
```

---

## วิธีติดตั้งและรัน (ทำตามทีละข้อ)

### Step 1 — เตรียมโปรเจกต์ Next.js
โฟลเดอร์นี้เตรียมไฟล์ให้ครบแล้ว ข้ามการ `create-next-app` ได้เลย
> ถ้าอยากเริ่มจาก template ทางการ: `npx create-next-app@latest -e with-supabase` แล้วค่อยเอาไฟล์ในนี้ไปวางทับ

### Step 2 — Tailwind
ไฟล์ `tailwind.config.ts`, `postcss.config.js`, `app/globals.css` เตรียมไว้แล้ว (ไม่ต้องตั้งค่าเพิ่ม)

### Step 3 — ตั้งค่า Supabase
1. สร้างโปรเจกต์ที่ https://supabase.com → New project
2. เปิด **SQL Editor → New query** วางเนื้อหาไฟล์ [`supabase/schema.sql`](supabase/schema.sql) แล้วกด **Run**
   - จะได้ตาราง `admins`, `bank_accounts`, `transactions`, RPC, เปิด Realtime, สร้าง bucket `slips` และ seed แอดมินตัวอย่าง
3. แก้ `telegram_user_id` ของแอดมินให้เป็น ID จริง (ทัก **@userinfobot** ใน Telegram เพื่อดู ID ของคุณ)
   ```sql
   update admins set telegram_user_id = 123456789 where name = 'ADMIN A';
   ```

### Step 4 — ENV ของ Next.js
คัดลอก `.env.local.example` เป็น `.env.local` แล้วกรอกค่าจาก **Supabase → Project Settings → API**
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
API_SECRET=...
TELEGRAM_WEBHOOK_SECRET=...
ADMIN_TELEGRAM_IDS=123456789
```

### Step 5 — ไฟล์โค้ด
วางไว้ครบแล้วในโฟลเดอร์นี้ (types, lib, components, pages, API) ไม่ต้องทำอะไรเพิ่ม

### Step 6 — ติดตั้ง & รัน Dashboard
```bash
npm install
npm run dev
```
เปิด http://localhost:3000 → เด้งไป `/dashboard`

### Step 7 — สร้าง Telegram Bot
1. ทัก **@BotFather** → `/newbot` → ตั้งชื่อ → รับ **BOT_TOKEN** → ใส่ใน `.env.local` (`BOT_TOKEN=...`)
2. เพิ่มบอทเข้ากลุ่ม และปิด Privacy Mode ให้บอทเห็นทุกข้อความในกลุ่ม:
   `/setprivacy` → เลือกบอท → **Disable**

> **สถาปัตยกรรม v2:** บอทรันเป็น **Webhook ในตัว Next.js** (`app/api/telegram/webhook`) = ออนไลน์ 24/7 บน Netlify
> ไม่มีโปรเซสแยก · ใช้ได้เฉพาะ admin ที่มีใน Supabase หรืออยู่ใน `ADMIN_TELEGRAM_IDS`

### Step 8 — รันในเครื่อง (dev)
Webhook ต้องมี public URL — ตอน dev ใช้ **dev bridge** (long-poll แล้ว forward เข้า webhook local) ได้เลย ไม่ต้องมี ngrok:
```bash
npm run dev                 # terminal 1 — Next.js (webhook อยู่ในนี้)

cd bot && npm install
npm run dev                 # terminal 2 — dev bridge (เห็น "🌉 CE VAULT dev bridge")
```

### Step 9 — Deploy ขึ้น Netlify (โปรดักชัน 24/7)
```bash
npm i -g netlify-cli
netlify login
netlify init                # หรือ netlify link ถ้ามี site อยู่แล้ว
netlify env:set NEXT_PUBLIC_SUPABASE_URL "..."
netlify env:set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY "..."
netlify env:set SUPABASE_SECRET_KEY "..." --secret
netlify env:set API_SECRET "..." --secret
netlify env:set BOT_TOKEN "..." --secret
netlify env:set TELEGRAM_WEBHOOK_SECRET "..." --secret
netlify env:set ADMIN_TELEGRAM_IDS "123456789"
netlify env:set APP_URL "https://<site>.netlify.app"
# push ไป production branch หรือ:
netlify deploy --prod
```
ตั้งค่า build ใน `netlify.toml` แล้ว (Next.js Runtime ติดตั้งอัตโนมัติ) · cron ปิดวัน = `netlify/functions/day-cut-cron.ts` (22:00 เวลาไทย)

### Step 10 — เปิด webhook (ครั้งเดียว)
เรียกด้วย POST โดยส่ง secret ใน header (ไม่ใส่ secret ใน URL):
```
curl -X POST https://<site>.netlify.app/api/telegram/set-webhook \
  -H "x-api-key: <API_SECRET>"
```
เห็น `{ "telegram": { "ok": true } }` = บอทออนไลน์ตลอดแล้ว ✅ (ปิด dev bridge ได้)

---

## ทดสอบการทำงาน
0. รัน `npm run validate:env` เพื่อตรวจ ENV จริงก่อน deploy
1. เพิ่ม Telegram ID ใน `ADMIN_TELEGRAM_IDS` แล้วทัก `/start`
2. ตั้งบัญชีรับด้วย `/pin KBANK 1234567890`
3. ส่งรูปสลิป → ตรวจ OCR/Confidence/บัญชี → ใช้ `/save_slip` หรือ `/save_slip +500B`
4. ส่งภาพ USDT → ตรวจยอด → ยืนยันด้วย `-13.6U`
5. เปิด `/dashboard` เห็นรายการเด้งขึ้นแบบ Realtime

---

## 🤖 คำสั่งบอท & ฟีเจอร์
| คำสั่ง / การกระทำ | ผล |
|---|---|
| `/start`, `/help` | เมนู CE Vault สำหรับ admin ที่ได้รับสิทธิ์ |
| `/pin` / `/unpin` | ตั้ง/ยกเลิกบัญชีรับของห้องสำหรับวันนี้ |
| `/save_slip` | ยืนยันและบันทึก THB slip (admin เท่านั้น) |
| `/recent_slips 10` | ดูรายการล่าสุดพร้อม Ledger Reference |
| ส่งรูป USDT → `-13.6U` | ยืนยันยอด USDT OUT |
| `/rate` | ดูเรตปัจจุบัน (เรตตลาด = Binance TH real-time) |
| `/rate 35.5` | ตั้ง**เรตขายของเรา** (เรตตลาดอิง Binance TH อัตโนมัติ) |
| `/rate 35.5 34.8` | ตั้งเรตขาย + เรตตลาดเอง (override) |

**เรตตลาดจริง (market rate):** ดึงสดจาก **Binance TH** `GET https://api.binance.th/api/v1/ticker/price?symbol=USDTTHB` (public, cache 30 วิ) — ใช้คำนวณ Expected USDT / ค่าธรรมเนียม และโชว์บนแดชบอร์ด (`/api/market-rate`, อัปเดตทุก 30 วิ). ถ้า Binance TH ล่ม → fallback เรตในตาราง `rates` → ค่า ENV

**OCR อ่านยอดสลิป:** หาก Confidence ต่ำกว่า 90% หรืออ่านไม่ได้ ระบบจะไม่บันทึกอัตโนมัติ ให้ admin ตรวจแล้วใช้ `/save_slip +500B`

**แดชบอร์ด:** การ์ดสรุปกำไรรวม · Average Fee % · เรตปัจจุบัน · จำนวนธุรกรรม + รายการเหรียญตกค้างต่อแอดมิน (Realtime)

---

## 🔒 ป้องกัน API ด้วย Secret Key
API route ที่เขียนข้อมูล (`thb-deposit`, `usdt-send`) ตรวจ header `x-api-key` แล้ว

1. สร้างกุญแจ: `openssl rand -hex 32`
2. ใส่ค่าเดียวกันทั้ง 2 ที่:
   - `.env.local` (Next.js) → `API_SECRET=...`
   - `bot/.env` (บอท) → `API_SECRET=...`  ← บอทจะแนบ header ให้อัตโนมัติ
3. ตอน deploy Netlify: `netlify env:set API_SECRET "..." --secret`
> หากไม่ตั้ง `API_SECRET` route เขียนข้อมูลจะตอบ 503; local dev ต้องเปิด `ALLOW_INSECURE_DEV_API=1` อย่างชัดเจน

## Database migration ที่จำเป็น

สำรองฐานข้อมูลก่อน แล้วรัน `supabase/patch-v10-production-safety.sql` บน staging/production ก่อนเปิด webhook

## 🧪 ทดสอบ API โดยไม่ต้องเปิด Telegram
```bash
cd bot
npm run test:api      # ยิง health + thb-deposit + usdt-send แล้วพิมพ์ผลลัพธ์
```
> ตั้ง `TEST_TELEGRAM_ID` ใน `bot/.env` ให้ตรงกับแอดมินในตาราง `admins`

## ⚡ Deploy เร็วสุด (ได้ลิงก์จริง)
**A) เปิด localhost เป็นลิงก์สาธารณะทันที** (เทสบอทจริงใน ~30 วิ)
```bash
npm run dev                 # terminal 1
npx ngrok http 3000         # terminal 2 -> ได้ https://xxxx.ngrok-free.app
```
เอา URL ใส่ `API_BASE_URL` + `DASHBOARD_URL` ใน `bot/.env`

**B) ขึ้น Netlify ถาวร**
```bash
npm i -g netlify-cli
netlify login
netlify init
netlify env:set NEXT_PUBLIC_SUPABASE_URL "..."
netlify env:set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY "..."
netlify env:set SUPABASE_SECRET_KEY "..." --secret
netlify env:set API_SECRET "..." --secret
netlify deploy --prod
```
API จะอยู่ที่ `https://<site>.netlify.app/api/transactions/thb-deposit`

---

## หมายเหตุด้านความปลอดภัย
- `SUPABASE_SECRET_KEY` และ `API_SECRET` ใช้เฉพาะฝั่ง server — ห้ามใช้ชื่อ `NEXT_PUBLIC_*`
- Dashboard ใช้ publishable/anon key สำหรับข้อมูล realtime ตาม RLS เดิมของโปรเจกต์
