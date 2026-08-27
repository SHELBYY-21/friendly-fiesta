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
};

function n(v: number | null | undefined, d = 0) {
  if (v == null || !Number.isFinite(Number(v))) return '\u2014';
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

const STEPS = ['OCR', 'MATCH', 'IN', 'QUEUE', 'DONE'] as const;

function onSteps(status: string, pending: boolean): number {
  if (status === 'DONE') return 5;
  if (status === 'ERR' || status === 'ERROR') return 1;
  if (status === 'WAIT' || status === 'SENT' || status === 'QUEUE' || pending) return 4;
  if (status === 'IN' || status === 'LOCK') return 3;
  if (status === 'MATCH') return 2;
  return 1;
}

export function SlipCard({ slip, onClose }: { slip: Slip; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const expected = slip.expectedUsdt ?? slip.usdt ?? null;
  const sent = slip.sentUsdt ?? (slip.status === 'DONE' ? expected : 0);
  const due = slip.dueUsdt ?? (
    expected == null ? null : Math.max(0, Number((expected - (sent ?? 0)).toFixed(2)))
  );
  const settled = slip.status === 'DONE';
  const queued = !settled && slip.status !== 'ERR' && slip.status !== 'ERROR';
  const active = onSteps(slip.status, slip.pending);
  const ref = slip.id.startsWith('#CE') || slip.id.startsWith('CE-') ? slip.id : slip.short;

  async function copyRef() {
    if (!ref) return;
    await navigator.clipboard.writeText(ref);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <article className="slip">
      <div className="slip-head">
        <span className="slip-tag">CT</span>
        <span className={'slip-badge' + (settled ? ' is-done' : slip.status === 'ERR' ? ' is-err' : ' is-wait')}>
          {settled ? 'DONE' : slip.status === 'ERR' ? 'ERROR' : 'QUEUE'}
        </span>
        <button type="button" className="slip-x" onClick={onClose} aria-label="close">close</button>
      </div>
      {queued ? <p className="slip-note">บันทึกเข้าสมุดแล้ว · ยังไม่โอน USDT</p> : null}
      <p className="slip-big">{n(settled ? sent : due ?? expected, 2)} <small>USDT</small></p>
      <div className="slip-strip">
        {STEPS.map((s, i) => (
          <span key={s} className={'slip-step' + (i < active ? ' on' : '') + (i === active - 1 && !settled ? ' wait' : '')}>{s}</span>
        ))}
      </div>
      <div className="slip-row" style={{ ['--i' as string]: 0 }}><span>เงินเข้า IN</span><span className="in">{slip.thb == null ? '\u2014' : '+' + n(slip.thb) + ' THB'}</span></div>
      <div className="slip-row" style={{ ['--i' as string]: 1 }}><span>ต้องส่ง DUE</span><span className="due">{n(due ?? expected, 2)} U</span></div>
      <div className="slip-row" style={{ ['--i' as string]: 2 }}><span>โอนแล้ว OUT</span><span className="out">{sent ? '-' + n(sent, 2) + ' U' : '0.00 U'}</span></div>
      <div className="slip-row" style={{ ['--i' as string]: 3 }}>
        <span>อ้างอิง REF</span>
        <button type="button" className={'slip-copy' + (copied ? ' is-on' : '')} onClick={copyRef}>{copied ? 'copied' : (ref || '\u2014')}</button>
      </div>
      <div className="copy-ref">
        <button type="button" onClick={copyRef}>{copied ? 'copied' : 'copy ref'}</button>
      </div>
      <p className="slip-foot">{slip.time || '\u2014'}</p>
    </article>
  );
}
