'use server';

import { cookies, headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { fetchMktRate } from '@/lib/mkt';
import { pinBankAccount, ensureTodayPins } from '@/lib/banks';
import { commitIncomingLock, rematchOpenSlips, settleAllDue } from '@/lib/ct/queue';
import { opsChatId } from '@/lib/ct/deskChat';
import { resetDesk } from '@/lib/ct/deskReset';
import { findSlipByShort, patchSlip } from '@/lib/ct/store';
import { HIGH_VALUE_THB, isOcrJunkAmount } from '@/lib/ct/settleGuard';
import { invalidateBotGateCache, saveTyphoonSetting } from '@/lib/systemSettings';
import {
  normalizePayoutInput,
  payoutInputErrors,
  readPayoutWallet,
  writePayoutWallet,
  type PayoutWallet,
} from '@/lib/ct/payoutWallet';
import { claimSettlementConfirm } from '@/lib/ct/settlementRich';
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

export async function keepDeskSlip(
  short: string,
  opts?: { force?: boolean; confirmHigh?: boolean },
): Promise<{ ok: true; short: string } | { ok: false; error: string }> {
  const session = await assertDeskSession();
  if (!session.ok) return session;
  const ref = String(short || '').trim();
  if (!ref) return { ok: false, error: 'NO_REF' };
  const slip = await findSlipByShort(ref);
  if (!slip) return { ok: false, error: 'NOT_FOUND' };
  if (isOcrJunkAmount(slip.thb_in)) {
    const note = String(slip.note || '');
    const nextNote = note.includes('OCR_JUNK:AMOUNT_TOO_LARGE')
      ? note
      : [note, 'OCR_JUNK:AMOUNT_TOO_LARGE'].filter(Boolean).join('|');
    await patchSlip(slip.id, { status: 'OCR_WEAK', should_send: 0, note: nextNote });
    return { ok: false, error: 'AMOUNT_TOO_LARGE' };
  }
  const chatId = await opsChatId(slip.chat_id);
  const admin = {
    id: 'desk',
    name: slip.admin_name || 'Desk',
    telegram_user_id: slip.admin_tg_id,
    holding_usdt: 0,
    role: 'Admin' as const,
  };
  try {
    const force = Boolean(opts?.force) || slip.status === 'PIN_MISMATCH';
    const locked = await commitIncomingLock(slip, {
      chatId: chatId ?? slip.chat_id,
      userId: slip.admin_tg_id,
      admin,
      force,
      queued: true,
      confirmHigh: Boolean(opts?.confirmHigh) || (slip.thb_in ?? 0) < HIGH_VALUE_THB,
    });
    return { ok: true, short: locked.short_ref };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'keep_failed' };
  }
}

function actorTg(): number | null {
  const raw = process.env.ADMIN_TELEGRAM_IDS ?? '';
  const n = Number(raw.split(/[\s,]+/).find(Boolean));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export async function settleDeskQueue(
  chatId?: number | null,
): Promise<{ ok: true; skipped: Array<{ short: string; reason: string }> } | { ok: false; error: string }> {
  const session = await assertDeskSession();
  if (!session.ok) return session;
  const actor = actorTg();
  if (!actor) return { ok: false, error: 'NO_ADMIN' };
  const { data: locked, error } = await supabaseAdmin
    .from('pending_slips')
    .select('chat_id')
    .eq('status', 'LOCKED');
  if (error) return { ok: false, error: error.message };
  const chats = [...new Set(
    (locked ?? [])
      .map((r: { chat_id: number }) => Number(r.chat_id))
      .filter((n) => Number.isFinite(n) && n !== 0),
  )];
  const targets = chatId ? chats.filter((id) => id === chatId) : chats;
  const skipped: Array<{ short: string; reason: string }> = [];
  for (const id of targets) {
    if (!claimSettlementConfirm(`desk:${id}`)) continue;
    const r = await settleAllDue(id, actor, { dryRun: false, confirmHigh: false, confirmMismatch: false });
    skipped.push(...r.skipped);
  }
  return { ok: true, skipped };
}

export async function loadDeskPayout(
  chatId?: number | null,
): Promise<{ ok: true; wallet: PayoutWallet | null } | { ok: false; error: string }> {
  const session = await assertDeskSession();
  if (!session.ok) return session;
  const id = chatId ?? (await opsChatId());
  if (!id) return { ok: true, wallet: null };
  return { ok: true, wallet: await readPayoutWallet(id) };
}

export async function saveDeskPayout(
  input: {
    label?: string;
    fromAddress?: string;
    walletId?: string;
    rail?: string;
    destAddress?: string;
  },
  chatId?: number | null,
): Promise<{ ok: true; wallet: PayoutWallet } | { ok: false; error: string }> {
  const session = await assertDeskSession();
  if (!session.ok) return session;
  const id = chatId ?? (await opsChatId());
  if (!id) return { ok: false, error: 'NO_ROOM' };
  const wallet = normalizePayoutInput(input);
  const errors = payoutInputErrors(wallet);
  if (errors.length) return { ok: false, error: errors[0] };
  try {
    await writePayoutWallet(id, wallet, 'desk');
    return { ok: true, wallet };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'payout_save_failed' };
  }
}

export async function saveTyphoonKey(value: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await assertDeskSession();
  if (!session.ok) return session;
  try {
    await saveTyphoonSetting(String(value ?? ''));
    invalidateBotGateCache();
    return { ok: true };
  } catch {
    return { ok: false, error: 'typhoon key required' };
  }
}
