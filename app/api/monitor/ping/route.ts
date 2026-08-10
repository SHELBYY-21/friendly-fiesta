// GET /api/monitor/ping?url={target} — ตรวจสถานะ URL ภายนอกจากฝั่ง server
// ป้องกัน CORS/SSRF ด้วย allowlist ของ host ที่รู้จัก
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 0;

const ALLOWED_HOSTS = [
  // Telegram / Binance / Circle
  'api.telegram.org',
  'api.binance.com',
  'api.binance.th',
  'api.circle.com',
  'api-sandbox.circle.com',
  // Supabase & Vercel
  'supabase.co',
  'supabase.in',
  'vercel.app',
  'vercel.com',
  // AI providers
  'api.x.ai',
  'api.openai.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
  // OCR fallback
  'api.ocr.space',
  // General allowlist for HTTPS status checks (blocked to well-known DNS resolvers to keep SSRF surface small)
  'cloudflare.com',
  'google.com',
  'github.com',
  'githubusercontent.com',
];

// Block private/loopback/link-local hosts + cloud metadata endpoints
const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '169.254.169.254', // AWS/GCP/Azure metadata IP
  'metadata.google.internal',
]);

function isPrivateIp(hostname: string): boolean {
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!ipv4) return false;
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

function isAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = u.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(host) || isPrivateIp(host)) return false;
    return ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
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
