'use client';

// ============================================================
// API Monitor — Realtime API status + control panel
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react';

export type ApiStatus = 'idle' | 'checking' | 'ok' | 'error' | 'degraded';

export interface ApiEndpoint {
  id: string;
  name: string;
  url: string;
  method?: 'GET' | 'POST';
  category?: 'core' | 'dashboard' | 'external' | 'custom';
  icon?: string;
  description?: string;
}

interface EndpointState {
  status: ApiStatus;
  latencyMs?: number;
  httpStatus?: number;
  message?: string;
  checkedAt?: string;
  payload?: any;
}

export interface ApiMonitorProps {
  endpoints: ApiEndpoint[];
  autoRefreshMs?: number;
}

const STATUS_META: Record<ApiStatus, { color: string; label: string; ring: string }> = {
  idle: { color: 'bg-gray-500', label: 'ไม่ทราบ', ring: 'ring-gray-500/30' },
  checking: { color: 'bg-yellow-400 animate-pulse', label: 'กำลังตรวจ…', ring: 'ring-yellow-400/40' },
  ok: { color: 'bg-emerald-400', label: 'ปกติ', ring: 'ring-emerald-400/40' },
  degraded: { color: 'bg-amber-400', label: 'ช้า/ไม่เสถียร', ring: 'ring-amber-400/40' },
  error: { color: 'bg-rose-500', label: 'ล่ม', ring: 'ring-rose-500/40' },
};

async function pingEndpoint(endpoint: ApiEndpoint): Promise<EndpointState> {
  const startedAt = Date.now();
  try {
    const isExternal = /^https?:\/\//i.test(endpoint.url);
    const target = isExternal
      ? `/api/monitor/ping?url=${encodeURIComponent(endpoint.url)}`
      : endpoint.url;

    const res = await fetch(target, {
      method: endpoint.method || 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Date.now() - startedAt;
    let payload: any = null;
    try {
      const text = await res.text();
      payload = text ? JSON.parse(text) : null;
    } catch {
      /* Non-JSON response */
    }
    const httpStatus = res.status;
    let status: ApiStatus = 'ok';
    if (!res.ok) status = 'error';
    else if (latencyMs > 2000) status = 'degraded';
    return {
      status,
      latencyMs,
      httpStatus,
      checkedAt: new Date().toISOString(),
      payload,
      message: !res.ok ? `HTTP ${res.status}` : undefined,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startedAt;
    return {
      status: 'error',
      latencyMs,
      checkedAt: new Date().toISOString(),
      message: err?.name === 'TimeoutError' ? 'Timeout (>8s)' : err?.message ?? 'Network error',
    };
  }
}

export default function ApiMonitor({ endpoints, autoRefreshMs = 0 }: ApiMonitorProps) {
  const [states, setStates] = useState<Record<string, EndpointState>>({});
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const check = useCallback(async (endpoint: ApiEndpoint) => {
    setStates((prev) => ({ ...prev, [endpoint.id]: { ...(prev[endpoint.id] ?? {}), status: 'checking' } }));
    const result = await pingEndpoint(endpoint);
    setStates((prev) => ({ ...prev, [endpoint.id]: result }));
  }, []);

  const checkAll = useCallback(async () => {
    setIsRefreshingAll(true);
    await Promise.all(endpoints.map((e) => check(e)));
    setIsRefreshingAll(false);
  }, [endpoints, check]);

  useEffect(() => {
    checkAll();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(checkAll, autoRefreshMs || 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, autoRefreshMs, checkAll]);

  const summary = useMemo(() => {
    const total = endpoints.length;
    const values = Object.values(states);
    const ok = values.filter((s) => s.status === 'ok').length;
    const degraded = values.filter((s) => s.status === 'degraded').length;
    const error = values.filter((s) => s.status === 'error').length;
    const avgLatency = values.filter((s) => s.latencyMs).reduce((sum, s) => sum + (s.latencyMs ?? 0), 0) /
      Math.max(1, values.filter((s) => s.latencyMs).length);
    return { total, ok, degraded, error, avgLatency: Math.round(avgLatency) };
  }, [endpoints, states]);

  return (
    <div className="glass reveal accent-top overflow-hidden p-5" style={{ animationDelay: '200ms' }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-[color:var(--text)]">
            <span className="text-lg">📡</span> API Monitor
            <span className="text-[color:var(--muted)]">({summary.ok}/{summary.total})</span>
          </h2>
          <p className="mt-0.5 text-xs text-[color:var(--muted)]">
            เชื่อมต่อ API ทั้งหมด · ค่าเฉลี่ยตอบสนอง {summary.avgLatency}ms
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-white/5 px-3 py-1.5 text-xs backdrop-blur transition hover:bg-white/10">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-3 w-3 rounded"
            />
            <span>Auto {(autoRefreshMs || 30_000) / 1000}s</span>
          </label>
          <button
            onClick={checkAll}
            disabled={isRefreshingAll}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-300 backdrop-blur transition hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {isRefreshingAll ? '⏳ กำลังตรวจ…' : '🔄 Refresh All'}
          </button>
        </div>
      </div>

      {/* Status summary */}
      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded-lg border border-[color:var(--border)] bg-white/5 p-2">
          <div className="text-lg font-bold text-emerald-400">{summary.ok}</div>
          <div className="text-[color:var(--muted)]">ปกติ</div>
        </div>
        <div className="rounded-lg border border-[color:var(--border)] bg-white/5 p-2">
          <div className="text-lg font-bold text-amber-400">{summary.degraded}</div>
          <div className="text-[color:var(--muted)]">ช้า</div>
        </div>
        <div className="rounded-lg border border-[color:var(--border)] bg-white/5 p-2">
          <div className="text-lg font-bold text-rose-400">{summary.error}</div>
          <div className="text-[color:var(--muted)]">ล่ม</div>
        </div>
        <div className="rounded-lg border border-[color:var(--border)] bg-white/5 p-2">
          <div className="text-lg font-bold text-cyan-400">{summary.avgLatency}ms</div>
          <div className="text-[color:var(--muted)]">Avg</div>
        </div>
      </div>

      {/* Endpoint list */}
      <div className="mt-4 space-y-2">
        {endpoints.map((endpoint) => {
          const state = states[endpoint.id] ?? { status: 'idle' as ApiStatus };
          const meta = STATUS_META[state.status];
          const isOpen = showDetails === endpoint.id;
          return (
            <div
              key={endpoint.id}
              className={`row-glow rounded-xl border border-[color:var(--border)] bg-white/[0.02] p-3 ring-1 ${meta.ring} transition`}
            >
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${meta.color} shadow-md`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {endpoint.icon && <span className="text-sm">{endpoint.icon}</span>}
                    <span className="text-sm font-medium text-[color:var(--text)]">{endpoint.name}</span>
                    {endpoint.category && (
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
                        {endpoint.category}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[10px] text-[color:var(--muted)]">
                    {endpoint.method || 'GET'} {endpoint.url}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {state.latencyMs != null && (
                    <span
                      className={`tabular-nums text-xs ${
                        state.status === 'ok'
                          ? 'text-emerald-400'
                          : state.status === 'degraded'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                      }`}
                    >
                      {state.latencyMs}ms
                    </span>
                  )}
                  {state.httpStatus && (
                    <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--muted)]">
                      {state.httpStatus}
                    </span>
                  )}
                  <button
                    onClick={() => check(endpoint)}
                    disabled={state.status === 'checking'}
                    className="rounded-md border border-[color:var(--border)] bg-white/5 px-2 py-1 text-[10px] text-[color:var(--text)] backdrop-blur transition hover:bg-white/10 disabled:opacity-50"
                    title="Ping"
                  >
                    {state.status === 'checking' ? '⏳' : '▶'} Ping
                  </button>
                  <button
                    onClick={() => setShowDetails(isOpen ? null : endpoint.id)}
                    className="rounded-md border border-[color:var(--border)] bg-white/5 px-2 py-1 text-[10px] text-[color:var(--text)] backdrop-blur transition hover:bg-white/10"
                    title="Details"
                  >
                    {isOpen ? '▲' : '▼'}
                  </button>
                </div>
              </div>
              {isOpen && (
                <div className="mt-3 rounded-lg border border-[color:var(--border)] bg-black/30 p-3 text-xs">
                  <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[color:var(--muted)]">
                    <span>Status: <span className="text-[color:var(--text)]">{meta.label}</span></span>
                    {state.checkedAt && (
                      <span>
                        เช็คเมื่อ:{' '}
                        <span className="text-[color:var(--text)]">
                          {new Date(state.checkedAt).toLocaleTimeString('th-TH')}
                        </span>
                      </span>
                    )}
                    {endpoint.description && (
                      <span className="text-[color:var(--text)]">{endpoint.description}</span>
                    )}
                  </div>
                  {state.message && (
                    <div className="mb-2 rounded bg-rose-500/10 px-2 py-1 text-rose-300">
                      ⚠ {state.message}
                    </div>
                  )}
                  {state.payload && (
                    <pre className="max-h-40 overflow-auto rounded bg-black/40 p-2 font-mono text-[10px] text-emerald-200">
                      {JSON.stringify(state.payload, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
