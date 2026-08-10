/**
 * supabaseServer.ts
 * Server-side Supabase client using @supabase/supabase-js
 * ใช้ใน API routes / Server Components เท่านั้น — ห้าม import ใน client components
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || '';
const supabaseJwksUrl =
  process.env.SUPABASE_JWKS_URL ||
  (supabaseUrl ? `${supabaseUrl}/auth/v1/.well-known/jwks.json` : '');

if (!supabaseUrl && process.env.NODE_ENV === 'production') {
  console.error('[supabaseServer] ⚠️ SUPABASE_URL ไม่ถูกตั้งค่า');
}

/**
 * Server client ที่ใช้ secret key (bypass RLS)
 * เหมาะสำหรับ admin operations และ server-side data fetching
 */
export function createServerClient() {
  return createClient({
    supabaseUrl,
    supabaseKey: supabaseSecretKey || supabasePublishableKey,
  });
}

/**
 * ตรวจสอบ JWT token จาก Authorization header
 * ใช้ JWKS URL สำหรับ verify signature
 */
export async function verifySupabaseToken(authHeader: string | null): Promise<{
  userId: string | null;
  error: string | null;
}> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { userId: null, error: 'Missing or invalid Authorization header' };
  }

  const token = authHeader.replace('Bearer ', '').trim();

  try {
    const { jwtVerify, createRemoteJWKSet } = await import('jose');
    const JWKS = createRemoteJWKSet(new URL(supabaseJwksUrl));
    const { payload } = await jwtVerify(token, JWKS);
    const userId = (payload.sub as string) || null;
    return { userId, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token verification failed';
    return { userId: null, error: message };
  }
}

export { supabaseUrl, supabasePublishableKey, supabaseJwksUrl };
