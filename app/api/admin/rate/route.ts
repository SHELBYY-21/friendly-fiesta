// POST /api/admin/rate — ตั้งเรทขาย/เรทตลาดใหม่ (insert แถวใหม่ใน rates)
// GET — อ่านเรทล่าสุด
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { fetchMktRate } from '@/lib/mkt';
import { requireDashboardSession } from '@/lib/dashboardAuth';

export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('rates')
    .select('sell_rate, market_usdt_rate, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: data
      ? {
          sellRate: Number(data.sell_rate),
          marketRate: Number(data.market_usdt_rate),
          createdAt: data.created_at,
        }
      : null,
    error: null,
  });
}

export async function POST(req: NextRequest) {
  const denied = await requireDashboardSession(req);
  if (denied) return denied;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_BODY', message: 'invalid json' } },
      { status: 400 }
    );
  }

  const sellRate = Number(body?.sellRate);
  let marketRate = Number(body?.marketRate);
  if (!Number.isFinite(marketRate) || marketRate <= 0) {
    marketRate = Number(await fetchMktRate());
  }

  if (!Number.isFinite(sellRate) || sellRate < 20 || sellRate > 80) {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_RATE', message: 'sellRate ต้องเป็น 20–80' } },
      { status: 400 }
    );
  }
  if (!Number.isFinite(marketRate) || marketRate <= 0 || marketRate > 1000) {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_RATE', message: 'ดึงเรทตลาดไม่ได้' } },
      { status: 503 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('rates')
    .insert({ sell_rate: sellRate, market_usdt_rate: marketRate })
    .select('sell_rate, market_usdt_rate, created_at')
    .single();

  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: {
      sellRate: Number(data.sell_rate),
      marketRate: Number(data.market_usdt_rate),
      createdAt: data.created_at,
    },
    error: null,
  });
}
