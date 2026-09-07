import { NextRequest, NextResponse } from 'next/server';
import { requireDashboardSession } from '@/lib/dashboardAuth';
import { listRooms } from '@/lib/botSessions';
import { opsChatId } from '@/lib/ct/deskChat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireDashboardSession(req);
  if (denied) return denied;
  const rooms = await listRooms();
  const active = await opsChatId(null);
  return NextResponse.json({
    ok: true,
    activeChatId: active,
    rooms: rooms.map((r) => ({
      chatId: r.chatId,
      name: r.name,
      desk: r.desk,
      current: r.chatId === active,
    })),
  });
}
