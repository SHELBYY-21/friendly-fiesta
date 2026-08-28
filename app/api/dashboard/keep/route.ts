import { NextRequest, NextResponse } from 'next/server';
import { requireDashboardSession } from '@/lib/dashboardAuth';
import { findSlipByShort } from '@/lib/ct/store';
import { commitIncomingLock } from '@/lib/ct/queue';
import { opsChatId } from '@/lib/ct/deskChat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = await requireDashboardSession(req);
  if (denied) return denied;
  let body: { short?: string; force?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_BODY' }, { status: 400 });
  }
  const short = String(body.short || '').trim();
  if (!short) return NextResponse.json({ ok: false, error: 'NO_REF' }, { status: 400 });

  const slip = await findSlipByShort(short);
  if (!slip) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

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
    });
    return NextResponse.json({ ok: true, short: locked.short_ref, status: locked.status, ledger: locked.ledger_ref });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'keep_failed' }, { status: 400 });
  }
}
