// ============================================================
// ป้องกัน /dashboard และ /api/admin/* ด้วย session cookie จาก PIN gate
// - ไม่มี session → redirect ไปหน้า landing (/) หรือ 401 สำหรับ API
// - /api/telegram/* ไม่ผ่านตรงนี้ (บอทมี secret ของตัวเอง)
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/dashboardAuth';

export const config = {
  matcher: ['/dashboard/:path*', '/api/admin/:path*'],
};

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const isValid = await verifySessionToken(token);
  if (isValid) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = '/';
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}
