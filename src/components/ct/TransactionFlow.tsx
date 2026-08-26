'use client';

import { useMemo, useState } from 'react';

type TapeRow = {
  id: string;
  short: string;
  thb: number | null;
  expectedUsdt?: number | null;
  sentUsdt?: number | null;
  dueUsdt?: number | null;
  usdt?: number | null;
  time: string;
  pending: boolean;
  status: string;
};

function n(v: number | null | undefined, d = 0) {
  if (v == null || !Number.isFinite(Number(v))) return '\u2014';
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

type QueueFilter = 'ALL' | 'WAIT' | 'DONE' | 'ERR';

function matches(filter: QueueFilter, status: string, pending: boolean) {
  if (filter === 'ALL') return true;
  if (filter === 'DONE') return status === 'DONE';
  if (filter === 'ERR') return status === 'ERR';
  return status === 'WAIT' || status === 'SENT' || pending;
}

export function QueueTape({
  rows, dateLabel, clock, waiting, sent, due, flash,
}: {
  rows: TapeRow[];
  dateLabel: string;
  clock: string;
  waiting: number;
  sent: number;
  due: number;
  flash: Set<string>;
}) {
  const [filter, setFilter] = useState<QueueFilter>('ALL');
  const shown = useMemo(
    () => rows.filter((r) => matches(filter, r.status, r.pending)),
    [rows, filter],
  );
  const counts = useMemo(() => ({
    ALL: rows.length,
    WAIT: rows.filter((r) => matches('WAIT', r.status, r.pending)).length,
    DONE: rows.filter((r) => r.status === 'DONE').length,
    ERR: rows.filter((r) => r.status === 'ERR').length,
  }), [rows]);

  return (
    <section className="px-4 pb-10">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-xs tracking-[0.16em]">{'\u25C8'} CT | {dateLabel}</p>
        <p className="font-mono text-xs text-faint">{clock}</p>
      </div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-faint">QUEUE</p>
        <div className="flex gap-1">
          {(['ALL', 'WAIT', 'DONE', 'ERR'] as QueueFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-2 py-1 font-mono text-[10px] tracking-[0.12em] ${
                filter === f ? 'text-gold border border-[var(--gold)]' : 'text-faint border border-[var(--line)]'
              }`}
            >
              {f} {counts[f]}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-3 h-px bg-[var(--line)]" />
      <table className="tape">
        <thead>
          <tr>
            <th>TIME</th>
            <th className="num">THB</th>
            <th className="num">USDT</th>
            <th>REF</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {shown.length === 0 ? (
            <tr><td colSpan={5} className="px-4 py-8 text-muted">empty</td></tr>
          ) : shown.map((row) => (
            <tr key={row.id} className={flash.has(row.id) ? 'flash' : undefined}>
              <td>{row.time || '\u2014'}</td>
              <td className="num">{row.thb == null ? '\u2014' : n(row.thb)}</td>
              <td className="num">{n(row.expectedUsdt ?? row.usdt, 2)}</td>
              <td className="font-mono text-gold">{row.short || '\u2014'}</td>
              <td>
                <span className={`pill ${row.status === 'DONE' ? 'pill-done' : row.status === 'ERR' ? 'pill-live' : 'pill-wait'}`}>
                  {row.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 h-px bg-[var(--line)]" />
      <dl className="mt-3 grid max-w-xs grid-cols-[7rem_1fr] gap-y-1 font-mono text-sm">
        <dt className="text-faint">WAITING</dt>
        <dd className="text-right">{n(waiting, 2)} U</dd>
        <dt className="text-faint">SENT</dt>
        <dd className="text-right">{n(sent, 2)} U</dd>
        <dt className="text-gold">DUE</dt>
        <dd className="text-right text-gold">{n(due, 2)} U</dd>
      </dl>
    </section>
  );
}
