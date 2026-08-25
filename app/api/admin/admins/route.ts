// GET/POST/DELETE /api/admin/admins — จัดการ admin users
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('admins')
    .select('id, name, telegram_user_id, holding_usdt, created_at')
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: (data ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      telegramUserId: String(a.telegram_user_id),
      holdingUsdt: Number(a.holding_usdt),
      createdAt: a.created_at,
    })),
    error: null,
  });
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_BODY', message: 'invalid json' } },
      { status: 400 }
    );
  }

  const name = String(body?.name ?? '').trim();
  const telegramUserId = Number(body?.telegramUserId);

  if (!name) {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_NAME', message: 'ต้องใส่ชื่อ' } },
      { status: 400 }
    );
  }
  if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0) {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_TELEGRAM_ID', message: 'Telegram user ID ต้องเป็นตัวเลขบวก' } },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('admins')
    .insert({ name, telegram_user_id: telegramUserId })
    .select('id, name, telegram_user_id, holding_usdt, created_at')
    .single();

  if (error) {
    const isDuplicate = error.code === '23505';
    return NextResponse.json(
      {
        data: null,
        error: {
          code: isDuplicate ? 'DUPLICATE' : 'DB_ERROR',
          message: isDuplicate ? 'Telegram user ID นี้มีอยู่แล้ว' : error.message,
        },
      },
      { status: isDuplicate ? 409 : 500 }
    );
  }

  return NextResponse.json({
    data: {
      id: data.id,
      name: data.name,
      telegramUserId: String(data.telegram_user_id),
      holdingUsdt: Number(data.holding_usdt),
      createdAt: data.created_at,
    },
    error: null,
  });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_QUERY', message: 'id required' } },
      { status: 400 }
    );
  }

  // กันลบ admin ที่มีธุรกรรมผูกอยู่ (FK จะ error อยู่แล้ว แต่ตอบข้อความให้เข้าใจง่าย)
  const { count } = await supabaseAdmin
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('admin_id', id);

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'HAS_TRANSACTIONS',
          message: `ลบไม่ได้ — admin นี้มีธุรกรรม ${count} รายการผูกอยู่`,
        },
      },
      { status: 409 }
    );
  }

  const { error } = await supabaseAdmin.from('admins').delete().eq('id', id);

  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: { id }, error: null });
}
