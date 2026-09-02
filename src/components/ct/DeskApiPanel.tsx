'use client';

import { useEffect, useState } from 'react';
import ApiMonitor, { type ApiEndpoint } from '@/components/ApiMonitor';

const SEED: ApiEndpoint[] = [
  { id: 'health', name: 'สุขภาพ', url: '/api/health', method: 'GET', category: 'core' },
  { id: 'vault', name: 'โต๊ะ', url: '/api/dashboard/vault?mode=pending', method: 'GET', category: 'dashboard' },
  { id: 'hook', name: 'Webhook', url: '/api/telegram/webhook', method: 'GET', category: 'core' },
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
        <strong>มอนิเตอร์</strong>
        <button type="button" className="qd-pill" onClick={onClose}>ปิด</button>
      </div>
      <ApiMonitor endpoints={remote ?? SEED} storageKey="ct.apiMonitor.v2" />
    </section>
  );
}
