// Supabase client ฝั่ง server (ใช้ service_role key) — ใช้ใน API route เท่านั้น
// service_role bypass RLS จึงเขียน/อัปเดตตารางได้ ห้าม import ไฟล์นี้ใน client component
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdminKey, getSupabaseUrl } from './runtimeEnv';

const supabaseUrl = getSupabaseUrl() || 'http://localhost';
const serviceRoleKey = getSupabaseAdminKey() || 'build-time-placeholder';

// เตือนชัดๆ ใน log ถ้า runtime จริงยังไม่ได้ตั้งคีย์ (จะได้ไม่ debug เงียบๆ เป็นวัน)
if (serviceRoleKey === 'build-time-placeholder' && process.env.NODE_ENV === 'production') {
  console.error(
    '[supabaseAdmin] ⚠️ ไม่พบ service role key — ตั้ง SUPABASE_SERVICE_ROLE_KEY ใน ENV ' +
      'หรือ SUPABASE_SECRET_KEY ใน ENV (การอ่าน/เขียน DB ทั้งหมดจะล้มเหลว)',
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
