// GET /api/monitor/ping?url={target} — ตรวจสถานะ URL ภายนอกจากฝั่ง server
// ป้องกัน CORS/SSRF ด้วย allowlist ของ host ที่รู้จัก
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 0;

const ALLOWED_HOSTS = [
  'api.telegram.org',
  'api.binance.com',
  'api.binance.th',
  'api.circle.com',
  'api-sandbox.circle.com',
  'supabase.co',
  'vercel.app',
];

function isAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return ALLOWED_HOSTS.some((host) => u.hostname === host || u.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json(
      { status: 'error', message: 'url parameter required' },
      { status: 400 }
    );
  }

  if (!isAllowed(url)) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'URL not in allowlist',
        allowedHosts: ALLOWED_HOSTS,
      },
      { status: 403 }
    );
  }

  const startedAt = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'follow',
    });
    clearTimeout(timeout);

    const latencyMs = Date.now() - startedAt;
    let body: any = null;
    try {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('json')) body = await res.json();
      else body = (await res.text()).slice(0, 200);
    } catch {
      /* Ignore body parse errors */
    }

    return NextResponse.json({
      status: res.ok ? 'ok' : 'error',
      httpStatus: res.status,
      latencyMs,
      url,
      body,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startedAt;
    return NextResponse.json(
      {
        status: 'error',
        latencyMs,
        message: err?.name === 'AbortError' ? 'Timeout (>8s)' : err?.message ?? 'Fetch failed',
      },
      { status: 502 }
    );
  }
}
