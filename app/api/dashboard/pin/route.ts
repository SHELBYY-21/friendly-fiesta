import { NextRequest, NextResponse } from 'next/server';
import { requireDashboardSession } from '@/lib/dashboardAuth';
import { pinBankAccount, ensureTodayPins } from '@/lib/banks';
import { rematchOpenSlips } from '@/lib/ct/queue';
import { opsChatId } from '@/lib/ct/deskChat';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = await requireDashboardSession(req);
  if (denied) return denied;
  let body: { chatId?: number; bankAccountId?: string; bank?: string; account?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const chatId = await opsChatId(body.chatId ?? null);
  if (chatId == null) {
    return NextResponse.json({ ok: false, error: 'NO_CHAT' }, { status: 400 });
  }

  try {
    if (body.bankAccountId) {
      const { data: acc, error } = await supabaseAdmin
        .from('bank_accounts')
        .select('id, bank_name, account_number, label')
        .eq('id', body.bankAccountId)
        .maybeSingle();
      if (error || !acc) {
        return NextResponse.json({ ok: false, error: 'ACCOUNT_NOT_FOUND' }, { status: 404 });
      }
      await pinBankAccount(chatId, acc.bank_name, String(acc.account_number || ''), acc.label);
    } else if (body.bank && body.account) {
      await pinBankAccount(chatId, body.bank, body.account);
    } else {
      await ensureTodayPins(chatId);
    }
    const rematch = await rematchOpenSlips(chatId);
    const pins = await ensureTodayPins(chatId);
    return NextResponse.json({
      ok: true,
      chatId,
      pins: pins.map((p) => ({
        id: p.id,
        bank: p.bank_name,
        last4: String(p.account_number || '').replace(/\D/g, '').slice(-4),
        label: p.label,
      })),
      rematch: rematch.matched,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'pin_failed' }, { status: 400 });
  }
}
