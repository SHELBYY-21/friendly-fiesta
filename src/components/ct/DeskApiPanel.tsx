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
  const [typhoonReady, setTyphoonReady] = useState(false);
  const [typhoonKey, setTyphoonKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    fetch('/api/admin/settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const list = j?.data?.apiEndpoints;
        if (Array.isArray(list) && list.length) setRemote(list);
        setTyphoonReady(Boolean(j?.data?.typhoonReady));
      })
      .catch(() => {});
  }, [open]);

  async function saveTyphoon() {
    const value = typhoonKey.trim();
    if (!value) return;
    setSaving(true);
    setNote('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: 'typhoon_api_key', value }),
      });
      const json = await res.json();
      if (!res.ok || json?.error) throw new Error(json?.error?.message || 'save failed');
      setTyphoonReady(true);
      setTyphoonKey('');
      setNote('เปิดอ่านสลิปแล้ว');
    } catch {
      setNote('คีย์ไม่ผ่าน ตรวจแล้ววางใหม่');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <section className="desk-api-panel" aria-label="ตรวจสอบรายการ">
      <div className="desk-api-panel__bar">
        <strong>ตรวจสอบรายการ</strong>
        <button type="button" className="qd-pill" onClick={onClose}>ปิด</button>
      </div>
      <form
        className="desk-api-panel__keys"
        onSubmit={(e) => {
          e.preventDefault();
          void saveTyphoon();
        }}
      >
        <label>
          คีย์ Typhoon สำหรับอ่านสลิป
          <span className={typhoonReady ? 'ok' : 'wait'}>{typhoonReady ? 'พร้อมอ่าน' : 'ยังไม่มีคีย์'}</span>
        </label>
        <div className="desk-api-panel__row">
          <input
            type="password"
            autoComplete="off"
            placeholder="sk-…"
            value={typhoonKey}
            onChange={(e) => setTyphoonKey(e.target.value)}
            aria-label="คีย์ Typhoon"
          />
          <button type="submit" className="qd-pill" disabled={saving || !typhoonKey.trim()}>
            {saving ? 'กำลังเปิด OCR' : 'เปิดอ่านสลิป'}
          </button>
        </div>
        {note ? <p>{note}</p> : null}
      </form>
      <ApiMonitor endpoints={remote ?? SEED} storageKey="ct.apiMonitor.v2" />
    </section>
  );
}