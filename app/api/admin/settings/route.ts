// GET/PATCH /api/admin/settings — อ่าน/แก้ system_settings (เช่น ปุ่มหยุดบอท)
// ป้องกันด้วย middleware (session cookie จาก PIN gate)
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { invalidateBotGateCache } from '@/lib/systemSettings';

export const runtime = 'nodejs';
export const revalidate = 0;

const EDITABLE_KEYS = new Set([
  'bot_enabled',
  'maintenance_message',
  'api_endpoints',
  'response_templates',
  'error_thresholds',
  'rate_limits',
]);

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
  for (const row of data ?? []) settings[row.key] = row.value;

  return NextResponse.json({
    data: {
      botEnabled: settings.bot_enabled !== false,
      maintenanceMessage: settings.maintenance_message ?? '',
      apiEndpoints: settings.api_endpoints ?? null,
      responseTemplates: settings.response_templates ?? null,
      errorThresholds: settings.error_thresholds ?? null,
      rateLimits: settings.rate_limits ?? null,
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
