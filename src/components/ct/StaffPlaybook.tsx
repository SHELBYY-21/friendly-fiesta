'use client';

import { useState } from 'react';

const STEPS = [
  { n: '1', title: 'เปิดกะ', body: 'ใส่รหัส 6 หลัก · ปักบัญชีรับเงินวันนี้ก่อนรับสลิป' },
  { n: '2', title: 'รับสลิป', body: 'ส่งรูปในห้อง Telegram · รายการขึ้นแถบคิวสถานะ อยู่ในคิว' },
  { n: '3', title: 'ตรวจ', body: 'กดแถวดูรูป · บัญชีต้องตรงปักหมุด · ยอด ≥ 20,000 ต้องยืนยัน' },
  { n: '4', title: 'โอนแล้วค่อยกด', body: 'TRC20 โอนมือก่อน · Sol USDC ใส่ที่อยู่ลูกค้าแล้วกดบันทึกส่งรวม · ไม่ใช้กับรายการพัก' },
];

const CHIPS = [
  { tag: 'คิว', meaning: 'รอโอน USDT' },
  { tag: 'พัก', meaning: 'จอดไว้ · กดดึงเข้าคิวถ้าจะโอน' },
  { tag: 'เสร็จ', meaning: 'บันทึกเรียบร้อย' },
  { tag: 'ผิด', meaning: 'อ่านไม่ได้ · ไม่กดส่ง' },
];

export default function StaffPlaybook() {
  const [open, setOpen] = useState(false);
  return (
    <aside className="mx-4 mt-3 rounded-lg border border-[var(--line)] bg-black/30 px-3 py-2 text-sm">
      <button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setOpen((v) => !v)}>
        <span className="font-medium text-gold">โหมดการทำงาน: พนักงาน</span>
        <span className="text-xs font-medium text-[color:var(--fg-muted)]">{open ? 'ปิด' : 'เปิดดู'}</span>
      </button>
      {open && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <ol className="space-y-2">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-2">
                <span className="font-mono text-gold">{s.n}</span>
                <span><b>{s.title}</b> — {s.body}</span>
              </li>
            ))}
          </ol>
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-[color:var(--fg)]">ความหมายสี</p>
            <ul className="space-y-1">
              {CHIPS.map((c) => (
                <li key={c.tag}><b>{c.tag}</b> — {c.meaning}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-[color:var(--fg-muted)]">เริ่มใหม่ = พักคิวเดิม · ไม่ลบประวัติ · ไม่โอน USDT ให้</p>
          </div>
        </div>
      )}
    </aside>
  );
}
