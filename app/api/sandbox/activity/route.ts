import { NextRequest, NextResponse } from 'next/server';
import { requireDashboardSession } from '@/lib/dashboardAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { buildSandboxActivity } from '@/lib/sandbox/activity';

export async function GET(req: NextRequest) {
  const denied = await requireDashboardSession(req); if (denied) return denied;
  if (process.env.CE_VAULT_SANDBOX !== 'true') return NextResponse.json({ disabled: true, activity: buildSandboxActivity([], []) });
  const limit = Math.max(1, Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 25) || 25, 100));
  const [jobs, events, outbox] = await Promise.all([
    supabaseAdmin.from('workflow_jobs').select('id,public_ref,state,summary,updated_at').order('updated_at', { ascending: false }).limit(limit),
    supabaseAdmin.from('job_events').select('event_id,job_id,event_type,payload,occurred_at').order('occurred_at', { ascending: false }).limit(limit),
    supabaseAdmin.from('outbox_messages').select('status,last_error_code').in('status', ['PENDING', 'FAILED']).limit(100),
  ]);
  const error = jobs.error ?? events.error ?? outbox.error;
  if (error) return NextResponse.json({ error: 'SANDBOX_SCHEMA_UNAVAILABLE' }, { status: 503 });
  return NextResponse.json({ activity: buildSandboxActivity(jobs.data ?? [], events.data ?? [], outbox.data ?? []) });
}
