import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { validateProductionEnvironment, validateWebhookEnvironment } from '@/lib/runtimeEnv';
import { configuredSlipProvider } from '@/lib/ct/slipInquiry';

export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET() {
  const startedAt = Date.now();
  const fatal = validateWebhookEnvironment();
  const extra = validateProductionEnvironment().filter(
    (issue) => !fatal.some((f) => f.key === issue.key && f.code === issue.code),
  );

  let db: 'ok' | 'error' = 'ok';
  let detail: string | undefined;
  try {
    const { error } = await supabaseAdmin.from('admins').select('id').limit(1);
    if (error) {
      db = 'error';
      detail = error.message;
    }
  } catch (e: any) {
    db = 'error';
    detail = e?.message;
  }

  const latency = Date.now() - startedAt;
  const isUp = fatal.length === 0 && db === 'ok' && latency < 5000;
  const vision = Boolean(
    process.env.GROK_API_KEY?.trim() || process.env.XAI_API_KEY?.trim(),
  );
  const ocrFallback = Boolean(process.env.OCR_SPACE_API_KEY?.trim());
  const slipVerify = configuredSlipProvider()?.name ?? false;

  return NextResponse.json(
    {
      status: !isUp ? 'down' : extra.length ? 'degraded' : 'ok',
      service: 'ce-vault-bot-api',
      db,
      detail,
      vision,
      ocrFallback,
      slipVerify,
      pinGate: Boolean(process.env.DASHBOARD_PIN),
      opsChat: Boolean(process.env.OPS_CHAT_ID || process.env.NOTIFY_CHAT_ID),
      app: (process.env.APP_URL || '').replace(/\/$/, '') || null,
      configuration: [...fatal, ...extra].map((issue) => `${issue.key}:${issue.code}`),
      latencyMs: latency,
      version: '2.1-optimized',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
    },
    { status: isUp ? 200 : 503 },
  );
}
