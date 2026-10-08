import { NextRequest, NextResponse } from 'next/server';
import { requireDashboardSession } from '@/lib/dashboardAuth';
import { sandboxCommands } from '@/lib/sandbox/commands';

export async function POST(req: NextRequest) {
  const denied = await requireDashboardSession(req); if (denied) return denied;
  try {
    const body = await req.json();
    const job = await sandboxCommands.createSandboxJob(body, { id: 'dashboard', isAdmin: true });
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'SANDBOX_UNAVAILABLE';
    return NextResponse.json({ error: code }, { status: /REQUIRED|FALSE|UNAVAILABLE/.test(code) ? 503 : 400 });
  }
}
