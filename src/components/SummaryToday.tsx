'use client';

import type { ReactNode } from 'react';
import CountUp from './CountUp';
import SyncBadge, { type SyncStatus } from './SyncBadge';

export interface SummaryTodayProps {
  dateLabel?: string;
  account?: {
    id: string;
    name: string;
    bankName: string;
    last4: string;
  };
  daily: {
    transactionCount: number;
    totalThbReceived: number;
    totalUsdtSent: number;
    requiredUsdt?: number;
    pendingUsdt?: number;
    coinDelta?: number;
    feeUsdt?: number;
    inCount?: number;
    outCount?: number;
    waitCount?: number;
    errCount?: number;
  };
  rates: {
    sellRate: number;
    marketRate: number;
  };
  lastSync?: Date | null;
  syncStatus?: SyncStatus;
  owner?: { name: string; count: number };
}

function n(v: number, d: number) {
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function Row({
  label, hint, value, tone, mark,
}: {
  label: string;
  hint: string;
  value: ReactNode;
  tone?: 'in' | 'out' | 'net' | 'due' | 'muted';
  mark?: 'in' | 'out';
}) {
  return (
    <div className={'sum-row' + (tone ? ' is-' + tone : '')}>
      <span className="sum-k">
        {mark ? <i className={'sum-dot ' + mark} /> : null}
        {label}
        <em>{hint}</em>
      </span>
      <span className="sum-v">{value}</span>
    </div>
  );
}

export default function SummaryToday({
  dateLabel,
  daily,
  rates,
  lastSync,
  syncStatus,
  owner,
}: SummaryTodayProps) {
  const inCount = daily.inCount ?? daily.transactionCount;
  const outCount = daily.outCount ?? 0;
  const wait = daily.waitCount ?? Math.max(0, inCount - outCount);
  const required = daily.requiredUsdt ?? 0;
  const pending = daily.pendingUsdt ?? Math.max(0, required - daily.totalUsdtSent);
  const coin = daily.coinDelta ?? daily.totalUsdtSent - required;
  const over = coin < 0;
  const desk = rates.sellRate > 0 ? rates.sellRate : 0;
  const mkt = rates.marketRate > 0 ? rates.marketRate : 0;
  const clock = lastSync
    ? lastSync.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
    : null;

  return (
    <section className="sum-desk">
      <header className="sum-head">
        <div>
          <p className="sum-title">ยอดวันนี้</p>
          <p className="sum-meta">{dateLabel ?? 'วันนี้'}</p>
        </div>
        <SyncBadge lastSync={lastSync} status={syncStatus} />
      </header>

      <div className="kpi-strip">
        <article className="kpi is-in">
          <p>รับบาท</p>
          <strong><CountUp value={daily.totalThbReceived} decimals={0} /></strong>
          <span>บาท · {inCount} รายการ</span>
        </article>
        <article className="kpi is-due">
          <p>ต้องโอน</p>
          <strong><CountUp value={required} decimals={2} /></strong>
          <span>USDT</span>
        </article>
        <article className="kpi">
          <p>โอนแล้ว</p>
          <strong><CountUp value={daily.totalUsdtSent} decimals={2} /></strong>
          <span>USDT · {outCount} รายการ</span>
        </article>
        <article className={over ? 'kpi is-out' : 'kpi'}>
          <p>{over ? 'ส่งเกิน' : 'ยังค้าง'}</p>
          <strong><CountUp value={over ? Math.abs(coin) : pending} decimals={2} /></strong>
          <span>{over ? 'USDT' : `คิว ${wait}`}</span>
        </article>
      </div>

      <div className="sum-block">
        <Row mark="in" label="เงินเข้า" hint="รับจากลูกค้า" tone="in" value={<><CountUp value={daily.totalThbReceived} decimals={0} /> บาท<span className="sum-qty">{inCount}</span></>} />
        <Row label="ต้องโอน" hint="ยังไม่ส่ง" tone="due" value={<><CountUp value={required} decimals={2} /> U</>} />
        <Row mark="out" label="โอนแล้ว" hint="บันทึกแล้ว" tone="out" value={<><CountUp value={daily.totalUsdtSent} decimals={2} /> U<span className="sum-qty">{outCount}</span></>} />
        <Row label={over ? 'ส่งเกิน' : 'ยังค้าง'} hint={over ? 'ตรวจหัวหน้า' : 'รอในคิว'} tone={over ? 'net' : 'due'} value={<><CountUp value={over ? Math.abs(coin) : pending} decimals={2} /> U</>} />
      </div>
      <div className="sum-rule" />
      <div className="sum-block">
        <Row label="เรทโต๊ะ" hint="ขายลูกค้า" value={desk ? n(desk, 2) + ' บาท / U' : '—'} />
        <Row label="เรทตลาด" hint="อ้างอิง" tone="muted" value={mkt ? n(mkt, 2) : '—'} />
        <Row label="อัปเดตล่าสุด" hint="" tone="muted" value={clock ?? '—'} />
        {owner ? <Row label="ผู้รับผิดชอบ" hint="" value={owner.name + ' · ' + owner.count} /> : null}
      </div>
    </section>
  );
}
