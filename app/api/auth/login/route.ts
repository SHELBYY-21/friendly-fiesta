// POST /api/auth/login — ตรวจ PIN 6 หลัก แล้วออก session cookie
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  MAX_ATTEMPTS,
  LOCK_MINUTES,
  createSessionToken,
  getClientIp,
  isAuthConfigured,
  verifyPin,
} from '@/lib/dashboardAuth';

export const runtime = 'nodejs';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'auth_not_configured', message: 'ยังไม่ได้ตั้ง DASHBOARD_PIN / DASHBOARD_SESSION_SECRET' },
      { status: 503 }
    );
  }

  const ip = getClientIp(req.headers);

  // เช็คว่า IP นี้ถูกล็อกอยู่ไหม
  const { data: attemptRow } = await supabaseAdmin
    .from('dashboard_login_attempts')
    .select('locked_until')
    .eq('ip', ip)
    .maybeSingle();

  if (attemptRow?.locked_until && new Date(attemptRow.locked_until) > new Date()) {
    const secondsLeft = Math.ceil((new Date(attemptRow.locked_until).getTime() - Date.now()) / 1000);
    return NextResponse.json(
      { ok: false, error: 'locked', lockedUntil: attemptRow.locked_until, secondsLeft },
      { status: 429 }
    );
  }

  let pin = '';
  try {
    const body = await req.json();
    pin = String(body?.pin ?? '');
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  if (!verifyPin(pin)) {
    const { data: lockedUntil } = await supabaseAdmin.rpc('register_failed_login', {
      p_ip: ip,
      p_max_attempts: MAX_ATTEMPTS,
      p_lock_minutes: LOCK_MINUTES,
    });

    if (lockedUntil && new Date(lockedUntil) > new Date()) {
      const secondsLeft = Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000);
      return NextResponse.json(
        { ok: false, error: 'locked', lockedUntil, secondsLeft },
        { status: 429 }
      );
    }

    return NextResponse.json({ ok: false, error: 'invalid_pin' }, { status: 401 });
  }

  await supabaseAdmin.rpc('clear_login_attempts', { p_ip: ip });

  const token = await createSessionToken();
  if (!token) {
    return NextResponse.json({ ok: false, error: 'auth_not_configured' }, { status: 503 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
