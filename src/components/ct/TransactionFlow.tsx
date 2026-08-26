type TapeRow = {
  id: string;
  ledger: string | null;
  short: string;
  thb: number | null;
  dueUsdt: number | null;
  sentUsdt: number | null;
  createdAt: string | null;
  dateStamp: string;
  time: string;
  pending: boolean;
  status: 'WAIT' | 'DONE';
  bank: string | null;
  last4: string | null;
  name?: string | null;
};

function dash(n: number | null | undefined, d = 0) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function Rail() {
  return (
    <div className="flex items-center gap-2 py-1 pl-1 text-faint" aria-hidden>
      <span>↓</span>
      <span className="h-px flex-1 bg-[var(--line)]" />
    </div>
  );
}

export function TransactionFlowCard({ row, flash }: { row: TapeRow; flash?: boolean }) {
  const done = row.status === 'DONE';
  return (
    <article className={`glass accent-top p-5 ${flash ? 'flash' : ''}`}>
      <p className="mb-3 font-mono text-xs text-gold">{row.short || '—'}</p>
      <div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-faint">TIME</p>
        <p className="font-mono text-sm">
          {row.dateStamp && row.time !== '—' ? `${row.dateStamp} • ${row.time}` : '—'}
        </p>
        <Rail />
        <p className="text-[10px] uppercase tracking-[0.14em] text-faint">IN</p>
        <p className="font-mono text-lg">{row.thb == null ? '—' : `${dash(row.thb)} THB`}</p>
        <Rail />
        <p className="text-[10px] uppercase tracking-[0.14em] text-faint">DUE</p>
        <p className="font-mono text-lg text-gold">{row.dueUsdt == null ? '—' : `${dash(row.dueUsdt, 2)} USDT`}</p>
        {done && (
          <>
            <Rail />
            <p className="text-[10px] uppercase tracking-[0.14em] text-faint">SENT</p>
            <p className="font-mono text-lg">{row.sentUsdt == null ? '—' : `${dash(row.sentUsdt, 2)} USDT`}</p>
          </>
        )}
        <Rail />
        <span className={`pill ${done ? 'pill-done' : 'pill-wait'}`}>{done ? 'DONE' : 'WAITING'}</span>
      </div>
    </article>
  );
}

export function VaultHistoryTable({
  rows,
  dateLabel,
  clock,
  flash,
}: {
  rows: TapeRow[];
  dateLabel: string;
  clock: string;
  flash: Set<string>;
}) {
  return (
    <section className="px-4 pb-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-xs tracking-[0.16em]">◈ CT &nbsp;|&nbsp; VAULT HISTORY</p>
        <p className="font-mono text-xs text-faint">{dateLabel} &nbsp;•&nbsp; {clock}</p>
      </div>
      <table className="tape">
        <thead>
          <tr>
            <th>เวลา</th>
            <th className="num">ฝากเข้า</th>
            <th className="num">ต้องส่ง U</th>
            <th className="num">ส่งจริง</th>
            <th>สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={5} className="px-4 py-8 text-muted">วันนี้ยังไม่มีสลิป</td></tr>
          ) : rows.map((row) => (
            <tr key={row.id} className={flash.has(row.id) ? 'flash' : undefined}>
              <td>{row.time || '—'}</td>
              <td className="num">{row.thb == null ? '—' : `${dash(row.thb)} THB`}</td>
              <td className="num">{row.dueUsdt == null ? '—' : `${dash(row.dueUsdt, 2)} U`}</td>
              <td className="num">{row.sentUsdt == null ? '—' : `${dash(row.sentUsdt, 2)} U`}</td>
              <td>
                <span className={`pill ${row.status === 'DONE' ? 'pill-done' : 'pill-wait'}`}>
                  {row.status === 'DONE' ? 'DONE' : 'WAIT'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
