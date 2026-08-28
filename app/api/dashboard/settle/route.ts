import { NextRequest, NextResponse } from 'next/server';
import { requireDashboardSession } from '@/lib/dashboardAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { settleAllDue } from '@/lib/ct/queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function actorTg(): number | null {
  const raw = process.env.ADMIN_TELEGRAM_IDS ?? '';
  const n = Number(raw.split(/[\s,]+/).find(Boolean));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export async function POST(req: NextRequest) {
  const denied = await requireDashboardSession(req);
  if (denied) return denied;

  const actor = actorTg();
  if (!actor) {
    return NextResponse.json({ ok: false, error: 'NO_ADMIN' }, { status: 500 });
  }

  let chatId: number | null = null;
  let dryRun = false;
  let confirmHigh = false;
  let confirmMismatch = false;
  try {
    const body = await req.json();
    if (body?.chatId != null) {
      const n = Number(body.chatId);
      if (Number.isFinite(n)) chatId = n;
    }
    dryRun = Boolean(body?.dryRun);
    confirmHigh = Boolean(body?.confirmHigh);
    confirmMismatch = Boolean(body?.confirmMismatch);
  } catch {
    /* empty body is fine */
  }

  const { data: locked, error } = await supabaseAdmin
    .from('pending_slips')
    .select('chat_id')
    .eq('status', 'LOCKED');
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const chats = [...new Set(
    (locked ?? [])
      .map((r: { chat_id: number }) => Number(r.chat_id))
      .filter((n) => Number.isFinite(n) && n !== 0),
  )];
  const targets = chatId ? chats.filter((id) => id === chatId) : chats;
  if (!targets.length) {
    return NextResponse.json({ ok: true, count: 0, sent: 0, due: 0, refs: [], skipped: [] });
  }

  let count = 0;
  let sent = 0;
  let due = 0;
  const refs: string[] = [];
  const skipped: Array<{ short: string; reason: string }> = [];
  let batchId: string | null = null;
  for (const id of targets) {
    const r = await settleAllDue(id, actor, { dryRun, confirmHigh, confirmMismatch });
    count += r.count;
    sent += r.sent;
    due += r.due;
    refs.push(...r.refs);
    skipped.push(...r.skipped);
    batchId = r.batchId;
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    count,
    sent: Math.round(sent * 100) / 100,
    due: Math.round(due * 100) / 100,
    refs,
    skipped,
    batchId: dryRun ? null : batchId,
  });
}