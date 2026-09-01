export type WebhookState = {
  ok: boolean;
  url: string | null;
  pending: number | null;
  error: string | null;
  lastError: string | null;
};

function appBase(): string | null {
  const base = (process.env.APP_URL || '').replace(/\/$/, '');
  return base.startsWith('https://') ? base : null;
}

function wantedUrl(): string | null {
  const base = appBase();
  return base ? `${base}/api/telegram/webhook` : null;
}

function telegramDescription(body: any): string | null {
  const text = [body?.description, body?.result?.last_error_message]
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .find(Boolean);
  return text ? text.slice(0, 180) : null;
}

export async function readTelegramWebhook(): Promise<WebhookState> {
  const token = process.env.BOT_TOKEN;
  if (!token) return { ok: false, url: null, pending: null, error: 'NO_BOT_TOKEN', lastError: null };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) {
      return {
        ok: false,
        url: null,
        pending: null,
        error: telegramDescription(body) || 'TELEGRAM_REJECTED',
        lastError: telegramDescription(body),
      };
    }
    const info = body.result ?? {};
    return {
      ok: true,
      url: info.url || null,
      pending: Number.isFinite(info.pending_update_count) ? Number(info.pending_update_count) : 0,
      error: null,
      lastError: info.last_error_message || null,
    };
  } catch {
    return { ok: false, url: null, pending: null, error: 'NETWORK', lastError: null };
  }
}

export async function ensureTelegramWebhook(): Promise<WebhookState & { set: boolean }> {
  const token = process.env.BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const wanted = wantedUrl();
  if (!token || !secret || !wanted) {
    return { ok: false, url: wanted, pending: null, error: 'NOT_CONFIGURED', lastError: null, set: false };
  }
  const current = await readTelegramWebhook();
  if (current.ok && current.url === wanted) {
    return { ...current, error: null, set: false };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: wanted,
        secret_token: secret,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: false,
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) {
      const description = telegramDescription(body) || 'SET_FAILED';
      const after = await readTelegramWebhook().catch(() => current);
      if (after.url === wanted) {
        return { ...after, error: null, lastError: after.lastError || description, set: false };
      }
      return {
        ok: false,
        url: after.url || wanted,
        pending: after.pending ?? current.pending,
        error: description,
        lastError: after.lastError || description,
        set: false,
      };
    }
    return { ok: true, url: wanted, pending: current.pending, error: null, lastError: current.lastError, set: true };
  } catch {
    return { ok: false, url: wanted, pending: current.pending, error: 'NETWORK', lastError: current.lastError, set: false };
  }
}
