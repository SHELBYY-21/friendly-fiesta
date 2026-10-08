import BankLogo from '@/components/BankLogo';
import type { OpsOverview } from '@/lib/ops/overview';

export default function Overview({ data }: { data: OpsOverview }) {
  const cards = [
    ['รับเข้า', `${data.totals.thbIn} THB`],
    ['ส่งแล้ว', `${data.totals.sentUsdt} USDT`],
    ['คงค้าง', `${data.totals.pendingUsdt} USDT`],
    ['รายการ', String(data.totals.transactions)],
  ];
  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-6 p-4 text-white sm:p-8">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">CE Vault · Read only</p>
        <h1 className="mt-2 text-2xl font-semibold">ภาพรวมปฏิบัติการ</h1>
        <p className="mt-1 text-sm text-white/60">วันที่ธุรกิจ {data.businessDate} · อัปเดต {new Date(data.generatedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</p>
      </header>
      {!data.coverage.complete ? <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">{data.coverage.note}</div> : null}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => <article key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-white/50">{label}</p><p className="mt-2 font-mono text-xl">{value}</p></article>)}
      </section>
      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="font-semibold">บัญชีธนาคาร</h2>
          <div className="mt-3 space-y-2">{data.banks.length ? data.banks.map((bank, index) => <div key={`${bank.bankName}-${index}`} className="flex items-center justify-between border-b border-white/5 py-2"><span><BankLogo bank={bank.bankName} />{bank.label || bank.bankName || 'ไม่ระบุ'}</span><span className="font-mono">{bank.currentBalance} THB</span></div>) : <p className="text-sm text-white/50">ยังไม่มีข้อมูลบัญชี</p>}</div>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="font-semibold">สลิปรอตรวจ</h2>
          <div className="mt-3 space-y-2">{data.pendingSlips.length ? data.pendingSlips.map((slip, index) => <div key={`${slip.reference}-${index}`} className="border-b border-white/5 py-2 text-sm"><div><BankLogo bank={slip.bank} />{slip.bank || 'ไม่ระบุ'} · {slip.accountMasked || 'บัญชีไม่ระบุ'}</div><div className="mt-1 font-mono text-white/60">{slip.thbIn ?? '—'} THB · {slip.status}</div></div>) : <p className="text-sm text-white/50">ไม่มีสลิปรอตรวจ</p>}</div>
        </article>
      </section>
    </main>
  );
}
