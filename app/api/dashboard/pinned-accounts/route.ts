import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const chatId = searchParams.get('chatId');
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

  if (!chatId) {
    return NextResponse.json(
      {
        data: null,
        error: { code: 'INVALID_QUERY', message: 'chatId required' },
      },
      { status: 400 }
    );
  }

  try {
    // Get pinned accounts for this chat/date
    const { data: pinnedRows, error: pinnedError } = await supabaseAdmin
      .from('pinned_bank_accounts')
      .select('*, bank_accounts(account_name, bank_name, account_last4)')
      .eq('chat_id', Number(chatId))
      .eq('pinned_for_date', date)
      .order('created_at', { ascending: false });

    if (pinnedError) throw pinnedError;

    if (!pinnedRows || pinnedRows.length === 0) {
      return NextResponse.json({
        data: [],
        error: null,
      });
    }

    // Enrich with transaction counts/totals
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const { data: allTransactions } = await supabaseAdmin
      .from('transactions')
      .select('bank_account_id, thb_amount, usdt_amount, type, created_at')
      .eq('type', 'THB_DEPOSIT')
      .gte('created_at', dayStart.toISOString())
      .lte('created_at', dayEnd.toISOString());

    const accounts = pinnedRows.map((row: any) => {
      const accTx = (allTransactions ?? []).filter((t) => t.bank_account_id === row.bank_account_id);
      const totalThb = accTx.reduce((s, t) => s + Number(t.thb_amount || 0), 0);
      const totalUsdt = accTx.reduce((s, t) => s + Number(t.usdt_amount || 0), 0);

      let status: 'active' | 'depleted' | 'inactive' = 'inactive';
      if (accTx.length > 0 && totalThb > 0) status = 'active';
      else if (totalThb > 0) status = 'depleted';

      return {
        id: row.id,
        bankAccountId: row.bank_account_id,
        accountName: row.bank_accounts?.account_name ?? 'Unknown',
        bankName: row.bank_accounts?.bank_name ?? 'Unknown',
        last4: row.bank_accounts?.account_last4 ?? '0000',
        pinnedForDate: row.pinned_for_date,
        transactionCount: accTx.length,
        totalThb,
        totalUsdt,
        status,
      };
    });

    return NextResponse.json({
      data: accounts,
      error: null,
    });
  } catch (err) {
    console.error('pinned-accounts error:', err);
    return NextResponse.json(
      {
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'Server error' },
      },
      { status: 500 }
    );
  }
}
