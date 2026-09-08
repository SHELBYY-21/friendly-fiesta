import { createHmac, timingSafeEqual } from 'crypto';
import { SETTLEMENT_WEBAPP_ACTIONS } from './settlementRich';

/** Telegram Web App initData HMAC. Secret = HMAC_SHA256("WebAppData", bot_token). */
export function verifyWebAppInitData(
  initData: string,
  botToken: string,
  maxAgeSec = 86_400,
): { ok: boolean; userId?: number; startParam?: string } {
  if (!initData || !botToken) return { ok: false };
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return { ok: false };
  params.delete('hash');
  const dataCheck = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const digest = createHmac('sha256', secret).update(dataCheck).digest();
  const given = Buffer.from(hash, 'hex');
  if (given.length !== digest.length || !timingSafeEqual(given, digest)) return { ok: false };
  const authDate = Number(params.get('auth_date') || 0);
  if (!Number.isFinite(authDate) || authDate <= 0) return { ok: false };
  if (Date.now() / 1000 - authDate > maxAgeSec) return { ok: false };
  let userId: number | undefined;
  try {
    const user = JSON.parse(params.get('user') || '{}') as { id?: number };
    if (Number.isSafeInteger(user.id) && user.id) userId = user.id;
  } catch {
    /* ignore */
  }
  return { ok: true, userId, startParam: params.get('start_param') || undefined };
}

export type WebAppPayload = { v: number; action: string };

export function parseWebAppPayload(raw: string): WebAppPayload | null {
  const text = (raw || '').trim();
  if (!text || text.length > 4096) return null;
  if (SETTLEMENT_WEBAPP_ACTIONS.has(text)) return { v: 1, action: text };
  try {
    const j = JSON.parse(text) as { v?: number; action?: string };
    if (!j || typeof j.action !== 'string') return null;
    if (!SETTLEMENT_WEBAPP_ACTIONS.has(j.action)) return null;
    return { v: typeof j.v === 'number' ? j.v : 1, action: j.action };
  } catch {
    return null;
  }
}
