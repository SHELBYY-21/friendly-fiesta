# CE VAULT — Database Template & Architecture Guide

เอกสารโครงสร้างและคู่มือจัดการฐานข้อมูลของระบบ **CE VAULT** (Telegram Bot + Next.js Dashboard)

---

## 1. ภาพรวมสถาปัตยกรรมฐานข้อมูล (Database Architecture)

ระบบรองรับการทำงานกับฐานข้อมูล PostgreSQL ทั้งแบบ **Netlify Database (Managed Postgres with Drizzle ORM)** และ **Supabase Postgres**:

1. **Netlify Database (Drizzle ORM)**:
   - สคีมาหลักกำหนดใน `db/schema.ts`
   - ไคลเอนต์พร้อมใช้งานใน `db/index.ts`
   - การคอนฟิก `drizzle.config.ts` ชี้ไปยัง `netlify/database/migrations`
   - รันสั่งสร้างไมเกรชันอัตโนมัติด้วย `npx drizzle-kit generate`

2. **Supabase / Standalone Postgres**:
   - Master SQL Template สมบูรณ์รวบยอดในไฟล์เดียวที่ [`supabase/schema.sql`](../supabase/schema.sql)
   - ประกอบด้วยตารางทั้งหมด 13 ตาราง, ดรรชนี (Indexes), ฟังก์ชัน RPC Atomic, Triggers, RLS, Realtime Publications และ Seed Data

---

## 2. รายชื่อตารางทั้งหมด (13 Tables)

| # | ชื่อตาราง | คำอธิบาย |
|---|---|---|
| 1 | `admins` | รายชื่อแอดมินระบบ, Telegram User ID, ยอด Holding USDT และสิทธิ์ (Role) |
| 2 | `bank_accounts` | บัญชีรับเงินบาท (THB) และยอดคงเหลือปัจจุบัน |
| 3 | `pinned_bank_accounts` | บัญชีรับเงินที่ถูกปักหมุดประจำวันสำหรับแต่ละแชท (จำกัดไม่เกิน 3 บัญชี/วัน) |
| 4 | `receivers` | ข้อมูลผู้รับโอนเงินปลายทาง/ลูกค้า |
| 5 | `transactions` | รายการธุรกรรมแลกเปลี่ยนทั้งหมด (`THB_DEPOSIT` และ `USDT_SEND`) พร้อมคำนวณกำไรสุทธิ และค่าธรรมเนียม |
| 6 | `transaction_status_logs` | ประวัติการเปลี่ยนสถานะของแต่ละรายการธุรกรรม |
| 7 | `rates` | บันทึกประวัติการตั้งเรตขายและเรตตลาด |
| 8 | `bot_sessions` | สถานะบทสนทนาและข้อมูลชั่วคราวขณะทำรายการผ่าน Telegram Bot |
| 9 | `chat_settings` | การตั้งค่าเฉพาะห้องแชท (ชื่อห้อง, เรตขาย, เวลาตัดรอบวัน) |
| 10 | `telegram_updates` | ป้องกันการประมวลผล Telegram Update ซ้ำ (Idempotency) |
| 11 | `system_settings` | การตั้งค่าส่วนกลางระบบ (เช่น สวิตช์ปิด/เปิดบอท, ข้อความปรับปรุง) |
| 12 | `dashboard_login_attempts` | บันทึกประวัติการใส่ PIN สู่แดชบอร์ดล้มเหลว (ป้องกัน Brute Force) |
| 13 | `bot_metrics` | บันทึกสถานะการทำงานและ Metric ประสิทธิภาพบอทแบบ Realtime |

---

## 3. ฟังก์ชัน RPC & Atomic Operations

- `increment_bank_balance(p_bank_id, p_amount)`: ปรับยอดเงินคงเหลือในบัญชีธนาคารแบบ Atomic
- `adjust_admin_holding(p_admin_id, p_amount)`: ปรับยอด Holding USDT ของแอดมินแบบ Atomic
- `enforce_ce_vault_pin_limit()`: Trigger ป้องกันการปักหมุดบัญชีเกิน 3 บัญชีต่อวัน
- `claim_telegram_update(p_update_id)`: จอง update_id เพื่อกันการประมวลผลซ้ำ
- `ce_vault_record_incoming(...)`: บันทึกรายการฝาก THB และอัปเดตยอดบัญชี
- `ce_vault_record_outgoing(...)`: บันทึกรายการส่ง USDT
- `ce_vault_update_ledger_transaction(...)`: แก้ไขรายการ Ledger พร้อมปรับยอดเงิน
- `ce_vault_delete_ledger_transaction(...)`: ลบรายการ Ledger พร้อมปรับยอดคืน
- `register_failed_login(p_ip, p_max_attempts, p_lock_minutes)`: นับจำนวนครั้งเข้าใช้งานล้มเหลวและล็อก IP
- `clear_login_attempts(p_ip)`: เคลียร์ตัวนับเมื่อล็อกอินสำเร็จ

---

## 4. วิธีการเริ่มใช้งานและการสร้างไมเกรชัน

### สำหรับ Netlify Database (Drizzle ORM)
1. เมื่อแก้ไขสคีมาใน `db/schema.ts`
2. สร้างไฟล์ไมเกรชันใหม่:
   ```bash
   npx drizzle-kit generate --name <descriptive_name>
   ```
3. ไมเกรชันจะถูกเก็บไว้ที่ `netlify/database/migrations/` และปรับใช้อัตโนมัติเมื่อ deploy

### สำหรับ Supabase / External Postgres
นำเนื้อหาจาก [`supabase/schema.sql`](../supabase/schema.sql) ไปวางใน **SQL Editor** แล้วกด **Run** ได้ในครั้งเดียว
