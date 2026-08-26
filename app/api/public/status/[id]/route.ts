import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('id, status, usdt_amount')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'db' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({
    id: data.id,
    status: data.status,
    usdtAmount: Number(data.usdt_amount),
  });
}
