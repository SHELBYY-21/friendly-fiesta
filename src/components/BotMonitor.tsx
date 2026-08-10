'use client';

// ============================================================
// BotMonitor — Bot activity, message editor, AI-powered settings
// Tabs: Activity | Messages | Settings | AI Insights
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';

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

interface BotSettings {
  botEnabled: boolean;
  maintenanceMessage: string;
  updatedAt: string | null;
}

interface AiInsight {
  title: string;
  body: string;
  type: 'tip' | 'alert' | 'info';
}

type Tab = 'activity' | 'messages' | 'settings' | 'ai';

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

function SettingsPanel() {
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings', { cache: 'no-store' });
      const json = await res.json();
      if (json.data) {
        setSettings(json.data);
        setMessage(json.data.maintenanceMessage ?? '');
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = async (key: string, value: any) => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      setFeedback({ ok: true, text: 'บันทึกแล้ว ✓' });
      await load();
    } catch (e: any) {
      setFeedback({ ok: false, text: e.message ?? 'เกิดข้อผิดพลาด' });
    }
    setSaving(false);
    setTimeout(() => setFeedback(null), 3000);
  };

  if (loading) return (
    <div className="py-8 text-center text-sm text-[color:var(--muted)] animate-pulse">กำลังโหลดการตั้งค่า…</div>
  );

  return (
    <div className="space-y-4">
      {/* Bot toggle */}
      <div className="rounded-xl border border-[color:var(--border)] bg-white/[0.02] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[color:var(--text)]">🤖 สถานะบอท</p>
            <p className="text-xs text-[color:var(--muted)]">เปิด/ปิดการรับ webhook จาก Telegram</p>
          </div>
          <button
            onClick={() => patch('bot_enabled', !settings?.botEnabled)}
            disabled={saving}
            className={`relative h-7 w-12 rounded-full border transition-colors ${
              settings?.botEnabled
                ? 'border-emerald-500/60 bg-emerald-500/20' :'border-[color:var(--border)] bg-white/5'
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
            ? 'bg-emerald-500/10 text-emerald-300' :'bg-rose-500/10 text-rose-300'
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${settings?.botEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
          {settings?.botEnabled ? 'บอทกำลังทำงาน' : 'บอทหยุดทำงาน'}
        </div>
      </div>

      {/* Maintenance message */}
      <div className="rounded-xl border border-[color:var(--border)] bg-white/[0.02] p-4">
        <p className="text-sm font-semibold text-[color:var(--text)]">🔧 ข้อความปิดปรับปรุง</p>
        <p className="mb-2 text-xs text-[color:var(--muted)]">แสดงเมื่อบอทถูกปิด</p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-[color:var(--border)] bg-black/40 px-3 py-2 text-sm text-[color:var(--text)] focus:border-emerald-500/60 focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          {feedback && (
            <span className={`text-xs ${feedback.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{feedback.text}</span>
          )}
          <div className="ml-auto">
            <button
              onClick={() => patch('maintenance_message', message)}
              disabled={saving}
              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {saving ? '⏳ กำลังบันทึก…' : '💾 บันทึก'}
            </button>
          </div>
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

function AiInsightsPanel() {
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
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

  useEffect(() => {
    // Simulate live activity counter
    const t = setInterval(() => {
      setLiveCount((c) => c + Math.floor(Math.random() * 2));
    }, 8000);
    return () => clearInterval(t);
  }, []);

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'activity', label: 'Activity',  icon: '📡' },
    { id: 'messages', label: 'Messages',  icon: '✉️' },
    { id: 'settings', label: 'Settings',  icon: '⚙️' },
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
            ตรวจสอบบอท · แก้ไขข้อความ · ปรับการตั้งค่า · AI Insights
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
      {tab === 'ai'       && <AiInsightsPanel />}
    </div>
  );
}
