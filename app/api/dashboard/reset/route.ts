import { NextRequest, NextResponse } from 'next/server';
import { requireDashboardSession } from '@/lib/dashboardAuth';
import { resetDesk } from '@/lib/ct/deskReset';
import { opsChatId } from '@/lib/ct/deskChat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = await requireDashboardSession(req);
  if (denied) return denied;

  let chatId: number | null = null;
  let confirm = false;
  try {
    const body = await req.json();
    if (body?.chatId != null) {
      const n = Number(body.chatId);
      if (Number.isFinite(n)) chatId = n;
    }
    confirm = Boolean(body?.confirm);
  } catch {
    /* empty */
  }
  if (!confirm) {
    return NextResponse.json({ ok: false, error: 'CONFIRM_REQUIRED' }, { status: 400 });
  }

  const target = chatId ?? (await opsChatId(null));
  if (target == null) {
    return NextResponse.json({ ok: false, error: 'NO_CHAT' }, { status: 400 });
  }

  const result = await resetDesk(target);
  return NextResponse.json({
    ok: true,
    chatId: target,
    parkedCount: result.parkedCount,
    parked: result.parked,
    tag: result.tag,
    dayCutAt: result.dayCutAt,
  });
}
