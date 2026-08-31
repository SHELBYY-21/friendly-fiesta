'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SlipCard } from './SlipCard';

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
  bank?: string | null;
  last4?: string | null;
  name?: string | null;
};

type QueueFilter = 'ALL' | 'WAIT' | 'DONE' | 'ERR';

function n(v: number | null | undefined, d = 0) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function matches(filter: QueueFilter, status: string, pending: boolean) {
  if (filter === 'ALL') return true;
  if (filter === 'DONE') return status === 'DONE';
  if (filter === 'ERR') return status === 'ERR' || status === 'ERROR' || status === 'SCAN';
  return status === 'WAIT' || status === 'QUEUE' || status === 'SENT' || status === 'LOCK';
}

function badgeOf(status: string, pending: boolean) {
  if (status === 'DONE') return { label: 'DONE', cls: 'st-done' };
  if (status === 'ERR' || status === 'ERROR') return { label: 'ERR', cls: 'st-ocr' };
  if (status === 'IN' || status === 'LOCK') return { label: 'IN', cls: 'st-in' };
  if (status === 'WAIT' || status === 'SENT' || status === 'QUEUE' || pending) return { label: 'QUEUE', cls: 'st-wait' };
  return { label: status || 'IN', cls: 'st-ocr' };
}

function acct(row: TapeRow) {
  if (row.last4) return (row.bank ? `${row.bank} ` : '') + `····${row.last4}`;
  return row.short || '—';
}

function useCountUp(value: number, digits = 2) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || fromRef.current === value) {
      setShown(value);
      fromRef.current = value;
      return;
    }
    const start = fromRef.current;
    const diff = value - start;
    const dur = 240;
    const t0 = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(start + diff * eased);
      if (p < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return n(shown, digits);
}

export function QueueTape({
  rows, dateLabel, clock, waiting, sent, due, flash, onSettle, settling, onKeep,
}: {
  rows: TapeRow[];
  dateLabel: string;
  clock: string;
  waiting: number;
  sent: number;
  due: number;
  flash: Set<string>;
  coinDelta?: number;
  onSettle?: () => Promise<void> | void;
  settling?: boolean;
  onKeep?: (row: TapeRow) => Promise<void> | void;
}) {
  const [filter, setFilter] = useState<QueueFilter>('ALL');
  const [open, setOpen] = useState<TapeRow | null>(null);
  const dueText = useCountUp(due, 2);
  const shown = useMemo(() => rows.filter((r) => matches(filter, r.status, r.pending)), [rows, filter]);
  const pending = useMemo(() => rows.filter((r) => r.pending || r.status === 'WAIT' || r.status === 'QUEUE'), [rows]);
  const batch = {
    count: pending.length,
    thb: pending.reduce((s, r) => s + (r.thb ?? 0), 0),
    usdt: pending.reduce((s, r) => s + (r.dueUsdt ?? r.expectedUsdt ?? r.usdt ?? 0), 0),
    target: 10000,
  };

  return (
    <section className="queue-desk">
      <div className="qd-head">
        <p className="qd-mark">{'CT \u00b7 LEDGER'}</p>
        <p className="qd-clock">{dateLabel} {clock}</p>
      </div>
      <div className="qd-pills" role="tablist">
        {(['WAIT', 'DONE', 'ERR', 'ALL'] as QueueFilter[]).map((f) => (
          <button key={f} type="button" className={'qd-pill' + (filter === f ? ' is-on' : '')} onClick={() => setFilter(f)}>{f === 'WAIT' ? 'QUEUE' : f}</button>
        ))}
      </div>
      <article className="qd-balance">
        <p className="qd-k">USDT DUE</p>
        <p className="qd-amt">{dueText}</p>
        <p className="qd-sub">{`QUEUE ${batch.count} \u00b7 IN ${n(batch.thb)} THB \u00b7 SENT ${n(sent, 2)}`}</p>
      </article>
      <div className="qd-cols">
        <span>TIME</span><span>ACCT</span><span>THB</span><span>DUE</span><span>STATUS</span>
      </div>
      <div className="qd-list">
        {shown.length === 0 ? <p className="qd-empty">{filter === 'WAIT' ? 'ไม่มีคิวรอโอน — ดู ERR เพื่อ KEEP คิวพัก' : 'ไม่มีรายการในมุมนี้'}</p> : shown.map((row, i) => {
          const badge = badgeOf(row.status, row.pending);
          const dueU = row.dueUsdt ?? row.expectedUsdt ?? row.usdt;
          return (
            <div key={row.id} role="button" tabIndex={0} onClick={() => setOpen(row)} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(row); }} className={'qd-row' + (flash.has(row.id) ? ' is-flash' : '')} style={{ ['--i' as string]: Math.min(i, 12) }}>
              <span className="qd-time">{row.time || '—'}</span>
              <span className="qd-acct">{acct(row)}</span>
              <span className="qd-thb">{row.thb == null ? '—' : n(row.thb)}</span>
              <span className="qd-usdt">{n(dueU, 2)}</span>
              <span className={'st ' + badge.cls}>{badge.label}</span>
            </div>
          );
        })}
      </div>
      {open ? (
        <SlipCard
          slip={open}
          onClose={() => setOpen(null)}
          queue={batch}
          onKeep={onKeep ? async () => {
            await onKeep(open);
            setOpen((cur) => cur && cur.id === open.id
              ? { ...cur, status: 'WAIT', pending: true }
              : cur);
          } : undefined}
        />
      ) : null}
      <div className="qd-dock">
        <button type="button" className="qd-send" disabled={due <= 0 || settling || !onSettle} onClick={() => void onSettle?.()}>{settling ? 'กำลังบันทึก' : 'บันทึกส่งรวม'}</button>
      </div>
    </section>
  );
}
