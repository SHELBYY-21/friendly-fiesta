import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';
import { requireDashboardSession } from '@/lib/dashboardAuth';

export async function GET(req: NextRequest) {
  const denied = await requireDashboardSession(req);
  if (denied) return denied;
  const searchParams = req.nextUrl.searchParams;
  const limit = Number(searchParams.get('limit')) || 10;
  const status = searchParams.get('status') || 'verified';

  try {
    const { data: transactions, error } = await supabaseAdmin
      .from('transactions')
      .select('id, slip_image_url, slip_fingerprint, ocr_confidence, receiver_name, receiver_bank, receiver_last4, thb_amount, created_at, updated_at')
      .eq('type', 'THB_DEPOSIT')
      .not('slip_image_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const filteredTransactions = status === 'verified' ? (transactions ?? []).filter((t) => t.slip_fingerprint) : transactions ?? [];

    const slips = filteredTransactions.map((t: any) => ({
      id: t.id,
      transactionId: t.id,
      slipImageUrl: t.slip_image_url,
      slipFingerprint: t.slip_fingerprint,
      ocrConfidence: Number(t.ocr_confidence ?? 0),
      extractedData: {
        amount: Number(t.thb_amount ?? 0),
        bank: t.receiver_bank ?? 'Unknown',
        receiver: t.receiver_name ?? 'Unknown',
        last4: t.receiver_last4 ?? '0000',
        transferDate: new Date(t.created_at).toLocaleDateString('th-TH'),
      },
      verificationStatus: t.slip_fingerprint ? ('verified' as const) : ('pending' as const),
      createdAt: t.created_at,
    }));

    return NextResponse.json({
      data: slips,
      error: null,
    });
  } catch (err) {
    console.error('recent-slips error:', err);
    return NextResponse.json(
      {
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'Server error' },
      },
      { status: 500 }
    );
  }
}
