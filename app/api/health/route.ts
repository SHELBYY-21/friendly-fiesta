import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const app = (process.env.APP_URL || '').replace(/\/$/, '');
  return NextResponse.json({
    ok: true,
    service: 'ce-vault',
    app: app || null,
    pinGate: Boolean(process.env.DASHBOARD_PIN),
    opsChat: Boolean(process.env.OPS_CHAT_ID || process.env.NOTIFY_CHAT_ID),
  });
}
