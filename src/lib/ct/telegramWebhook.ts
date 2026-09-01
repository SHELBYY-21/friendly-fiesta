export type WebhookState = {
  ok: boolean;
  url: string | null;
  pending: number | null;
  error: string | null;
};

function appBase(): string | null {
  const base = (process.env.APP_URL || '').replace(/\/$/, '');
  return base.startsWith('https://') ? base : null;
}

export async function readTelegramWebhook(): Promise<WebhookState> {
  const token = process.env.BOT_TOKEN;
  if (!token) return { ok: false, url: null, pending: null, error: 'NO_BOT_TOKEN' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) {
      return { ok: false, url: null, pending: null, error: 'TELEGRAM_REJECTED' };
    }
    const info = body.result ?? {};
    return {
      ok: true,
      url: info.url || null,
      pending: Number.isFinite(info.pending_update_count) ? Number(info.pending_update_count) : 0,
      error: info.last_error_message || null,
    };
  } catch {
    return { ok: false, url: null, pending: null, error: 'NETWORK' };
  }
}

export async function ensureTelegramWebhook(): Promise<WebhookState & { set: boolean }> {
  const token = process.env.BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const base = appBase();
  if (!token || !secret || !base) {
    return { ok: false, url: null, pending: null, error: 'NOT_CONFIGURED', set: false };
  }
  const wanted = `${base}/api/telegram/webhook`;
  const current = await readTelegramWebhook();
  if (current.ok && current.url === wanted && !current.error) {
    return { ...current, set: false };
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
      return { ok: false, url: wanted, pending: current.pending, error: 'SET_FAILED', set: false };
    }
    return { ok: true, url: wanted, pending: current.pending, error: null, set: true };
  } catch {
    return { ok: false, url: wanted, pending: current.pending, error: 'NETWORK', set: false };
  }
}
