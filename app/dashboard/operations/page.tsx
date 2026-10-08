import Overview from '@/components/ops/Overview';
import { buildOpsOverview } from '@/lib/ops/overview';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export default async function OperationsPage() {
  const limit = 1000;
  const [transactions, pendingSlips, rates, bankAccounts] = await Promise.all([
    supabaseAdmin.from('transactions').select('ledger_ref,type,status,thb_amount,expected_usdt,usdt_amount,created_at').order('created_at', { ascending: false }).limit(limit),
    supabaseAdmin.from('pending_slips').select('short_ref,ledger_ref,status,thb_in,should_send,bank,account_masked,created_at').order('created_at', { ascending: false }).limit(25),
    supabaseAdmin.from('rates').select('sell_rate,market_usdt_rate,created_at').order('created_at', { ascending: false }).limit(1),
    supabaseAdmin.from('bank_accounts').select('label,bank_name,current_balance').order('created_at', { ascending: true }),
  ]);
  const errors = [transactions.error, pendingSlips.error, rates.error, bankAccounts.error].filter(Boolean);
  if (errors.length) {
    return <main className="mx-auto max-w-3xl p-8 text-white"><h1 className="text-2xl font-semibold">ภาพรวมปฏิบัติการ</h1><p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4">ข้อมูลบางส่วนยังไม่พร้อม กรุณาตรวจการเชื่อมต่อฐานข้อมูล</p></main>;
  }
  return <Overview data={buildOpsOverview({ transactions: transactions.data ?? [], pendingSlips: pendingSlips.data ?? [], rates: rates.data ?? [], bankAccounts: bankAccounts.data ?? [], now: new Date(), transactionLimit: limit })} />;
}
