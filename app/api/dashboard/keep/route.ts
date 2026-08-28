import { NextRequest, NextResponse } from 'next/server';
import { requireDashboardSession } from '@/lib/dashboardAuth';
import { findSlipByShort, patchSlip } from '@/lib/ct/store';
import { commitIncomingLock } from '@/lib/ct/queue';
import { opsChatId } from '@/lib/ct/deskChat';
import { HIGH_VALUE_THB, isOcrJunkAmount } from '@/lib/ct/settleGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = await requireDashboardSession(req);
  if (denied) return denied;
  let body: { short?: string; force?: boolean; confirmHigh?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_BODY' }, { status: 400 });
  }
  const short = String(body.short || '').trim();
  if (!short) return NextResponse.json({ ok: false, error: 'NO_REF' }, { status: 400 });

  const slip = await findSlipByShort(short);
  if (!slip) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

  if (isOcrJunkAmount(slip.thb_in)) {
    const note = String(slip.note || '');
    const nextNote = note.includes('OCR_JUNK:AMOUNT_TOO_LARGE')
      ? note
      : [note, 'OCR_JUNK:AMOUNT_TOO_LARGE'].filter(Boolean).join('|');
    const kept = await patchSlip(slip.id, {
      status: 'OCR_WEAK',
      should_send: 0,
      note: nextNote,
    });
    return NextResponse.json({
      ok: false,
      error: 'AMOUNT_TOO_LARGE',
      short: kept.short_ref,
      status: kept.status,
      note: kept.note,
    }, { status: 400 });
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
    const force = Boolean(body.force) || slip.status === 'PIN_MISMATCH';
    const locked = await commitIncomingLock(slip, {
      chatId: chatId ?? slip.chat_id,
      userId: slip.admin_tg_id,
      admin,
      force,
      queued: true,
      confirmHigh: Boolean(body.confirmHigh) || (slip.thb_in ?? 0) < HIGH_VALUE_THB,
    });
    return NextResponse.json({ ok: true, short: locked.short_ref, status: locked.status, ledger: locked.ledger_ref });
  } catch (e: any) {
    const msg = e?.message ?? 'keep_failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}