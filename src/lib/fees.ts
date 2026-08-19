// ============================================================
// คำนวณค่าธรรมเนียม (ส่วนต่างระหว่าง USDT ที่ควรได้ กับที่ได้จริง)
// Expected USDT = ยอดเงินบาท / เรท USDT ตลาด (marketUsdtRate)
// Fee USDT      = Expected USDT - Actual USDT
// % Fee         = (Fee USDT / Expected USDT) * 100
// ============================================================

import { round2, safeNumber, thbToUsdt } from './profit';

export interface FeeResult {
  expectedUsdt: number; // USDT ที่ควรได้ตามเรทตลาด
  feeUsdt: number;      // ส่วนต่างที่หายไป (ค่าธรรมเนียม)
  feePercent: number;   // % ค่าธรรมเนียม
}

export function calculateFee(
  thbAmount: number,
  marketUsdtRate: number,
  actualUsdt: number,
): FeeResult {
  const thb = safeNumber(thbAmount);
  const actual = safeNumber(actualUsdt);
  const expectedUsdt = thbToUsdt(thb, marketUsdtRate);
  const feeUsdt = round2(expectedUsdt - actual);
  const feePercent = expectedUsdt > 0 ? (feeUsdt / expectedUsdt) * 100 : 0;

  return {
    expectedUsdt,
    feeUsdt: safeNumber(feeUsdt),
    feePercent: round2(feePercent),
  };
}
