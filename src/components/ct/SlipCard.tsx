'use client';

import { useState } from 'react';

type Slip = {
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

function n(v: number | null | undefined, d = 0) {
  if (v == null || !Number.isFinite(Number(v))) return '\u2014';
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

const STEPS = ['OCR', 'MATCH', 'IN', 'WAIT', 'DONE'] as const;

function onSteps(status: string, pending: boolean): number {
  if (status === 'DONE') return 5;
  if (status === 'ERR' || status === 'ERROR') return 1;
  if (status === 'WAIT' || status === 'SENT' || status === 'QUEUE' || pending) return 4;
  if (status === 'IN' || status === 'LOCK') return 3;
  if (status === 'MATCH') return 2;
  return 1;
}

export function SlipCard({ slip, onClose, queue }: {
  slip: Slip;
  onClose: () => void;
  queue?: { count: number; thb: number; usdt: number; target: number };
}) {
  const [copied, setCopied] = useState(false);
  const expected = slip.expectedUsdt ?? slip.usdt ?? null;
  const sent = slip.sentUsdt ?? (slip.status === 'DONE' ? expected : 0);
  const due = slip.dueUsdt ?? (
    expected == null ? null : Math.max(0, Number((expected - (sent ?? 0)).toFixed(2)))
  );
  const settled = slip.status === 'DONE';
  const queued = !settled && slip.status !== 'ERR' && slip.status !== 'ERROR';
  const active = onSteps(slip.status, slip.pending);
  const ref = slip.id.startsWith('#CE') || slip.id.startsWith('CE-') ? slip.id : (slip.short ? '#CE-' + slip.short : '');
  const target = queue?.target ?? 10000;
  const used = queue?.thb ?? slip.thb ?? 0;
  const left = Math.max(0, target - used);
  const dueAll = queue?.usdt ?? due ?? expected ?? 0;

  async function copyRef() {
    if (!ref) return;
    await navigator.clipboard.writeText(ref);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <article className="slip term">
      <div className="slip-head">
        <span className="slip-tag">CT \u00B7 QUEUE</span>
        <button type="button" className="slip-x" onClick={onClose} aria-label="close">close</button>
      </div>
      <p className="slip-note">บันทึกแล้ว รอรวมยอดเพื่อโอน USDT</p>
      <p className="slip-rail">
        {STEPS.map((s, i) => (
          <span key={s} className={i < active ? 'on' : ''}>{(i < active ? '\u25CF' : '\u25CB') + ' ' + s}</span>
        ))}
      </p>
      <div className="slip-rule" />
      <div className="slip-row"><span>REF</span><button type="button" className={'slip-copy' + (copied ? ' is-on' : '')} onClick={copyRef}>{copied ? 'copied' : ref || '\u2014'}</button></div>
      <p className="slip-payee">{[slip.bank, slip.last4 ? '\u00B7\u00B7\u00B7\u00B7 ' + slip.last4 : '', slip.name].filter(Boolean).join(' ') || '\u2014'}</p>
      <div className="slip-rule" />
      <div className="slip-row"><span>QUEUE</span><span>{queue?.count ?? 1} รายการ</span></div>
      <div className="slip-row"><span>IN</span><span className="in">{n(queue?.thb ?? slip.thb)} THB</span></div>
      <div className="slip-row"><span>DUE</span><span className="due">{n(dueAll, 2)} USDT</span></div>
      <div className="slip-row"><span>TARGET</span><span>{n(target)} THB</span></div>
      <div className="slip-row"><span>LEFT</span><span>{n(left)} THB</span></div>
      <div className="slip-rule" />
      <p className="slip-note">
        {queued
          ? `บันทึกเข้าคิวแล้ว ตอนนี้ต้องโอนรวม ${n(dueAll, 2)} USDT`
          : 'รายการนี้ปิดแล้ว'}
      </p>
      {queued ? <p className="slip-note">กด บันทึกส่งรวม เมื่อต้องการโอน</p> : null}
    </article>
  );
}
