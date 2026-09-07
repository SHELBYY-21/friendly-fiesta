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
    holdCount?: number;
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
  hint?: string;
  value: ReactNode;
  tone?: 'in' | 'out' | 'net' | 'due' | 'muted';
  mark?: 'in' | 'out';
}) {
  return (
    <div className={'sum-row' + (tone ? ' is-' + tone : '')}>
      <span className="sum-k">
        {mark ? <i className={'sum-dot ' + mark} /> : null}
        {label}
        {hint ? <em>{hint}</em> : null}
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
  const hold = daily.holdCount ?? 0;
  const err = daily.errCount ?? 0;
  const parked = hold + err;
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
          <p className="sum-title">สรุปยอดวันนี้</p>
          <p className="sum-meta">{dateLabel ?? 'วันนี้'}</p>
        </div>
        <SyncBadge lastSync={lastSync} status={syncStatus} />
      </header>

      <div className="kpi-strip" aria-label="สรุปยอดวันนี้">
        <article className="kpi is-in">
          <p>ยอดรับเข้า</p>
          <strong><CountUp value={daily.totalThbReceived} decimals={0} /></strong>
          <span>จากลูกค้า · {inCount} รายการ</span>
        </article>
        <article className="kpi is-due">
          <p>รอโอน</p>
          <strong><CountUp value={required} decimals={2} /></strong>
          <span>USDT</span>
        </article>
        <article className="kpi is-out">
          <p>โอนสำเร็จ</p>
          <strong><CountUp value={daily.totalUsdtSent} decimals={2} /></strong>
          <span>USDT · {outCount} รายการ</span>
        </article>
        <article className={over ? 'kpi is-risk' : 'kpi is-due'}>
          <p>{over ? 'ส่งเกิน' : 'รายการค้าง'}</p>
          <strong><CountUp value={over ? Math.abs(coin) : pending} decimals={2} /></strong>
          <span>{over ? 'USDT · ตรวจหัวหน้า' : `USDT · คิว ${wait}`}</span>
        </article>
      </div>

      <div className="sum-block" aria-label="สถานะการรับเงิน">
        <p className="sum-section">สถานะการรับเงิน</p>
        <Row mark="in" label="รับเข้า" tone="in" value={<>{inCount}<span className="sum-qty">รายการ</span></>} />
        <Row label="รอโอน" tone="due" value={<>{wait}<span className="sum-qty">รายการ</span></>} />
        <Row mark="out" label="โอนสำเร็จ" tone="out" value={<>{outCount}<span className="sum-qty">รายการ</span></>} />
        <Row label="รอดำเนินการ" tone={parked ? 'net' : 'muted'} value={<>{parked}<span className="sum-qty">พัก / ผิด</span></>} />
      </div>
      <div className="sum-rule" />
      <div className="sum-block">
        <Row label="เราขาย" hint="อัตราขายให้ลูกค้า" value={desk ? n(desk, 2) + ' บาท / U' : '—'} />
        <Row label="เรทอ้างอิง" hint="ราคาตลาดอ้างอิง" tone="muted" value={mkt ? n(mkt, 2) : '—'} />
        <Row label="อัปเดตล่าสุด" tone="muted" value={clock ?? '—'} />
        {owner ? <Row label="ผู้รับผิดชอบ" value={owner.name + ' · ' + owner.count} /> : null}
      </div>
    </section>
  );
}
