'use client';

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

const STEPS = ['OCR', 'MATCH', 'IN', 'WAIT', 'DONE'] as const;

function onSteps(status: string, pending: boolean): number {
  if (status === 'DONE') return 5;
  if (status === 'ERR' || status === 'ERROR') return 1;
  if (status === 'WAIT' || status === 'SENT' || pending) return 4;
  if (status === 'IN' || status === 'LOCK') return 3;
  if (status === 'MATCH') return 2;
  return 1;
}

export function SlipCard({ slip, onClose }: { slip: Slip; onClose: () => void }) {
  const expected = slip.expectedUsdt ?? slip.usdt ?? null;
  const sent = slip.sentUsdt ?? (slip.status === 'DONE' ? expected : 0);
  const due = slip.dueUsdt ?? (
    expected == null ? null : Math.max(0, Number((expected - (sent ?? 0)).toFixed(2)))
  );
  const settled = slip.status === 'DONE';
  const active = onSteps(slip.status, slip.pending);
  const ref = slip.id.startsWith('#CE') || slip.id.startsWith('CE-') ? slip.id : slip.short;

  return (
    <article className="slip">
      <div className="slip-head">
        <span className="slip-tag">CT</span>
        <span className={'slip-badge' + (settled ? ' is-done' : slip.status === 'ERR' ? ' is-err' : ' is-wait')}>
          {settled ? 'SETTLED' : slip.status === 'ERR' ? 'ERROR' : 'WAIT'}
        </span>
        <button type="button" className="slip-x" onClick={onClose} aria-label="close">close</button>
      </div>
      <p className="slip-big">{n(settled ? sent : due ?? expected, 2)} <small>USDT</small></p>
      <div className="slip-strip">
        {STEPS.map((s, i) => (
          <span key={s} className={'slip-step' + (i < active ? ' on' : '')}>{s}</span>
        ))}
      </div>
      <div className="slip-row"><span>เงินเข้า IN</span><span className="in">{slip.thb == null ? '\u2014' : '+' + n(slip.thb) + ' THB'}</span></div>
      <div className="slip-row"><span>เงินออก OUT</span><span className="out">{sent ? '-' + n(sent, 2) + ' U' : '0.00 U'}</span></div>
      <div className="slip-row"><span>ต้องส่ง DUE</span><span className="due">{n(due ?? expected, 2)} U</span></div>
      <div className="slip-row">
        <span>อ้างอิง REF</span>
        <button type="button" className="slip-copy" onClick={() => navigator.clipboard.writeText(ref)}>{ref || '\u2014'}</button>
      </div>
      <p className="slip-foot">{slip.time || '\u2014'}</p>
    </article>
  );
}
