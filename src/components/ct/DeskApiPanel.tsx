'use client';

import { useEffect, useState } from 'react';
import ApiMonitor, { type ApiEndpoint } from '@/components/ApiMonitor';

const SEED: ApiEndpoint[] = [
  { id: 'health', name: 'สุขภาพระบบ', url: '/api/health', method: 'GET', category: 'core', description: 'db + webhook' },
  { id: 'vault', name: 'โต๊ะคิว', url: '/api/dashboard/vault?mode=pending', method: 'GET', category: 'dashboard' },
  { id: 'hook', name: 'Telegram webhook', url: '/api/telegram/webhook', method: 'GET', category: 'core' },
  { id: 'force-hook', name: 'ลง webhook ใหม่', url: '/api/health?forceWebhook=1', method: 'GET', category: 'core' },
  { id: 'circle', name: 'Circle', url: '/api/circle/health', method: 'GET', category: 'external' },
  { id: 'market', name: 'เรทตลาด', url: '/api/market-rate', method: 'GET', category: 'external' },
];

export default function DeskApiPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [remote, setRemote] = useState<ApiEndpoint[] | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch('/api/admin/settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const list = j?.data?.apiEndpoints;
        if (Array.isArray(list) && list.length) setRemote(list);
      })
      .catch(() => {});
  }, [open]);

  if (!open) return null;

  return (
    <section className="desk-api-panel" aria-label="มอนิเตอร์ API">
      <div className="desk-api-panel__bar">
        <strong>เชื่อม API จากหน้านี้</strong>
        <button type="button" className="qd-pill" onClick={onClose}>
          ปิด
        </button>
      </div>
      <p className="desk-api-panel__hint">
        กด เพิ่ม API แล้วใส่ชื่อ + URL · ลิงในเครื่องนี้ · URL นอกระบบต้องเป็น https และอยู่ในรายการที่รู้จัก (เช่น api.telegram.org, api.circle.com)
      </p>
      <ApiMonitor endpoints={remote ?? SEED} autoRefreshMs={30000} storageKey="ct.apiMonitor.v2" />
    </section>
  );
}
