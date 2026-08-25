import { NextRequest, NextResponse } from 'next/server';
import { loadVault } from '@/lib/ct/vault';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { opsRates } from '@/lib/ct/rates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const chatParam = req.nextUrl.searchParams.get('chatId');
  const chatId = chatParam ? Number(chatParam) : null;
  const mode = (req.nextUrl.searchParams.get('mode') as 'today' | 'pending' | 'all') || 'today';

  try {
    const [vault, pins, pending, rates] = await Promise.all([
      loadVault(Number.isFinite(chatId) ? chatId : null, mode),
      supabaseAdmin
        .from('pinned_bank_accounts')
        .select('chat_id, pinned_for_date, bank_accounts(bank_name, account_number, label)')
        .eq('pinned_for_date', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })),
      supabaseAdmin
        .from('pending_slips')
        .select('short_ref, ledger_ref, status, thb_in, should_send, bank, name, created_at')
        .in('status', ['IN_READY', 'IN_READY_REVIEW', 'LOCKED', 'HOLD', 'OCR_WEAK', 'PIN_MISMATCH'])
        .order('created_at', { ascending: false })
        .limit(20),
      opsRates(0),
    ]);

    const pinsOut = (pins.data ?? []).map((p: any) => ({
      chatId: p.chat_id,
      date: p.pinned_for_date,
      bank: p.bank_accounts?.bank_name ?? '—',
      last4: String(p.bank_accounts?.account_number ?? '').replace(/\D/g, '').slice(-4),
      label: p.bank_accounts?.label ?? null,
    }));

    const accounts = pinsOut.map((p) => {
      const rows = (vault.tape ?? []).filter(
        (t: any) => t.bank === p.bank && String(t.last4 ?? '') === p.last4,
      );
      return {
        ...p,
        count: rows.length,
        totalThb: rows.reduce((s: number, r: any) => s + Number(r.thb || 0), 0),
        totalUsdt: rows.reduce((s: number, r: any) => s + Number(r.usdt || 0), 0),
      };
    });

    return NextResponse.json({
      ok: true,
      vault,
      rates,
      pins: pinsOut,
      accounts,
      queue: pending.data ?? [],
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'vault_failed' }, { status: 500 });
  }
}
