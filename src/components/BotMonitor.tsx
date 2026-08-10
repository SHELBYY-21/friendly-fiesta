'use client';

// ============================================================
// BotMonitor — Bot activity, message editor, AI-powered settings
// Tabs: Activity | Messages | Settings | AI Insights
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// ─── Types ───────────────────────────────────────────────────
interface BotActivity {
  id: string;
  event: string;
  detail: string;
  ts: string;
  level: 'info' | 'warn' | 'error' | 'success';
}

interface BotMessage {
  key: string;
  label: string;
  value: string;
  description?: string;
}

interface ApiEndpoints {
  webhookUrl: string;
  ocrApiUrl: string;
  binanceApiUrl: string;
  telegramApiUrl: string;
}

interface ResponseTemplates {
  successPrefix: string;
  errorPrefix: string;
  waitingPrefix: string;
  duplicatePrefix: string;
}

interface ErrorThresholds {
  ocrMinConfidence: number;
  maxRetries: number;
  timeoutMs: number;
  maxErrorsPerHour: number;
}

interface RateLimits {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  cooldownSeconds: number;
  burstLimit: number;
}

interface BotSettings {
  botEnabled: boolean;
  maintenanceMessage: string;
  apiEndpoints: ApiEndpoints | null;
  responseTemplates: ResponseTemplates | null;
  errorThresholds: ErrorThresholds | null;
  rateLimits: RateLimits | null;
  updatedAt: string | null;
}

type Tab = 'activity' | 'messages' | 'settings' | 'ai' | 'metrics';

const LEVEL_META = {
  info:    { dot: 'bg-cyan-400',    badge: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30' },
  warn:    { dot: 'bg-amber-400',   badge: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  error:   { dot: 'bg-rose-500',    badge: 'text-rose-300 bg-rose-500/10 border-rose-500/30' },
  success: { dot: 'bg-emerald-400', badge: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
};

const EDITABLE_MESSAGES: BotMessage[] = [
  { key: 'welcome',     label: '👋 ข้อความต้อนรับ',        value: 'ยินดีต้อนรับสู่ CE Vault Bot! กรุณาส่งสลิปโอนเงินเพื่อเริ่มต้น', description: 'แสดงเมื่อผู้ใช้เริ่มใช้งานครั้งแรก' },
  { key: 'maintenance', label: '🔧 ข้อความปิดปรับปรุง',    value: 'ระบบกำลังปิดปรับปรุงชั่วคราว กรุณาลองใหม่ภายหลัง',          description: 'แสดงเมื่อบอทถูกปิด' },
  { key: 'ocr_fail',   label: '❌ OCR ล้มเหลว',            value: 'ไม่สามารถอ่านสลิปได้ กรุณาส่งใหม่อีกครั้ง',                  description: 'แสดงเมื่ออ่านสลิปไม่ได้' },
  { key: 'success',    label: '✅ ธุรกรรมสำเร็จ',          value: 'รับสลิปเรียบร้อยแล้ว! ระบบกำลังดำเนินการ',                  description: 'แสดงเมื่อธุรกรรมสำเร็จ' },
  { key: 'duplicate',  label: '⚠️ สลิปซ้ำ',               value: 'พบสลิปซ้ำในระบบ กรุณาตรวจสอบอีกครั้ง',                     description: 'แสดงเมื่อพบสลิปซ้ำ' },
];

const STORAGE_KEY = 'botMonitor.messages.v1';

const DEFAULT_API_ENDPOINTS: ApiEndpoints = {
  webhookUrl: '/api/telegram/webhook',
  ocrApiUrl: 'https://api.ocr.space/parse/image',
  binanceApiUrl: 'https://api.binance.com/api/v3/ticker/price',
  telegramApiUrl: 'https://api.telegram.org',
};

const DEFAULT_RESPONSE_TEMPLATES: ResponseTemplates = {
  successPrefix: '✅',
  errorPrefix: '❌',
  waitingPrefix: '⏳',
  duplicatePrefix: '⚠️',
};

const DEFAULT_ERROR_THRESHOLDS: ErrorThresholds = {
  ocrMinConfidence: 85,
  maxRetries: 3,
  timeoutMs: 10000,
  maxErrorsPerHour: 20,
};

const DEFAULT_RATE_LIMITS: RateLimits = {
  maxRequestsPerMinute: 30,
  maxRequestsPerHour: 500,
  cooldownSeconds: 5,
  burstLimit: 10,
};

// ─── Mock activity generator ─────────────────────────────────
function generateActivity(): BotActivity[] {
  const now = Date.now();
  return [
    { id: '1', event: 'Webhook received',   detail: 'THB_DEPOSIT slip from chat #12345',  ts: new Date(now - 12000).toISOString(), level: 'success' },
    { id: '2', event: 'OCR processed',      detail: 'Amount: ฿3,200 · Confidence: 97%',   ts: new Date(now - 25000).toISOString(), level: 'info' },
    { id: '3', event: 'Rate fetched',       detail: 'USDT/THB = 34.82 (Binance)',          ts: new Date(now - 60000).toISOString(), level: 'info' },
    { id: '4', event: 'OCR low confidence', detail: 'Confidence: 72% — manual review',    ts: new Date(now - 120000).toISOString(), level: 'warn' },
    { id: '5', event: 'Webhook received',   detail: 'THB_DEPOSIT slip from chat #99001',  ts: new Date(now - 180000).toISOString(), level: 'success' },
    { id: '6', event: 'Telegram error',     detail: 'sendMessage 429 Too Many Requests',  ts: new Date(now - 300000).toISOString(), level: 'error' },
    { id: '7', event: 'Bot gate checked',   detail: 'bot_enabled = true',                 ts: new Date(now - 420000).toISOString(), level: 'info' },
    { id: '8', event: 'Webhook received',   detail: 'THB_DEPOSIT slip from chat #77200',  ts: new Date(now - 600000).toISOString(), level: 'success' },
  ];
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)  return `${diff}s ที่แล้ว`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ที่แล้ว`;
  return `${Math.floor(diff / 3600)}h ที่แล้ว`;
}

// ─── Sub-components ──────────────────────────────────────────

function ActivityFeed({ activities }: { activities: BotActivity[] }) {
  return (
    <div className="space-y-2">
      {activities.map((a) => {
        const meta = LEVEL_META[a.level];
        return (
          <div key={a.id} className="flex items-start gap-3 rounded-xl border border-[color:var(--border)] bg-white/[0.02] px-3 py-2.5">
            <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${meta.dot}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-[color:var(--text)]">{a.event}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${meta.badge}`}>
                  {a.level}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[color:var(--muted)]">{a.detail}</p>
            </div>
            <span className="flex-shrink-0 text-[10px] tabular-nums text-[color:var(--muted)]">{relativeTime(a.ts)}</span>
          </div>
        );
      })}
    </div>
  );
}

function MessageEditor() {
  const [messages, setMessages] = useState<BotMessage[]>(EDITABLE_MESSAGES);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        setMessages((prev) => prev.map((m) => ({ ...m, value: parsed[m.key] ?? m.value })));
      }
    } catch { /* ignore */ }
  }, []);

  const save = (key: string, value: string) => {
    setMessages((prev) => prev.map((m) => (m.key === key ? { ...m, value } : m)));
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const existing = raw ? JSON.parse(raw) : {};
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, [key]: value }));
    } catch { /* ignore */ }
    setSaved(key);
    setEditingKey(null);
    setTimeout(() => setSaved(null), 2000);
  };

  const improveWithAi = async (key: string, current: string) => {
    setAiLoading(key);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `ปรับปรุงข้อความบอทนี้ให้กระชับ เป็นมิตร และชัดเจนขึ้น (ภาษาไทย ไม่เกิน 2 ประโยค):\n\n"${current}"\n\nตอบเฉพาะข้อความที่ปรับปรุงแล้ว ไม่ต้องมีคำอธิบาย`,
            },
          ],
        }),
      });
      const json = await res.json();
      const improved = json?.content?.[0]?.text ?? json?.message ?? json?.text ?? '';
      if (improved) {
        setMessages((prev) => prev.map((m) => (m.key === key ? { ...m, value: improved.trim() } : m)));
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          const existing = raw ? JSON.parse(raw) : {};
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, [key]: improved.trim() }));
        } catch { /* ignore */ }
        setSaved(key);
        setTimeout(() => setSaved(null), 2000);
      }
    } catch { /* ignore */ }
    setAiLoading(null);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-[color:var(--muted)]">
        แก้ไขข้อความที่บอทส่งให้ผู้ใช้ · บันทึกใน localStorage · กด ✨ AI เพื่อให้ Anthropic ปรับปรุงอัตโนมัติ
      </p>
      {messages.map((m) => {
        const isEditing = editingKey === m.key;
        const isSaved = saved === m.key;
        const isAiLoading = aiLoading === m.key;
        return (
          <div key={m.key} className="rounded-xl border border-[color:var(--border)] bg-white/[0.02] p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-[color:var(--text)]">{m.label}</p>
                {m.description && <p className="text-[10px] text-[color:var(--muted)]">{m.description}</p>}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => improveWithAi(m.key, m.value)}
                  disabled={isAiLoading}
                  title="ให้ AI ปรับปรุงข้อความ"
                  className="rounded-md border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-[10px] font-medium text-violet-300 transition hover:bg-violet-500/20 disabled:opacity-50"
                >
                  {isAiLoading ? '⏳' : '✨ AI'}
                </button>
                <button
                  onClick={() => { setEditingKey(isEditing ? null : m.key); setDraft(m.value); }}
                  className="rounded-md border border-[color:var(--border)] bg-white/5 px-2 py-1 text-[10px] text-[color:var(--text)] transition hover:bg-white/10"
                >
                  {isEditing ? '✕' : '✎ แก้ไข'}
                </button>
              </div>
            </div>
            {isEditing ? (
              <div className="mt-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-emerald-500/30 bg-black/40 px-3 py-2 text-sm text-[color:var(--text)] placeholder:text-[color:var(--muted)] focus:border-emerald-500/60 focus:outline-none"
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    onClick={() => setEditingKey(null)}
                    className="rounded-md border border-[color:var(--border)] bg-white/5 px-3 py-1 text-xs text-[color:var(--text)] transition hover:bg-white/10"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => save(m.key, draft)}
                    className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                  >
                    💾 บันทึก
                  </button>
                </div>
              </div>
            ) : (
              <p className={`mt-2 rounded-lg bg-black/20 px-3 py-2 text-sm ${isSaved ? 'text-emerald-300' : 'text-[color:var(--text)]'}`}>
                {isSaved ? '✓ บันทึกแล้ว' : m.value}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Settings sub-section components ─────────────────────────

interface SectionFeedbackProps {
  feedback: { ok: boolean; text: string } | null;
}
function SectionFeedback({ feedback }: SectionFeedbackProps) {
  if (!feedback) return null;
  return (
    <span className={`text-xs ${feedback.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
      {feedback.text}
    </span>
  );
}

function SettingsPanel() {
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Local draft states
  const [maintenanceMsg, setMaintenanceMsg] = useState('');
  const [apiEndpoints, setApiEndpoints] = useState<ApiEndpoints>(DEFAULT_API_ENDPOINTS);
  const [responseTemplates, setResponseTemplates] = useState<ResponseTemplates>(DEFAULT_RESPONSE_TEMPLATES);
  const [errorThresholds, setErrorThresholds] = useState<ErrorThresholds>(DEFAULT_ERROR_THRESHOLDS);
  const [rateLimits, setRateLimits] = useState<RateLimits>(DEFAULT_RATE_LIMITS);

  // Per-section feedback
  const [feedback, setFeedback] = useState<Record<string, { ok: boolean; text: string } | null>>({});

  // Realtime sync state
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [remoteFlash, setRemoteFlash] = useState(false);
  const isSavingRef = useRef(false);

  const showFeedback = (section: string, ok: boolean, text: string) => {
    setFeedback((f) => ({ ...f, [section]: { ok, text } }));
    setTimeout(() => setFeedback((f) => ({ ...f, [section]: null })), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings', { cache: 'no-store' });
      const json = await res.json();
      if (json.data) {
        const d = json.data as BotSettings;
        setSettings(d);
        setMaintenanceMsg(d.maintenanceMessage ?? '');
        if (d.apiEndpoints) setApiEndpoints({ ...DEFAULT_API_ENDPOINTS, ...d.apiEndpoints });
        if (d.responseTemplates) setResponseTemplates({ ...DEFAULT_RESPONSE_TEMPLATES, ...d.responseTemplates });
        if (d.errorThresholds) setErrorThresholds({ ...DEFAULT_ERROR_THRESHOLDS, ...d.errorThresholds });
        if (d.rateLimits) setRateLimits({ ...DEFAULT_RATE_LIMITS, ...d.rateLimits });
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  // ── Supabase Realtime subscription ──────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('settings-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_settings' },
        (payload) => {
          // Skip if this session is the one saving (avoid double-reload)
          if (isSavingRef.current) return;

          const row = payload.new as { key: string; value: any; updated_at: string } | undefined;
          if (!row) return;

          setLastSyncedAt(row.updated_at ?? new Date().toISOString());

          // Flash indicator for remote update
          setRemoteFlash(true);
          setTimeout(() => setRemoteFlash(false), 2000);

          // Apply the changed key directly without a full reload
          const { key, value } = row;
          setSettings((prev) => {
            if (!prev) return prev;
            const next = { ...prev, updatedAt: row.updated_at };
            if (key === 'bot_enabled')          next.botEnabled = value !== false;
            if (key === 'maintenance_message')  next.maintenanceMessage = value ?? '';
            if (key === 'api_endpoints')        next.apiEndpoints = value;
            if (key === 'response_templates')   next.responseTemplates = value;
            if (key === 'error_thresholds')     next.errorThresholds = value;
            if (key === 'rate_limits')          next.rateLimits = value;
            return next;
          });

          // Sync draft fields for non-focused sections
          if (key === 'maintenance_message') setMaintenanceMsg(value ?? '');
          if (key === 'api_endpoints' && value)        setApiEndpoints({ ...DEFAULT_API_ENDPOINTS, ...value });
          if (key === 'response_templates' && value)   setResponseTemplates({ ...DEFAULT_RESPONSE_TEMPLATES, ...value });
          if (key === 'error_thresholds' && value)     setErrorThresholds({ ...DEFAULT_ERROR_THRESHOLDS, ...value });
          if (key === 'rate_limits' && value)          setRateLimits({ ...DEFAULT_RATE_LIMITS, ...value });
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = async (section: string, key: string, value: any) => {
    setSaving(section);
    isSavingRef.current = true;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      showFeedback(section, true, 'บันทึกแล้ว ✓');
      await load();
    } catch (e: any) {
      showFeedback(section, false, e.message ?? 'เกิดข้อผิดพลาด');
    }
    setSaving(null);
    // Small delay so the realtime event (which arrives ~50ms after upsert) is ignored
    setTimeout(() => { isSavingRef.current = false; }, 500);
  };

  if (loading) return (
    <div className="py-8 text-center text-sm text-[color:var(--muted)] animate-pulse">กำลังโหลดการตั้งค่า…</div>
  );

  return (
    <div className="space-y-4">

      {/* ── Realtime sync badge ── */}
      <div className={`flex items-center justify-between rounded-xl border px-3 py-2 transition-colors duration-500 ${
        remoteFlash
          ? 'border-cyan-500/60 bg-cyan-500/10' :'border-[color:var(--border)] bg-white/[0.02]'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full transition-colors ${realtimeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
          <span className="text-xs text-[color:var(--muted)]">
            {realtimeConnected ? 'Realtime sync เชื่อมต่อแล้ว' : 'กำลังเชื่อมต่อ Realtime…'}
          </span>
          {remoteFlash && (
            <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-medium text-cyan-300 animate-pulse">
              ⚡ อัปเดตจากเซสชันอื่น
            </span>
          )}
        </div>
        {lastSyncedAt && (
          <span className="text-[10px] text-[color:var(--muted)] tabular-nums">
            sync {new Date(lastSyncedAt).toLocaleTimeString('th-TH')}
          </span>
        )}
      </div>

      {/* ── Bot toggle ── */}
      <div className="rounded-xl border border-[color:var(--border)] bg-white/[0.02] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[color:var(--text)]">🤖 สถานะบอท</p>
            <p className="text-xs text-[color:var(--muted)]">เปิด/ปิดการรับ webhook จาก Telegram</p>
          </div>
          <button
            onClick={() => patch('bot_toggle', 'bot_enabled', !settings?.botEnabled)}
            disabled={saving === 'bot_toggle'}
            className={`relative h-7 w-12 rounded-full border transition-colors ${
              settings?.botEnabled
                ? 'border-emerald-500/60 bg-emerald-500/20' : 'border-[color:var(--border)] bg-white/5'
            }`}
          >
            <span className={`absolute top-0.5 h-6 w-6 rounded-full shadow transition-all ${
              settings?.botEnabled
                ? 'left-[calc(100%-26px)] bg-emerald-400'
                : 'left-0.5 bg-gray-500'
            }`} />
          </button>
        </div>
        <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
          settings?.botEnabled
            ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${settings?.botEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
          {settings?.botEnabled ? 'บอทกำลังทำงาน' : 'บอทหยุดทำงาน'}
        </div>
      </div>

      {/* ── Maintenance message ── */}
      <div className="rounded-xl border border-[color:var(--border)] bg-white/[0.02] p-4">
        <p className="text-sm font-semibold text-[color:var(--text)]">🔧 ข้อความปิดปรับปรุง</p>
        <p className="mb-2 text-xs text-[color:var(--muted)]">แสดงเมื่อบอทถูกปิด</p>
        <textarea
          value={maintenanceMsg}
          onChange={(e) => setMaintenanceMsg(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-[color:var(--border)] bg-black/40 px-3 py-2 text-sm text-[color:var(--text)] focus:border-emerald-500/60 focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <SectionFeedback feedback={feedback['maintenance'] ?? null} />
          <div className="ml-auto">
            <button
              onClick={() => patch('maintenance', 'maintenance_message', maintenanceMsg)}
              disabled={saving === 'maintenance'}
              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {saving === 'maintenance' ? '⏳ กำลังบันทึก…' : '💾 บันทึก'}
            </button>
          </div>
        </div>
      </div>

      {/* ── API Endpoint URLs ── */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.03] p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-base">🔗</span>
          <div>
            <p className="text-sm font-semibold text-[color:var(--text)]">API Endpoint URLs</p>
            <p className="text-[10px] text-[color:var(--muted)]">URL ของ API ที่บอทใช้งาน · ซิงค์กับ Supabase</p>
          </div>
        </div>
        <div className="space-y-2.5">
          {(
            [
              { field: 'webhookUrl' as keyof ApiEndpoints, label: 'Webhook URL', placeholder: '/api/telegram/webhook' },
              { field: 'ocrApiUrl' as keyof ApiEndpoints, label: 'OCR API URL', placeholder: 'https://api.ocr.space/parse/image' },
              { field: 'binanceApiUrl' as keyof ApiEndpoints, label: 'Binance API URL', placeholder: 'https://api.binance.com/api/v3/ticker/price' },
              { field: 'telegramApiUrl' as keyof ApiEndpoints, label: 'Telegram API URL', placeholder: 'https://api.telegram.org' },
            ] as const
          ).map(({ field, label, placeholder }) => (
            <div key={field}>
              <label className="mb-1 block text-[10px] font-medium text-[color:var(--muted)] uppercase tracking-wide">{label}</label>
              <input
                type="text"
                value={apiEndpoints[field]}
                onChange={(e) => setApiEndpoints((prev) => ({ ...prev, [field]: e.target.value }))}
                placeholder={placeholder}
                className="w-full rounded-lg border border-[color:var(--border)] bg-black/40 px-3 py-2 font-mono text-xs text-[color:var(--text)] placeholder:text-[color:var(--muted)] focus:border-blue-500/60 focus:outline-none"
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <SectionFeedback feedback={feedback['api_endpoints'] ?? null} />
          <button
            onClick={() => patch('api_endpoints', 'api_endpoints', apiEndpoints)}
            disabled={saving === 'api_endpoints'}
            className="ml-auto rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-300 transition hover:bg-blue-500/20 disabled:opacity-50"
          >
            {saving === 'api_endpoints' ? '⏳ กำลังบันทึก…' : '💾 บันทึก Endpoints'}
          </button>
        </div>
      </div>

      {/* ── Response Templates ── */}
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.03] p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-base">✉️</span>
          <div>
            <p className="text-sm font-semibold text-[color:var(--text)]">Response Templates</p>
            <p className="text-[10px] text-[color:var(--muted)]">Prefix emoji/ข้อความนำหน้าแต่ละประเภทการตอบกลับ</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {(
            [
              { field: 'successPrefix' as keyof ResponseTemplates, label: '✅ Success Prefix' },
              { field: 'errorPrefix' as keyof ResponseTemplates, label: '❌ Error Prefix' },
              { field: 'waitingPrefix' as keyof ResponseTemplates, label: '⏳ Waiting Prefix' },
              { field: 'duplicatePrefix' as keyof ResponseTemplates, label: '⚠️ Duplicate Prefix' },
            ] as const
          ).map(({ field, label }) => (
            <div key={field}>
              <label className="mb-1 block text-[10px] font-medium text-[color:var(--muted)] uppercase tracking-wide">{label}</label>
              <input
                type="text"
                value={responseTemplates[field]}
                onChange={(e) => setResponseTemplates((prev) => ({ ...prev, [field]: e.target.value }))}
                className="w-full rounded-lg border border-[color:var(--border)] bg-black/40 px-3 py-2 text-sm text-[color:var(--text)] focus:border-violet-500/60 focus:outline-none"
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <SectionFeedback feedback={feedback['response_templates'] ?? null} />
          <button
            onClick={() => patch('response_templates', 'response_templates', responseTemplates)}
            disabled={saving === 'response_templates'}
            className="ml-auto rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300 transition hover:bg-violet-500/20 disabled:opacity-50"
          >
            {saving === 'response_templates' ? '⏳ กำลังบันทึก…' : '💾 บันทึก Templates'}
          </button>
        </div>
      </div>

      {/* ── Error Handling Thresholds ── */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-base">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-[color:var(--text)]">Error Handling Thresholds</p>
            <p className="text-[10px] text-[color:var(--muted)]">ค่า threshold สำหรับจัดการข้อผิดพลาด · ซิงค์กับ Supabase</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="mb-1 block text-[10px] font-medium text-[color:var(--muted)] uppercase tracking-wide">
              OCR Min Confidence (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={50}
                max={99}
                value={errorThresholds.ocrMinConfidence}
                onChange={(e) => setErrorThresholds((prev) => ({ ...prev, ocrMinConfidence: Number(e.target.value) }))}
                className="flex-1 accent-amber-400"
              />
              <span className="w-8 text-right text-xs font-mono font-semibold text-amber-300">{errorThresholds.ocrMinConfidence}</span>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium text-[color:var(--muted)] uppercase tracking-wide">
              Max Retries
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={errorThresholds.maxRetries}
              onChange={(e) => setErrorThresholds((prev) => ({ ...prev, maxRetries: Number(e.target.value) }))}
              className="w-full rounded-lg border border-[color:var(--border)] bg-black/40 px-3 py-2 text-sm text-[color:var(--text)] focus:border-amber-500/60 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium text-[color:var(--muted)] uppercase tracking-wide">
              Timeout (ms)
            </label>
            <input
              type="number"
              min={1000}
              max={60000}
              step={500}
              value={errorThresholds.timeoutMs}
              onChange={(e) => setErrorThresholds((prev) => ({ ...prev, timeoutMs: Number(e.target.value) }))}
              className="w-full rounded-lg border border-[color:var(--border)] bg-black/40 px-3 py-2 text-sm text-[color:var(--text)] focus:border-amber-500/60 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium text-[color:var(--muted)] uppercase tracking-wide">
              Max Errors / Hour
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={errorThresholds.maxErrorsPerHour}
              onChange={(e) => setErrorThresholds((prev) => ({ ...prev, maxErrorsPerHour: Number(e.target.value) }))}
              className="w-full rounded-lg border border-[color:var(--border)] bg-black/40 px-3 py-2 text-sm text-[color:var(--text)] focus:border-amber-500/60 focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <SectionFeedback feedback={feedback['error_thresholds'] ?? null} />
          <button
            onClick={() => patch('error_thresholds', 'error_thresholds', errorThresholds)}
            disabled={saving === 'error_thresholds'}
            className="ml-auto rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-50"
          >
            {saving === 'error_thresholds' ? '⏳ กำลังบันทึก…' : '💾 บันทึก Thresholds'}
          </button>
        </div>
      </div>

      {/* ── Rate Limits ── */}
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.03] p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-base">🚦</span>
          <div>
            <p className="text-sm font-semibold text-[color:var(--text)]">Rate Limits</p>
            <p className="text-[10px] text-[color:var(--muted)]">จำกัดอัตราการรับ request · ป้องกัน spam · ซิงค์กับ Supabase</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="mb-1 block text-[10px] font-medium text-[color:var(--muted)] uppercase tracking-wide">
              Max Req / Minute
            </label>
            <input
              type="number"
              min={1}
              max={300}
              value={rateLimits.maxRequestsPerMinute}
              onChange={(e) => setRateLimits((prev) => ({ ...prev, maxRequestsPerMinute: Number(e.target.value) }))}
              className="w-full rounded-lg border border-[color:var(--border)] bg-black/40 px-3 py-2 text-sm text-[color:var(--text)] focus:border-rose-500/60 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium text-[color:var(--muted)] uppercase tracking-wide">
              Max Req / Hour
            </label>
            <input
              type="number"
              min={1}
              max={10000}
              value={rateLimits.maxRequestsPerHour}
              onChange={(e) => setRateLimits((prev) => ({ ...prev, maxRequestsPerHour: Number(e.target.value) }))}
              className="w-full rounded-lg border border-[color:var(--border)] bg-black/40 px-3 py-2 text-sm text-[color:var(--text)] focus:border-rose-500/60 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium text-[color:var(--muted)] uppercase tracking-wide">
              Cooldown (seconds)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={60}
                value={rateLimits.cooldownSeconds}
                onChange={(e) => setRateLimits((prev) => ({ ...prev, cooldownSeconds: Number(e.target.value) }))}
                className="flex-1 accent-rose-400"
              />
              <span className="w-8 text-right text-xs font-mono font-semibold text-rose-300">{rateLimits.cooldownSeconds}s</span>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium text-[color:var(--muted)] uppercase tracking-wide">
              Burst Limit
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={rateLimits.burstLimit}
              onChange={(e) => setRateLimits((prev) => ({ ...prev, burstLimit: Number(e.target.value) }))}
              className="w-full rounded-lg border border-[color:var(--border)] bg-black/40 px-3 py-2 text-sm text-[color:var(--text)] focus:border-rose-500/60 focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <SectionFeedback feedback={feedback['rate_limits'] ?? null} />
          <button
            onClick={() => patch('rate_limits', 'rate_limits', rateLimits)}
            disabled={saving === 'rate_limits'}
            className="ml-auto rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
          >
            {saving === 'rate_limits' ? '⏳ กำลังบันทึก…' : '💾 บันทึก Rate Limits'}
          </button>
        </div>
      </div>

      {settings?.updatedAt && (
        <p className="text-right text-[10px] text-[color:var(--muted)]">
          อัปเดตล่าสุด: {new Date(settings.updatedAt).toLocaleString('th-TH')}
        </p>
      )}
    </div>
  );
}

// ─── Metrics Panel ────────────────────────────────────────────

interface BotMetrics {
  errorRate: number;
  avgResponseMs: number;
  rateLimitPct: number;
  uptimeSeconds: number;
  totalRequests: number;
  totalErrors: number;
  updatedAt: string | null;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function MetricGauge({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[color:var(--muted)]">{label}</span>
        <span className={`text-xs font-mono font-semibold ${color}`}>{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            pct > 80 ? 'bg-rose-400' : pct > 60 ? 'bg-amber-400' : 'bg-emerald-400'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MetricsPanel({ errorThresholds, rateLimits }: { errorThresholds: ErrorThresholds | null; rateLimits: RateLimits | null }) {
  const [metrics, setMetrics] = useState<BotMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastFlash, setLastFlash] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/bot-metrics', { cache: 'no-store' });
      const json = await res.json();
      if (json.data) {
        const d = json.data;
        setMetrics({
          errorRate: Number(d.error_rate ?? 0),
          avgResponseMs: Number(d.avg_response_ms ?? 0),
          rateLimitPct: Number(d.rate_limit_pct ?? 0),
          uptimeSeconds: Number(d.uptime_seconds ?? 0),
          totalRequests: Number(d.total_requests ?? 0),
          totalErrors: Number(d.total_errors ?? 0),
          updatedAt: d.updated_at ?? null,
        });
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Supabase Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('bot-metrics-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bot_metrics' },
        (payload) => {
          const row = payload.new as any;
          if (!row) return;
          setMetrics({
            errorRate: Number(row.error_rate ?? 0),
            avgResponseMs: Number(row.avg_response_ms ?? 0),
            rateLimitPct: Number(row.rate_limit_pct ?? 0),
            uptimeSeconds: Number(row.uptime_seconds ?? 0),
            totalRequests: Number(row.total_requests ?? 0),
            totalErrors: Number(row.total_errors ?? 0),
            updatedAt: row.updated_at ?? null,
          });
          setLastFlash(true);
          setTimeout(() => setLastFlash(false), 1500);
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  const maxErrorsPerHour = errorThresholds?.maxErrorsPerHour ?? 20;
  const maxReqPerMin = rateLimits?.maxRequestsPerMinute ?? 30;

  // Derived threshold comparisons
  const errorRateThreshold = errorThresholds ? (maxErrorsPerHour / Math.max(1, (metrics?.totalRequests ?? 1))) * 100 : 5;
  const errorRateExceeded = (metrics?.errorRate ?? 0) > errorRateThreshold;
  const responseTimeExceeded = (metrics?.avgResponseMs ?? 0) > (errorThresholds?.timeoutMs ?? 10000) * 0.7;
  const rateLimitWarning = (metrics?.rateLimitPct ?? 0) > 80;

  if (loading) return (
    <div className="py-8 text-center text-sm text-[color:var(--muted)] animate-pulse">กำลังโหลด Metrics…</div>
  );

  return (
    <div className="space-y-4">

      {/* Realtime badge */}
      <div className={`flex items-center justify-between rounded-xl border px-3 py-2 transition-colors duration-500 ${
        lastFlash ? 'border-cyan-500/60 bg-cyan-500/10' : 'border-[color:var(--border)] bg-white/[0.02]'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full transition-colors ${realtimeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
          <span className="text-xs text-[color:var(--muted)]">
            {realtimeConnected ? 'Realtime sync เชื่อมต่อแล้ว' : 'กำลังเชื่อมต่อ…'}
          </span>
          {lastFlash && (
            <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-medium text-cyan-300 animate-pulse">
              ⚡ อัปเดตสด
            </span>
          )}
        </div>
        {metrics?.updatedAt && (
          <span className="text-[10px] tabular-nums text-[color:var(--muted)]">
            {new Date(metrics.updatedAt).toLocaleTimeString('th-TH')}
          </span>
        )}
      </div>

      {/* KPI cards row */}
      <div className="grid grid-cols-2 gap-3">

        {/* Error Rate */}
        <div className={`rounded-xl border p-3 ${errorRateExceeded ? 'border-rose-500/40 bg-rose-500/5' : 'border-[color:var(--border)] bg-white/[0.02]'}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-[color:var(--muted)]">Error Rate</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${errorRateExceeded ? 'text-rose-300' : 'text-emerald-300'}`}>
                {(metrics?.errorRate ?? 0).toFixed(1)}%
              </p>
            </div>
            <span className="text-xl">{errorRateExceeded ? '🔴' : '🟢'}</span>
          </div>
          <div className="mt-2 space-y-1">
            <MetricGauge value={metrics?.errorRate ?? 0} max={20} color={errorRateExceeded ? 'text-rose-300' : 'text-emerald-300'} label="" />
            <p className="text-[10px] text-[color:var(--muted)]">
              Threshold: {errorRateThreshold.toFixed(1)}% · {metrics?.totalErrors ?? 0} errors / {metrics?.totalRequests ?? 0} req
            </p>
          </div>
          {errorRateExceeded && (
            <p className="mt-1.5 rounded-lg bg-rose-500/10 px-2 py-1 text-[10px] font-medium text-rose-300">
              ⚠️ เกิน threshold ({maxErrorsPerHour} errors/hr)
            </p>
          )}
        </div>

        {/* Avg Response Time */}
        <div className={`rounded-xl border p-3 ${responseTimeExceeded ? 'border-amber-500/40 bg-amber-500/5' : 'border-[color:var(--border)] bg-white/[0.02]'}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-[color:var(--muted)]">Avg Response</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${responseTimeExceeded ? 'text-amber-300' : 'text-cyan-300'}`}>
                {(metrics?.avgResponseMs ?? 0).toFixed(0)}
                <span className="text-sm font-normal ml-0.5">ms</span>
              </p>
            </div>
            <span className="text-xl">{responseTimeExceeded ? '🟡' : '🔵'}</span>
          </div>
          <div className="mt-2">
            <MetricGauge
              value={metrics?.avgResponseMs ?? 0}
              max={errorThresholds?.timeoutMs ?? 10000}
              color={responseTimeExceeded ? 'text-amber-300' : 'text-cyan-300'}
              label=""
            />
            <p className="mt-1 text-[10px] text-[color:var(--muted)]">
              Timeout: {(errorThresholds?.timeoutMs ?? 10000)}ms
            </p>
          </div>
          {responseTimeExceeded && (
            <p className="mt-1.5 rounded-lg bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-300">
              ⚠️ ใกล้ถึง timeout limit
            </p>
          )}
        </div>

        {/* Rate Limit Usage */}
        <div className={`rounded-xl border p-3 ${rateLimitWarning ? 'border-orange-500/40 bg-orange-500/5' : 'border-[color:var(--border)] bg-white/[0.02]'}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-[color:var(--muted)]">Rate Limit</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${rateLimitWarning ? 'text-orange-300' : 'text-violet-300'}`}>
                {(metrics?.rateLimitPct ?? 0).toFixed(1)}%
              </p>
            </div>
            <span className="text-xl">{rateLimitWarning ? '🟠' : '🟣'}</span>
          </div>
          <div className="mt-2">
            <MetricGauge
              value={metrics?.rateLimitPct ?? 0}
              max={100}
              color={rateLimitWarning ? 'text-orange-300' : 'text-violet-300'}
              label=""
            />
            <p className="mt-1 text-[10px] text-[color:var(--muted)]">
              Limit: {maxReqPerMin} req/min
            </p>
          </div>
          {rateLimitWarning && (
            <p className="mt-1.5 rounded-lg bg-orange-500/10 px-2 py-1 text-[10px] font-medium text-orange-300">
              ⚠️ Rate limit ใกล้เต็ม
            </p>
          )}
        </div>

        {/* Bot Uptime */}
        <div className="rounded-xl border border-[color:var(--border)] bg-white/[0.02] p-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-[color:var(--muted)]">Bot Uptime</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-300">
                {formatUptime(metrics?.uptimeSeconds ?? 0)}
              </p>
            </div>
            <span className="text-xl">⏱️</span>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-300">บอทกำลังทำงาน</span>
            </div>
            <p className="text-[10px] text-[color:var(--muted)]">
              Total: {(metrics?.totalRequests ?? 0).toLocaleString()} requests
            </p>
          </div>
        </div>
      </div>

      {/* Threshold summary */}
      <div className="rounded-xl border border-[color:var(--border)] bg-white/[0.02] p-3">
        <p className="mb-2 text-xs font-semibold text-[color:var(--text)]">📊 Threshold Summary</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[color:var(--muted)]">Error Rate vs Threshold</span>
            <span className={errorRateExceeded ? 'font-semibold text-rose-300' : 'text-emerald-300'}>
              {(metrics?.errorRate ?? 0).toFixed(1)}% / {errorRateThreshold.toFixed(1)}%
              {errorRateExceeded ? ' ❌' : ' ✓'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[color:var(--muted)]">Response Time vs Timeout</span>
            <span className={responseTimeExceeded ? 'font-semibold text-amber-300' : 'text-emerald-300'}>
              {(metrics?.avgResponseMs ?? 0).toFixed(0)}ms / {errorThresholds?.timeoutMs ?? 10000}ms
              {responseTimeExceeded ? ' ⚠️' : ' ✓'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[color:var(--muted)]">Rate Limit Usage</span>
            <span className={rateLimitWarning ? 'font-semibold text-orange-300' : 'text-emerald-300'}>
              {(metrics?.rateLimitPct ?? 0).toFixed(1)}% of {maxReqPerMin} req/min
              {rateLimitWarning ? ' ⚠️' : ' ✓'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[color:var(--muted)]">Max Errors / Hour</span>
            <span className="text-[color:var(--text)]">
              {metrics?.totalErrors ?? 0} / {maxErrorsPerHour}
            </span>
          </div>
        </div>
      </div>

      <p className="text-right text-[10px] text-[color:var(--muted)]">
        อัปเดตสดผ่าน Supabase Realtime · แก้ไข threshold ได้ที่แท็บ Settings
      </p>
    </div>
  );
}

function AiInsightsPanel() {
  const [insights, setInsights] = useState<{ title: string; body: string; type: 'tip' | 'alert' | 'info' }[]>([]);
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const generateInsights = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `คุณเป็น AI ที่ช่วยวิเคราะห์ระบบ fintech bot (CE Vault) ที่รับสลิปโอนเงิน THB แล้วแปลงเป็น USDT\n\nให้ 3 insights สั้น ๆ ในรูปแบบ JSON array:\n[\n  { "title": "...", "body": "...", "type": "tip|alert|info" }\n]\n\nเน้น: ประสิทธิภาพ OCR, ความปลอดภัย, การปรับปรุงประสบการณ์ผู้ใช้\nตอบเป็น JSON เท่านั้น ไม่มีข้อความอื่น`,
          }],
        }),
      });
      const json = await res.json();
      const text = json?.content?.[0]?.text ?? json?.message ?? json?.text ?? '[]';
      const parsed = JSON.parse(text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, ''));
      if (Array.isArray(parsed)) setInsights(parsed);
    } catch {
      setInsights([
        { title: 'OCR Accuracy', body: 'ตรวจสอบ confidence score ของ OCR ให้อยู่เหนือ 90% เพื่อลด false positive', type: 'tip' },
        { title: 'Rate Monitoring', body: 'ควร alert เมื่อ spread ระหว่าง sell rate กับ market rate เกิน 2%', type: 'alert' },
        { title: 'Bot Uptime', body: 'เพิ่ม health check endpoint ที่ ping ทุก 5 นาทีเพื่อ monitor uptime', type: 'info' },
      ]);
    }
    setLoading(false);
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatHistory((h) => [...h, { role: 'user', text: userMsg }]);
    setChatLoading(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'คุณเป็น AI assistant สำหรับระบบ CE Vault fintech bot ที่รับสลิปโอนเงิน THB แปลงเป็น USDT ตอบเป็นภาษาไทย กระชับ ตรงประเด็น' },
            ...chatHistory.map((m) => ({ role: m.role, content: m.text })),
            { role: 'user', content: userMsg },
          ],
        }),
      });
      const json = await res.json();
      const reply = json?.content?.[0]?.text ?? json?.message ?? json?.text ?? 'ไม่ได้รับคำตอบ';
      setChatHistory((h) => [...h, { role: 'assistant', text: reply }]);
    } catch {
      setChatHistory((h) => [...h, { role: 'assistant', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ AI' }]);
    }
    setChatLoading(false);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const INSIGHT_META = {
    tip:   { icon: '💡', color: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-300' },
    alert: { icon: '⚠️', color: 'border-amber-500/30 bg-amber-500/5 text-amber-300' },
    info:  { icon: 'ℹ️', color: 'border-violet-500/30 bg-violet-500/5 text-violet-300' },
  };

  return (
    <div className="space-y-4">
      {/* AI Insights */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-[color:var(--text)]">🧠 AI Insights</p>
          <button
            onClick={generateInsights}
            disabled={loading}
            className="rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300 transition hover:bg-violet-500/20 disabled:opacity-50"
          >
            {loading ? '⏳ กำลังวิเคราะห์…' : '✨ วิเคราะห์ระบบ'}
          </button>
        </div>
        {insights.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-white/[0.02] p-6 text-center text-sm text-[color:var(--muted)]">
            กด "วิเคราะห์ระบบ" เพื่อให้ Anthropic AI วิเคราะห์และให้คำแนะนำ
          </div>
        ) : (
          <div className="space-y-2">
            {insights.map((ins, i) => {
              const meta = INSIGHT_META[ins.type] ?? INSIGHT_META.info;
              return (
                <div key={i} className={`rounded-xl border p-3 ${meta.color}`}>
                  <p className="text-sm font-medium">{meta.icon} {ins.title}</p>
                  <p className="mt-1 text-xs opacity-80">{ins.body}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Chat */}
      <div className="rounded-xl border border-[color:var(--border)] bg-white/[0.02] p-3">
        <p className="mb-2 text-sm font-semibold text-[color:var(--text)]">💬 ถาม AI เกี่ยวกับระบบ</p>
        <div className="mb-3 max-h-48 space-y-2 overflow-y-auto">
          {chatHistory.length === 0 && (
            <p className="text-xs text-[color:var(--muted)]">ถามได้เลย เช่น "ทำไม OCR ถึงผิดพลาดบ่อย?" หรือ "แนะนำวิธีเพิ่ม security"</p>
          )}
          {chatHistory.map((m, i) => (
            <div key={i} className={`rounded-lg px-3 py-2 text-sm ${m.role === 'user' ? 'ml-8 bg-emerald-500/10 text-emerald-200' : 'mr-8 bg-white/5 text-[color:var(--text)]'}`}>
              {m.text}
            </div>
          ))}
          {chatLoading && (
            <div className="mr-8 rounded-lg bg-white/5 px-3 py-2 text-sm text-[color:var(--muted)] animate-pulse">
              AI กำลังคิด…
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="flex gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChat()}
            placeholder="ถามเกี่ยวกับระบบ…"
            className="flex-1 rounded-lg border border-[color:var(--border)] bg-black/40 px-3 py-2 text-sm text-[color:var(--text)] placeholder:text-[color:var(--muted)] focus:border-emerald-500/60 focus:outline-none"
          />
          <button
            onClick={sendChat}
            disabled={chatLoading || !chatInput.trim()}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
          >
            ส่ง
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function BotMonitor() {
  const [tab, setTab] = useState<Tab>('activity');
  const [activities] = useState<BotActivity[]>(generateActivity);
  const [liveCount, setLiveCount] = useState(0);
  const [settingsForMetrics, setSettingsForMetrics] = useState<{
    errorThresholds: ErrorThresholds | null;
    rateLimits: RateLimits | null;
  }>({ errorThresholds: null, rateLimits: null });

  useEffect(() => {
    const t = setInterval(() => {
      setLiveCount((c) => c + Math.floor(Math.random() * 2));
    }, 8000);
    return () => clearInterval(t);
  }, []);

  // Load thresholds/rate-limits for MetricsPanel threshold comparison
  useEffect(() => {
    fetch('/api/admin/settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setSettingsForMetrics({
            errorThresholds: json.data.errorThresholds
              ? { ...DEFAULT_ERROR_THRESHOLDS, ...json.data.errorThresholds }
              : DEFAULT_ERROR_THRESHOLDS,
            rateLimits: json.data.rateLimits
              ? { ...DEFAULT_RATE_LIMITS, ...json.data.rateLimits }
              : DEFAULT_RATE_LIMITS,
          });
        }
      })
      .catch(() => {
        setSettingsForMetrics({
          errorThresholds: DEFAULT_ERROR_THRESHOLDS,
          rateLimits: DEFAULT_RATE_LIMITS,
        });
      });
  }, []);

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'activity', label: 'Activity',  icon: '📡' },
    { id: 'messages', label: 'Messages',  icon: '✉️' },
    { id: 'settings', label: 'Settings',  icon: '⚙️' },
    { id: 'metrics',  label: 'Metrics',   icon: '📊' },
    { id: 'ai',       label: 'AI',        icon: '🧠' },
  ];

  return (
    <div className="glass reveal accent-top overflow-hidden p-5" style={{ animationDelay: '220ms' }}>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-[color:var(--text)]">
            <span className="text-lg">🤖</span> Bot Monitor
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </h2>
          <p className="mt-0.5 text-xs text-[color:var(--muted)]">
            ตรวจสอบบอท · แก้ไขข้อความ · ปรับการตั้งค่า · Metrics · AI Insights
            {liveCount > 0 && <span className="ml-2 text-emerald-400">+{liveCount} events</span>}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-xl border border-[color:var(--border)] bg-black/20 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
              tab === t.id
                ? 'bg-emerald-500/20 text-emerald-300 shadow-sm'
                : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'activity' && <ActivityFeed activities={activities} />}
      {tab === 'messages' && <MessageEditor />}
      {tab === 'settings' && <SettingsPanel />}
      {tab === 'metrics'  && (
        <MetricsPanel
          errorThresholds={settingsForMetrics.errorThresholds}
          rateLimits={settingsForMetrics.rateLimits}
        />
      )}
      {tab === 'ai'       && <AiInsightsPanel />}
    </div>
  );
}
