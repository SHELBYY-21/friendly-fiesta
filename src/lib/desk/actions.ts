'use server';

import { cookies, headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { fetchMktRate } from '@/lib/mkt';
import { pinBankAccount, ensureTodayPins } from '@/lib/banks';
import { rematchOpenSlips } from '@/lib/ct/queue';
import { opsChatId } from '@/lib/ct/deskChat';
import { resetDesk } from '@/lib/ct/deskReset';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  MAX_ATTEMPTS,
  LOCK_MINUTES,
  assertDeskSession,
  createSessionToken,
  getClientIp,
  isAuthConfigured,
  verifyPin,
} from '@/lib/dashboardAuth';

export async function loginWithPin(pin: string): Promise<
  { ok: true } | { ok: false; error: string; secondsLeft?: number }
> {
  if (!isAuthConfigured()) return { ok: true };
  const ip = getClientIp(await headers());
  const { data: attemptRow } = await supabaseAdmin
    .from('dashboard_login_attempts')
    .select('locked_until')
    .eq('ip', ip)
    .maybeSingle();
  if (attemptRow?.locked_until && new Date(attemptRow.locked_until) > new Date()) {
    const secondsLeft = Math.ceil((new Date(attemptRow.locked_until).getTime() - Date.now()) / 1000);
    return { ok: false, error: 'locked', secondsLeft };
  }
  if (!verifyPin(String(pin ?? ''))) {
    const { data: lockedUntil } = await supabaseAdmin.rpc('register_failed_login', {
      p_ip: ip,
      p_max_attempts: MAX_ATTEMPTS,
      p_lock_minutes: LOCK_MINUTES,
    });
    if (lockedUntil && new Date(lockedUntil) > new Date()) {
      const secondsLeft = Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000);
      return { ok: false, error: 'locked', secondsLeft };
    }
    return { ok: false, error: 'invalid_pin' };
  }
  await supabaseAdmin.rpc('clear_login_attempts', { p_ip: ip });
  const token = await createSessionToken();
  if (!token) return { ok: false, error: 'auth_not_configured' };
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return { ok: true };
}

export async function setDeskRate(sellRate: number): Promise<{ ok: true; sellRate: number } | { ok: false; error: string }> {
  const session = await assertDeskSession();
  if (!session.ok) return session;
  const rate = Number(sellRate);
  let marketRate = Number(await fetchMktRate());
  if (!Number.isFinite(rate) || rate < 20 || rate > 80) {
    return { ok: false, error: 'เรทขายต้องอยู่ระหว่าง 20–80' };
  }
  if (!Number.isFinite(marketRate) || marketRate <= 0 || marketRate > 1000) {
    return { ok: false, error: 'ดึงเรทตลาดไม่ได้' };
  }
  const { error } = await supabaseAdmin
    .from('rates')
    .insert({ sell_rate: rate, market_usdt_rate: marketRate });
  if (error) return { ok: false, error: error.message };
  return { ok: true, sellRate: rate };
}

export async function resetDeskCycle(chatId?: number | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await assertDeskSession();
  if (!session.ok) return session;
  const target = await opsChatId(chatId ?? null);
  if (target == null) return { ok: false, error: 'NO_CHAT' };
  await resetDesk(target);
  return { ok: true };
}

export async function pinDeskAccount(
  bankAccountId: string,
  chatId?: number | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await assertDeskSession();
  if (!session.ok) return session;
  const target = await opsChatId(chatId ?? null);
  if (target == null) return { ok: false, error: 'NO_CHAT' };
  const { data: acc, error } = await supabaseAdmin
    .from('bank_accounts')
    .select('id, bank_name, account_number, label')
    .eq('id', bankAccountId)
    .maybeSingle();
  if (error || !acc) return { ok: false, error: 'ACCOUNT_NOT_FOUND' };
  await pinBankAccount(target, acc.bank_name, String(acc.account_number || ''), acc.label);
  await rematchOpenSlips(target);
  await ensureTodayPins(target);
  return { ok: true };
}
