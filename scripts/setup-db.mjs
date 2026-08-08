// เตรียมส่วนที่ไม่ต้องใช้ DDL: storage bucket + seed admin/bank — รัน: node scripts/setup-db.mjs
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// 1) storage bucket 'slips' (public)
{
  const { error } = await sb.storage.createBucket('slips', { public: true });
  console.log('bucket slips:', error ? error.message : 'created ✓');
}

// 2) bootstrap admins จาก ENV เท่านั้น — ห้าม hardcode สิทธิ์
const adminIds = String(env.ADMIN_TELEGRAM_IDS || '')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isSafeInteger(value) && value > 0);
for (const telegramUserId of adminIds) {
  const { error } = await sb.from('admins').upsert(
    { telegram_user_id: telegramUserId, name: `Admin ${telegramUserId}` },
    { onConflict: 'telegram_user_id', ignoreDuplicates: true },
  );
  console.log('admin', telegramUserId, error ? error.message : 'ready ✓');
}
if (adminIds.length === 0) console.log('admins: skipped (ADMIN_TELEGRAM_IDS is empty)');

// 3) บัญชีธนาคารเริ่มต้น (ถ้ายังไม่มี)
{
  const { data } = await sb.from('bank_accounts').select('id').limit(1);
  if (!data || data.length === 0) {
    const { error } = await sb.from('bank_accounts').insert({ label: 'กสิกร - หลัก', bank_name: 'KBANK' });
    console.log('bank account:', error ? error.message : 'inserted ✓');
  } else {
    console.log('bank account: exists ✓');
  }
}
