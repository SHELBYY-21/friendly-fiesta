// GET /api/health — เช็คว่า API ออนไลน์ + ต่อ Supabase ได้
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { validateProductionEnvironment } from '@/lib/runtimeEnv';

export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET() {
  const startedAt = Date.now();
  const configuration = validateProductionEnvironment();
  let db: 'ok' | 'error' | 'skipped' = configuration.length === 0 ? 'ok' : 'skipped';
  let detail: string | undefined;

  if (configuration.length === 0) {
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
  }

  const latency = Date.now() - startedAt;
  const isHealthy = configuration.length === 0 && db === 'ok' && latency < 5000;

  return NextResponse.json(
    {
      status: isHealthy ? 'ok' : 'degraded',
      service: 'ce-vault-bot-api',
      db,
      detail,
      configuration: configuration.map((issue) => `${issue.key}:${issue.code}`),
      latencyMs: latency,
      version: '2.1-optimized',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
    },
    { status: isHealthy ? 200 : 503 }
  );
}
