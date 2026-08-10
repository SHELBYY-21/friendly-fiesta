import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('bot_metrics')
      .select('*')
      .eq('id', 'singleton')
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      error_rate,
      avg_response_ms,
      rate_limit_pct,
      uptime_seconds,
      total_requests,
      total_errors,
    } = body;

    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (error_rate        !== undefined) patch.error_rate        = error_rate;
    if (avg_response_ms   !== undefined) patch.avg_response_ms   = avg_response_ms;
    if (rate_limit_pct    !== undefined) patch.rate_limit_pct    = rate_limit_pct;
    if (uptime_seconds    !== undefined) patch.uptime_seconds    = uptime_seconds;
    if (total_requests    !== undefined) patch.total_requests    = total_requests;
    if (total_errors      !== undefined) patch.total_errors      = total_errors;

    const { data, error } = await supabaseAdmin
      .from('bot_metrics')
      .upsert({ id: 'singleton', ...patch }, { onConflict: 'id' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
