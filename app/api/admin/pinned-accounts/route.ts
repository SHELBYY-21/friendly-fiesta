// GET/POST/DELETE /api/admin/pinned-accounts — จัดการบัญชีที่ pin ต่อกลุ่ม/วัน
// จำกัดสูงสุด 3 บัญชี/กลุ่ม/วัน (บังคับด้วย trigger ใน DB)
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const revalidate = 0;

function today(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get('chatId');
  const date = req.nextUrl.searchParams.get('date') || today();

  let query = supabaseAdmin
    .from('pinned_bank_accounts')
    .select('chat_id, bank_account_id, pinned_for_date, created_at, bank_accounts(label, bank_name, account_number)')
    .eq('pinned_for_date', date)
    .order('created_at', { ascending: true });

  if (chatId) query = query.eq('chat_id', Number(chatId));

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: (data ?? []).map((row: any) => ({
      chatId: String(row.chat_id),
      bankAccountId: row.bank_account_id,
      pinnedForDate: row.pinned_for_date,
      label: row.bank_accounts?.label ?? 'Unknown',
      bankName: row.bank_accounts?.bank_name ?? 'Unknown',
      last4: (row.bank_accounts?.account_number ?? '').slice(-4) || '----',
      createdAt: row.created_at,
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

  const chatId = Number(body?.chatId);
  const bankAccountId = String(body?.bankAccountId ?? '');
  const date = String(body?.date || today());

  if (!Number.isSafeInteger(chatId)) {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_CHAT_ID', message: 'chatId ต้องเป็นตัวเลข' } },
      { status: 400 }
    );
  }
  if (!bankAccountId) {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_ACCOUNT', message: 'ต้องเลือกบัญชี' } },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from('pinned_bank_accounts')
    .insert({ chat_id: chatId, bank_account_id: bankAccountId, pinned_for_date: date });

  if (error) {
    const isLimit = error.message.includes('PIN_LIMIT_REACHED');
    const isDuplicate = error.code === '23505';
    return NextResponse.json(
      {
        data: null,
        error: {
          code: isLimit ? 'PIN_LIMIT' : isDuplicate ? 'DUPLICATE' : 'DB_ERROR',
          message: isLimit
            ? 'pin ได้สูงสุด 3 บัญชีต่อกลุ่มต่อวัน'
            : isDuplicate
              ? 'บัญชีนี้ pin ไว้แล้ว'
              : error.message,
        },
      },
      { status: isLimit || isDuplicate ? 409 : 500 }
    );
  }

  return NextResponse.json({ data: { chatId: String(chatId), bankAccountId, date }, error: null });
}

export async function DELETE(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get('chatId');
  const bankAccountId = req.nextUrl.searchParams.get('bankAccountId');
  const date = req.nextUrl.searchParams.get('date') || today();

  if (!chatId || !bankAccountId) {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_QUERY', message: 'chatId และ bankAccountId required' } },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from('pinned_bank_accounts')
    .delete()
    .eq('chat_id', Number(chatId))
    .eq('bank_account_id', bankAccountId)
    .eq('pinned_for_date', date);

  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: { chatId, bankAccountId, date }, error: null });
}
