// POST /api/transactions/thb-deposit — เฟส 1 (ใช้ service กลางร่วมกับ webhook)
import { NextRequest, NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/apiAuth';
import { recordThbDeposit, AdminNotFoundError } from '@/lib/transactions';
import type { ThbDepositRequest } from '@/types/transactions';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const unauthorized = requireApiKey(req);
    if (unauthorized) return unauthorized;

    const body = (await req.json()) as ThbDepositRequest;
    if (
      !Number.isSafeInteger(body.adminTelegramId) || body.adminTelegramId <= 0 ||
      !Number.isFinite(body.thbAmount) || body.thbAmount <= 0 ||
      !Number.isFinite(body.usdtAmount) || body.usdtAmount <= 0 ||
      !Number.isFinite(body.sellRate) || body.sellRate <= 0 ||
      !Number.isFinite(body.marketUsdtRate) || body.marketUsdtRate <= 0
    ) {
      return NextResponse.json(
        { error: 'adminTelegramId, thbAmount, usdtAmount, sellRate และ marketUsdtRate ต้องเป็นค่าบวกที่ถูกต้อง' },
        { status: 400 },
      );
    }

    const result = await recordThbDeposit({
      adminTelegramId: body.adminTelegramId,
      bankAccountId: body.bankAccountId ?? null,
      thbAmount: body.thbAmount,
      usdtAmount: body.usdtAmount,
      sellRate: body.sellRate,
      marketUsdtRate: body.marketUsdtRate,
      note: body.note,
      slipImageUrl: body.slipImageUrl,
    });

    return NextResponse.json(result);
  } catch (e: any) {
    if (e instanceof AdminNotFoundError) {
      return NextResponse.json({ error: 'ไม่พบแอดมินที่ผูกกับ Telegram ID นี้' }, { status: 404 });
    }
    console.error('[thb-deposit]', e);
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ — ตรวจข้อมูลแล้วลองใหม่' }, { status: 500 });
  }
}
