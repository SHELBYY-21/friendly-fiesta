import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken, isAuthConfigured } from '@/lib/dashboardAuth';

export const config = {
  matcher: ['/dashboard/:path*', '/api/dashboard/:path*', '/api/admin/:path*'],
};

export async function middleware(req: NextRequest) {
  if (!isAuthConfigured()) return NextResponse.next();

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
