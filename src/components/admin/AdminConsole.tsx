'use client';

// ============================================================
// Admin Console — คุมระบบทั้งหมดจากหน้า dashboard ไม่ต้องแตะโค้ด
// - ปุ่มหยุด/เริ่มบอท (kill switch)
// - ตั้งเรทขาย / เรทตลาด
// - จัดการ admin users
// - จัดการบัญชีที่ pin ต่อกลุ่ม
// ============================================================
import { useCallback, useEffect, useState } from 'react';

interface Settings {
  botEnabled: boolean;
  maintenanceMessage: string;
}

interface AdminUser {
  id: string;
  name: string;
  telegramUserId: string;
  holdingUsdt: number;
}

interface BankAccount {
  id: string;
  label: string;
  bankName: string;
  last4: string;
  currentBalance: number;
}

interface PinnedRow {
  chatId: string;
  bankAccountId: string;
  label: string;
  bankName: string;
  last4: string;
}

type Tab = 'bot' | 'rate' | 'admins' | 'pins';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'bot', label: 'ควบคุมบอท', icon: '🤖' },
  { id: 'rate', label: 'ตั้งเรท', icon: '💱' },
  { id: 'admins', label: 'ผู้ดูแล', icon: '👥' },
  { id: 'pins', label: 'บัญชี Pin', icon: '📌' },
];

function Toast({ message, tone }: { message: string; tone: 'ok' | 'error' }) {
  return (
    <div
      className={`mt-3 rounded-lg px-3 py-2 text-xs ${
        tone === 'ok' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'
      }`}
    >
      {tone === 'ok' ? '✓ ' : '⚠ '}
      {message}
    </div>
  );
}

export default function AdminConsole() {
  const [tab, setTab] = useState<Tab>('bot');
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'error' } | null>(null);
  const [busy, setBusy] = useState(false);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [rate, setRate] = useState<{ sellRate: number; marketRate: number } | null>(null);
  const [sellInput, setSellInput] = useState('');
  const [marketInput, setMarketInput] = useState('');

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminTgId, setNewAdminTgId] = useState('');

  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [pins, setPins] = useState<PinnedRow[]>([]);
  const [pinChatId, setPinChatId] = useState('');
  const [pinBankId, setPinBankId] = useState('');

  const flash = (message: string, tone: 'ok' | 'error') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 4000);
  };

  const loadAll = useCallback(async () => {
    const [s, r, a, b, p] = await Promise.all([
      fetch('/api/admin/settings', { cache: 'no-store' }).then((x) => x.json()).catch(() => null),
      fetch('/api/admin/rate', { cache: 'no-store' }).then((x) => x.json()).catch(() => null),
      fetch('/api/admin/admins', { cache: 'no-store' }).then((x) => x.json()).catch(() => null),
      fetch('/api/admin/bank-accounts', { cache: 'no-store' }).then((x) => x.json()).catch(() => null),
      fetch('/api/admin/pinned-accounts', { cache: 'no-store' }).then((x) => x.json()).catch(() => null),
    ]);
    if (s?.data) setSettings(s.data);
    if (r?.data) {
      setRate(r.data);
      setSellInput(String(r.data.sellRate));
      setMarketInput(String(r.data.marketRate));
    }
    if (a?.data) setAdmins(a.data);
    if (b?.data) setBanks(b.data);
    if (p?.data) setPins(p.data);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const toggleBot = async (enabled: boolean) => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: 'bot_enabled', value: enabled }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      setSettings((prev) => (prev ? { ...prev, botEnabled: enabled } : prev));
      flash(enabled ? 'เปิดบอทแล้ว' : 'หยุดบอทแล้ว — บอทจะตอบข้อความแจ้งปิดปรับปรุง', 'ok');
    } catch (e: any) {
      flash(e?.message ?? 'ทำรายการไม่สำเร็จ', 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveRate = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/rate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sellRate: Number(sellInput), marketRate: Number(marketInput) }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      setRate(json.data);
      flash(`ตั้งเรทใหม่แล้ว: ขาย ${json.data.sellRate} / ตลาด ${json.data.marketRate}`, 'ok');
    } catch (e: any) {
      flash(e?.message ?? 'ตั้งเรทไม่สำเร็จ', 'error');
    } finally {
      setBusy(false);
    }
  };

  const addAdmin = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: newAdminName, telegramUserId: Number(newAdminTgId) }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      setAdmins((prev) => [...prev, json.data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewAdminName('');
      setNewAdminTgId('');
      flash(`เพิ่ม ${json.data.name} แล้ว`, 'ok');
    } catch (e: any) {
      flash(e?.message ?? 'เพิ่มไม่สำเร็จ', 'error');
    } finally {
      setBusy(false);
    }
  };

  const removeAdmin = async (id: string, name: string) => {
    if (!confirm(`ลบผู้ดูแล "${name}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/admins?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      setAdmins((prev) => prev.filter((a) => a.id !== id));
      flash(`ลบ ${name} แล้ว`, 'ok');
    } catch (e: any) {
      flash(e?.message ?? 'ลบไม่สำเร็จ', 'error');
    } finally {
      setBusy(false);
    }
  };

  const addPin = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/pinned-accounts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chatId: Number(pinChatId), bankAccountId: pinBankId }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      flash('pin บัญชีแล้ว', 'ok');
      setPinBankId('');
      const p = await fetch('/api/admin/pinned-accounts', { cache: 'no-store' }).then((x) => x.json());
      if (p?.data) setPins(p.data);
    } catch (e: any) {
      flash(e?.message ?? 'pin ไม่สำเร็จ', 'error');
    } finally {
      setBusy(false);
    }
  };

  const removePin = async (chatId: string, bankAccountId: string, label: string) => {
    if (!confirm(`เอา "${label}" ออกจาก pin?`)) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/pinned-accounts?chatId=${encodeURIComponent(chatId)}&bankAccountId=${encodeURIComponent(bankAccountId)}`,
        { method: 'DELETE' }
      );
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      setPins((prev) => prev.filter((p) => !(p.chatId === chatId && p.bankAccountId === bankAccountId)));
      flash('เอาออกแล้ว', 'ok');
    } catch (e: any) {
      flash(e?.message ?? 'ลบไม่สำเร็จ', 'error');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  const inputClass =
    'w-full rounded-md border border-[color:var(--border)] bg-black/40 px-2.5 py-2 text-sm text-[color:var(--text)] placeholder:text-[color:var(--muted)] focus:border-emerald-500/60 focus:outline-none';

  return (
    <div className="glass reveal accent-top p-5" style={{ animationDelay: '120ms' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-[color:var(--text)]">
          <span className="text-lg">🎛️</span> Admin Console
          {settings && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                settings.botEnabled
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-rose-500/15 text-rose-300'
              }`}
            >
              {settings.botEnabled ? '🟢 บอททำงาน' : '🔴 บอทหยุด'}
            </span>
          )}
        </h2>
        <button
          onClick={logout}
          className="rounded-full border border-[color:var(--border)] bg-white/5 px-3 py-1.5 text-xs text-[color:var(--muted)] backdrop-blur transition hover:bg-white/10 hover:text-[color:var(--text)]"
        >
          ออกจากระบบ
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              tab === t.id
                ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                : 'border border-[color:var(--border)] bg-white/5 text-[color:var(--muted)] hover:bg-white/10 hover:text-[color:var(--text)]'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {/* --- Bot control --- */}
        {tab === 'bot' && (
          <div className="rounded-xl border border-[color:var(--border)] bg-white/[0.02] p-4">
            <p className="text-xs text-[color:var(--muted)]">
              หยุดบอทชั่วคราว — บอทจะไม่ประมวลผลสลิปหรือคำสั่งใด ๆ และตอบข้อความแจ้งปิดปรับปรุงแทน
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={() => toggleBot(false)}
                disabled={busy || settings?.botEnabled === false}
                className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-5 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-40"
              >
                🛑 หยุดบอท
              </button>
              <button
                onClick={() => toggleBot(true)}
                disabled={busy || settings?.botEnabled === true}
                className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
              >
                ▶ เริ่มบอท
              </button>
              <button
                onClick={loadAll}
                disabled={busy}
                className="rounded-xl border border-[color:var(--border)] bg-white/5 px-4 py-3 text-sm text-[color:var(--text)] transition hover:bg-white/10 disabled:opacity-40"
              >
                🔄 ดึงข้อมูลใหม่
              </button>
            </div>
          </div>
        )}

        {/* --- Rate --- */}
        {tab === 'rate' && (
          <div className="rounded-xl border border-[color:var(--border)] bg-white/[0.02] p-4">
            {rate && (
              <p className="mb-3 text-xs text-[color:var(--muted)]">
                เรทปัจจุบัน — ขาย{' '}
                <span className="font-semibold text-emerald-400">{rate.sellRate}</span> · ตลาด{' '}
                <span className="font-semibold text-cyan-400">{rate.marketRate}</span>
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs">
                <span className="mb-1 block text-[color:var(--muted)]">เรทขาย (฿/USDT)</span>
                <input
                  value={sellInput}
                  onChange={(e) => setSellInput(e.target.value)}
                  inputMode="decimal"
                  placeholder="35.50"
                  className={inputClass}
                />
              </label>
              <label className="text-xs">
                <span className="mb-1 block text-[color:var(--muted)]">เรทตลาด (฿/USDT)</span>
                <input
                  value={marketInput}
                  onChange={(e) => setMarketInput(e.target.value)}
                  inputMode="decimal"
                  placeholder="34.80"
                  className={inputClass}
                />
              </label>
            </div>
            <button
              onClick={saveRate}
              disabled={busy || !sellInput || !marketInput}
              className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
            >
              💾 บันทึกเรทใหม่
            </button>
          </div>
        )}

        {/* --- Admins --- */}
        {tab === 'admins' && (
          <div className="rounded-xl border border-[color:var(--border)] bg-white/[0.02] p-4">
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
                placeholder="ชื่อผู้ดูแล"
                className={inputClass}
              />
              <input
                value={newAdminTgId}
                onChange={(e) => setNewAdminTgId(e.target.value)}
                inputMode="numeric"
                placeholder="Telegram user ID"
                className={inputClass}
              />
              <button
                onClick={addAdmin}
                disabled={busy || !newAdminName.trim() || !newAdminTgId.trim()}
                className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
              >
                ＋ เพิ่ม
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-[color:var(--muted)]">
              หา Telegram user ID ได้จากการส่งข้อความหา @userinfobot
            </p>

            <div className="mt-4 space-y-1.5">
              {admins.length === 0 && (
                <p className="py-4 text-center text-sm text-[color:var(--muted)]">ยังไม่มีผู้ดูแล</p>
              )}
              {admins.map((a) => (
                <div
                  key={a.id}
                  className="row-glow flex items-center gap-3 rounded-lg border border-[color:var(--border)] bg-white/[0.02] px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[color:var(--text)]">{a.name}</div>
                    <div className="font-mono text-[10px] text-[color:var(--muted)]">
                      TG {a.telegramUserId}
                    </div>
                  </div>
                  <span className="tabular-nums text-xs text-cyan-400">
                    {a.holdingUsdt.toLocaleString('th-TH')} USDT
                  </span>
                  <button
                    onClick={() => removeAdmin(a.id, a.name)}
                    disabled={busy}
                    className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-40"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- Pinned accounts --- */}
        {tab === 'pins' && (
          <div className="rounded-xl border border-[color:var(--border)] bg-white/[0.02] p-4">
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                value={pinChatId}
                onChange={(e) => setPinChatId(e.target.value)}
                inputMode="numeric"
                placeholder="Chat ID ของกลุ่ม"
                className={inputClass}
              />
              <select
                value={pinBankId}
                onChange={(e) => setPinBankId(e.target.value)}
                className={inputClass}
              >
                <option value="">— เลือกบัญชี —</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label} · {b.bankName} ····{b.last4}
                  </option>
                ))}
              </select>
              <button
                onClick={addPin}
                disabled={busy || !pinChatId.trim() || !pinBankId}
                className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
              >
                📌 Pin
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-[color:var(--muted)]">
              pin ได้สูงสุด 3 บัญชีต่อกลุ่มต่อวัน · แสดงเฉพาะที่ pin ไว้วันนี้
            </p>

            <div className="mt-4 space-y-1.5">
              {pins.length === 0 && (
                <p className="py-4 text-center text-sm text-[color:var(--muted)]">
                  ยังไม่มีบัญชีที่ pin วันนี้
                </p>
              )}
              {pins.map((p) => (
                <div
                  key={`${p.chatId}-${p.bankAccountId}`}
                  className="row-glow flex items-center gap-3 rounded-lg border border-[color:var(--border)] bg-white/[0.02] px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[color:var(--text)]">{p.label}</div>
                    <div className="font-mono text-[10px] text-[color:var(--muted)]">
                      {p.bankName} ····{p.last4} · chat {p.chatId}
                    </div>
                  </div>
                  <button
                    onClick={() => removePin(p.chatId, p.bankAccountId, p.label)}
                    disabled={busy}
                    className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-40"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  );
}
