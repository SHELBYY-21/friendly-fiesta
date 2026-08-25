// POST /api/auth/logout — ล้าง session cookie
import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/dashboardAuth';

export const runtime = 'nodejs';
export const revalidate = 0;

export async function POST() {
  const res = NextResponse?.json({ ok: true });
  res?.cookies?.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
