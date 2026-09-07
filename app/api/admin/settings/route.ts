import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { invalidateBotGateCache, saveTyphoonSetting } from '@/lib/systemSettings';

export const runtime = 'nodejs';
export const revalidate = 0;

const EDITABLE_KEYS = new Set([
  'bot_enabled',
  'maintenance_message',
  'api_endpoints',
  'response_templates',
  'error_thresholds',
  'rate_limits',
  'typhoon_api_key',
]);

const SECRET_KEYS = new Set(['typhoon_api_key']);

function asSecretPresent(v: unknown): boolean {
  if (typeof v === 'string') return v.trim().length >= 12;
  if (v && typeof v === 'object' && 'key' in (v as object)) {
    return asSecretPresent((v as { key: unknown }).key);
  }
  return false;
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('system_settings')
    .select('key, value, updated_at');

  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 }
    );
  }

  const settings: Record<string, any> = {};
  const secrets: Record<string, boolean> = {};
  for (const row of data ?? []) {
    if (SECRET_KEYS.has(row.key)) {
      secrets[row.key] = asSecretPresent(row.value);
      continue;
    }
    settings[row.key] = row.value;
  }

  return NextResponse.json({
    data: {
      botEnabled: settings.bot_enabled !== false,
      maintenanceMessage: settings.maintenance_message ?? '',
      apiEndpoints: settings.api_endpoints ?? null,
      responseTemplates: settings.response_templates ?? null,
      errorThresholds: settings.error_thresholds ?? null,
      rateLimits: settings.rate_limits ?? null,
      typhoonReady: Boolean(process.env.TYPHOON_API_KEY?.trim()) || Boolean(secrets.typhoon_api_key),
      updatedAt: (data ?? []).reduce<string | null>(
        (latest, r) => (!latest || r.updated_at > latest ? r.updated_at : latest),
        null
      ),
    },
    error: null,
  });
}

export async function PATCH(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_BODY', message: 'invalid json' } },
      { status: 400 }
    );
  }

  const key = String(body?.key ?? '');
  if (!EDITABLE_KEYS.has(key)) {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_KEY', message: `key must be one of ${[...EDITABLE_KEYS].join(', ')}` } },
      { status: 400 }
    );
  }

  if (key === 'typhoon_api_key') {
    try {
      await saveTyphoonSetting(String(body.value ?? ''));
    } catch {
      return NextResponse.json(
        { data: null, error: { code: 'INVALID_KEY', message: 'typhoon key required' } },
        { status: 400 }
      );
    }
    invalidateBotGateCache();
    return NextResponse.json({ data: { key, ready: true }, error: null });
  }

  const { error } = await supabaseAdmin
    .from('system_settings')
    .upsert(
      { key, value: body.value, updated_at: new Date().toISOString(), updated_by: 'dashboard' },
      { onConflict: 'key' }
    );

  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 }
    );
  }

  invalidateBotGateCache();
  return NextResponse.json({ data: { key, value: body.value }, error: null });
}