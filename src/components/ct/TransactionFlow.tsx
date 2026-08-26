'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

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

type QueueFilter = 'ALL' | 'WAIT' | 'DONE' | 'ERR';

function n(v: number | null | undefined, d = 0) {
  if (v == null || !Number.isFinite(Number(v))) return '\u2014';
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function matches(filter: QueueFilter, status: string, pending: boolean) {
  if (filter === 'ALL') return true;
  if (filter === 'DONE') return status === 'DONE';
  if (filter === 'ERR') return status === 'ERR';
  return status === 'WAIT' || status === 'SENT' || pending;
}

function badgeOf(status: string, pending: boolean) {
  if (status === 'DONE') return { label: 'DONE', cls: 'st-done' };
  if (status === 'ERR' || status === 'ERROR') return { label: 'OCR', cls: 'st-ocr' };
  if (status === 'IN' || status === 'LOCK') return { label: 'IN', cls: 'st-in' };
  if (status === 'MATCH') return { label: 'MATCH', cls: 'st-match' };
  if (status === 'WAIT' || status === 'SENT' || pending) return { label: 'WAIT', cls: 'st-wait' };
  return { label: status || 'OCR', cls: 'st-ocr' };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
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
  rows, dateLabel, clock, waiting, sent, due, flash, coinDelta,
}: {
  rows: TapeRow[];
  dateLabel: string;
  clock: string;
  waiting: number;
  sent: number;
  due: number;
  flash: Set<string>;
  coinDelta?: number;
}) {
  const [filter, setFilter] = useState<QueueFilter>('WAIT');
  const [focus, setFocus] = useState<string | null>(null);
  const dueText = useCountUp(due, 2);
  const shown = useMemo(() => {
    const base = rows.filter((r) => matches(filter, r.status, r.pending));
    return focus ? base.filter((r) => r.short === focus) : base;
  }, [rows, filter, focus]);
  const refs = useMemo(() => {
    const seen = new Set<string>();
    return rows.filter((r) => r.pending || r.status === 'WAIT').map((r) => r.short).filter((s) => {
      if (!s || seen.has(s)) return false;
      seen.add(s);
      return true;
    }).slice(0, 2);
  }, [rows]);
  const groups = chunk(shown, 5);
  const delta = coinDelta ?? sent - waiting;
  const deltaLabel = (delta >= 0 ? '+' : '') + n(delta, 2);
  return (
    <section className="queue-desk">
      <div className="qd-head">
        <p className="qd-mark">CT \u00B7 {dateLabel}</p>
        <p className="qd-clock">{clock}</p>
      </div>
      <div className="qd-pills" role="tablist">
        {refs.map((ref) => (
          <button key={ref} type="button" className={'qd-pill' + (focus === ref ? ' is-on' : '')} onClick={() => setFocus((cur) => cur === ref ? null : ref)}>{ref}</button>
        ))}
        {(['WAIT', 'DONE', 'ALL'] as QueueFilter[]).map((f) => (
          <button key={f} type="button" className={'qd-pill' + (filter === f && !focus ? ' is-on' : '')} onClick={() => { setFilter(f); setFocus(null); }}>{f}</button>
        ))}
      </div>
      <article className="qd-balance">
        <p className="qd-k">USDT DUE</p>
        <div className="qd-amt-row">
          <p className="qd-amt">{dueText}</p>
          <span className={'qd-delta ' + (delta >= 0 ? 'up' : 'down')}>{deltaLabel}</span>
        </div>
        <p className="qd-sub">WAIT {n(waiting, 2)} \u00B7 SENT {n(sent, 2)}</p>
      </article>
      <div className="qd-list">
        {shown.length === 0 ? <p className="qd-empty">queue is quiet</p> : groups.map((group, gi) => (
          <div key={gi} className="qd-group">
            {group.map((row, i) => {
              const badge = badgeOf(row.status, row.pending);
              const idx = gi * 5 + i;
              const usdtAmt = row.expectedUsdt ?? row.usdt;
              return (
                <div key={row.id} className={'qd-row' + (flash.has(row.id) ? ' is-flash' : '')} style={{ ['--i' as string]: Math.min(idx, 12) }}>
                  <span className={'st ' + badge.cls}>
                    {badge.label === 'WAIT' ? <i className="st-dot" /> : null}
                    {badge.label === 'DONE' ? <i className="st-check">OK</i> : null}
                    {badge.label}
                  </span>
                  <span className="qd-idx">{String(idx + 1).padStart(2, '0')}</span>
                  <span className="qd-thb">{row.thb == null ? '\u2014' : n(row.thb) + ' THB'}</span>
                  <span className="qd-arrow">></span>
                  <span className="qd-usdt">{n(usdtAmt, 2)} U</span>
                  <span className="qd-flag">{row.status === 'DONE' ? 'done' : 'due'}</span>
                </div>
              );
            })}
            {gi < groups.length - 1 ? <div className="qd-split" /> : null}
          </div>
        ))}
      </div>
      <div className="qd-dock">
        <button type="button" className="qd-send" disabled={due <= 0}>Send all pending</button>
        <button type="button" className="qd-ghost">Cancel duplicates</button>
      </div>
    </section>
  );
}
