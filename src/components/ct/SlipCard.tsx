'use client';

import { useState } from 'react';

type Slip = {
  id: string;
  ledger?: string | null;
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
  if (status === 'ERR' || status === 'ERROR' || status === 'HOLD' || status === 'SCAN') return 1;
  if (status === 'WAIT' || status === 'SENT' || status === 'QUEUE' || pending) return 4;
  if (status === 'IN' || status === 'LOCK') return 3;
  if (status === 'MATCH') return 2;
  return 1;
}

function refOf(slip: Slip) {
  const raw = String(slip.ledger || slip.id || '');
  if (raw.startsWith('#CE') || raw.startsWith('CE-')) return raw.startsWith('#') ? raw : '#' + raw;
  return slip.short ? '#CE-' + slip.short : '';
}

export function SlipCard({ slip, onClose, queue, onKeep }: {
  slip: Slip;
  onClose: () => void;
  queue?: { count: number; thb: number; usdt: number; target: number };
  onKeep?: () => Promise<void> | void;
}) {
  const [copied, setCopied] = useState(false);
  const [keeping, setKeeping] = useState(false);
  const [keepErr, setKeepErr] = useState<string | null>(null);
  const expected = slip.expectedUsdt ?? slip.usdt ?? null;
  const sent = slip.sentUsdt ?? (slip.status === 'DONE' ? expected : null);
  const due = slip.dueUsdt ?? (
    expected == null ? null : Math.max(0, Number((expected - (sent ?? 0)).toFixed(2)))
  );
  const settled = slip.status === 'DONE';
  const queued = !settled && slip.status !== 'ERR' && slip.status !== 'ERROR';
  const active = onSteps(slip.status, slip.pending);
  const ref = refOf(slip);
  const target = queue?.target ?? 10000;
  const used = queue?.thb ?? 0;
  const left = Math.max(0, target - used);
  const dueAll = queue?.usdt ?? 0;
  const payee = [slip.bank, slip.last4 ? '\u00b7\u00b7\u00b7\u00b7 ' + slip.last4 : null].filter(Boolean).join(' ');

  async function copyRef() {
    if (!ref) return;
    await navigator.clipboard.writeText(ref);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <article className="slip term">
      <div className="slip-head">
        <span className="slip-tag">CT \u00b7 {slip.status || 'QUEUE'}</span>
        <button type="button" className="slip-x" onClick={onClose} aria-label="close">close</button>
      </div>
      <p className="slip-rail">
        {STEPS.map((s, i) => (
          <span key={s} className={i < active ? 'on' : ''}>{(i < active ? '\u25cf' : '\u25cb') + ' ' + s}</span>
        ))}
      </p>
      <div className="slip-rule" />
      <div className="slip-row"><span>TIME</span><span>{slip.time || '\u2014'}</span></div>
      <div className="slip-row"><span>REF</span><button type="button" className={'slip-copy' + (copied ? ' is-on' : '')} onClick={copyRef}>{copied ? 'copied' : ref || '\u2014'}</button></div>
      <div className="slip-row"><span>PAYEE</span><span>{payee || '\u2014'}</span></div>
      <div className="slip-row"><span>NAME</span><span>{slip.name || '\u2014'}</span></div>
      <div className="slip-rule" />
      <div className="slip-row"><span>IN</span><span className="in">{n(slip.thb)} THB</span></div>
      <div className="slip-row"><span>DUE</span><span className="due">{n(due ?? expected, 2)} USDT</span></div>
      <div className="slip-row"><span>SENT</span><span>{n(sent, 2)} USDT</span></div>
      <div className="slip-rule" />
      <div className="slip-row"><span>QUEUE</span><span>{queue?.count ?? 1} รายการ</span></div>
      <div className="slip-row"><span>IN ALL</span><span className="in">{n(queue?.thb)} THB</span></div>
      <div className="slip-row"><span>DUE ALL</span><span className="due">{n(dueAll, 2)} USDT</span></div>
      <div className="slip-row"><span>TARGET</span><span>{n(target)} THB</span></div>
      <div className="slip-row"><span>LEFT</span><span>{n(left)} THB</span></div>
      <div className="slip-rule" />
      <p className="slip-note">
        {slip.status === 'ERR' || slip.status === 'ERROR'
          ? 'บัญชีรับยังไม่ตรงหมุด — ปักบัญชีแล้วกด KEEP'
          : queued
            ? `บันทึกเข้าคิวแล้ว ตอนนี้ต้องโอนรวม ${n(dueAll || due, 2)} USDT`
            : 'รายการนี้ปิดแล้ว'}
      </p>
      {onKeep && slip.status !== 'DONE' ? (
        <>
          {keepErr ? <p className="slip-note" style={{ color: 'var(--danger,#ff453a)' }}>{keepErr}</p> : null}
          <button
            type="button"
            className="keep mt-3 w-full px-3 py-2 text-xs"
            disabled={keeping}
            onClick={async () => {
              setKeeping(true);
              setKeepErr(null);
              try {
                await onKeep();
              } catch (e: any) {
                setKeepErr(e?.message || 'KEEP ไม่สำเร็จ');
              } finally {
                setKeeping(false);
              }
            }}
          >
            {keeping ? 'กำลังเก็บ' : slip.status === 'ERR' || slip.status === 'ERROR' || slip.status === 'HOLD'
              ? 'KEEP เข้าคิว'
              : 'KEEP'}
          </button>
        </>
      ) : queued ? <p className="slip-note">กด บันทึกส่งรวม เมื่อต้องการโอน</p> : null}
    </article>
  );
}
