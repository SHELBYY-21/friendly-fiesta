// POST /api/ai/chat — thin proxy to /api/ai/chat-completion
// BotMonitor calls this endpoint; it forwards to the system-managed route
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Normalise: accept { messages } and forward as Anthropic chat-completion payload
    const messages = Array.isArray(body?.messages) ? body.messages : [];

    const res = await fetch(new URL('/api/ai/chat-completion', req.url).toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'ANTHROPIC',
        model: 'claude-sonnet-4-6',
        messages,
        stream: false,
        parameters: { max_tokens: 1024, temperature: 0.7 },
      }),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  }
}
