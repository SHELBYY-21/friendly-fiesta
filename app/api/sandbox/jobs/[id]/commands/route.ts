import { NextRequest, NextResponse } from 'next/server';
import { requireDashboardSession } from '@/lib/dashboardAuth';
import { sandboxCommands } from '@/lib/sandbox/commands';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = await requireDashboardSession(req); if (denied) return denied;
  try {
    const [{ id }, body] = await Promise.all([context.params, req.json()]);
    const job = await sandboxCommands.transitionSandboxJob({ ...body, jobId: id }, { id: 'dashboard', isAdmin: true });
    return NextResponse.json({ job });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'SANDBOX_UNAVAILABLE';
    const status = /STALE|CONFLICT|IDEMPOTENCY/.test(code) ? 409 : /REQUIRED|FALSE|UNAVAILABLE/.test(code) ? 503 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
