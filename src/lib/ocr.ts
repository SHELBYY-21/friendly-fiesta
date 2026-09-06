// ============================================================
// อ่านสลิป — ลำดับความสำคัญ:
//   1) Grok Vision (ถ้ามี GROK_API_KEY) — คืนข้อมูล structured ทั้งชุด
//   2) OCR.space + smart-slip-verifier parser (goragodwiriya)
// ============================================================
import { analyzeSlipWithGrok, analyzeUsdtWithGrok, SlipExtract, UsdtExtract } from './grokVision';
import { pickExplicitThbAmount } from './ocrAmount';
import { parseSlipText } from '../bot/parse';
import { parseSmartSlip } from './ct/smartSlip';

export type { SlipExtract, UsdtExtract };

/** อ่านสกรีนช็อตโอน USDT (Grok, 12s timeout) — null ถ้าอ่านไม่ได้/ไม่มี key */
export async function analyzeUsdtScreenshot(imageUrl: string): Promise<UsdtExtract | null> {
  try {
    return await Promise.race([
      analyzeUsdtWithGrok(imageUrl),
      new Promise<UsdtExtract | null>((resolve) => setTimeout(() => resolve(null), 18000)),
    ]);
  } catch (e) {
    console.warn('USDT OCR error:', e instanceof Error ? e.message : e);
    return null;
  }
}

function raceMs<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function visionReady(s: SlipExtract | null): s is SlipExtract {
  if (s == null) return false;
  return s.thbAmount != null || Boolean(s.receiverLast4) || Boolean(s.transRef) || Boolean(s.receiverName);
}

function mergeSlip(grok: SlipExtract | null, ocr: ReturnType<typeof parseSlipText> | null, smart?: ReturnType<typeof parseSmartSlip> | null): SlipExtract {
  return {
    thbAmount: grok?.thbAmount ?? smart?.amount ?? ocr?.amount ?? null,
    feeThb: grok?.feeThb ?? smart?.fee ?? null,
    time: grok?.time ?? smart?.time ?? ocr?.time ?? null,
    date: grok?.date ?? smart?.date ?? ocr?.date ?? null,
    receiverLast4: grok?.receiverLast4 || smart?.receiverLast4 || ocr?.last4 || null,
    senderLast4: grok?.senderLast4 ?? smart?.senderLast4 ?? null,
    receiverAccount: grok?.receiverAccount ?? smart?.receiverAccount ?? null,
    senderAccount: grok?.senderAccount ?? null,
    bank: grok?.bank || smart?.bank || ocr?.bank || null,
    senderBank: grok?.senderBank ?? null,
    receiverName: grok?.receiverName || smart?.receiverName || ocr?.receiverName || null,
    senderName: grok?.senderName ?? smart?.senderName ?? null,
    transRef: grok?.transRef ?? smart?.transRef ?? null,
    channel: grok?.channel ?? null,
    promptpay: grok?.promptpay ?? null,
    balanceThb: grok?.balanceThb ?? null,
    slipType: grok?.slipType ?? null,
    confidence: grok?.confidence ?? smart?.confidence ?? (ocr?.amount ? 70 : null),
    raw: grok?.raw,
  };
}

/** Vision จาก data URL ขนานกับอัปโหลด + OCR.space */
export async function analyzeSlipFast(
  dataUrl: string,
  publicUrlP: Promise<string>,
): Promise<{ url: string; slip: SlipExtract }> {
  const grokP = raceMs(analyzeSlipWithGrok(dataUrl), 18000, null).catch(() => null);
  const ocrP = publicUrlP
    .then((url) => raceMs(extractSlipTextFromOcrSpace(url), 10000, null).then((ocr) => ({ url, ocr })))
    .catch(async () => ({ url: await publicUrlP, ocr: null }));

  const grok = await grokP;
  const { url, ocr } = await ocrP;
  return { url, slip: mergeSlip(grok, ocr?.legacy ?? null, ocr?.smart ?? null) };
}

export async function analyzeSlip(imageUrl: string): Promise<SlipExtract> {
  const grokP = raceMs(analyzeSlipWithGrok(imageUrl), 18000, null).catch(() => null);
  const ocrP = raceMs(extractSlipTextFromOcrSpace(imageUrl), 10000, null).catch(() => null);
  const grok = await grokP;
  const pack = await ocrP;
  return mergeSlip(grok, pack?.legacy ?? null, pack?.smart ?? null);
}

/** legacy helper — ใช้ในโค้ดเก่าที่รับแค่ยอด THB */
export async function extractThbAmount(imageUrl: string): Promise<number | null> {
  const r = await analyzeSlip(imageUrl);
  return r.thbAmount;
}

async function extractSlipTextFromOcrSpace(imageUrl: string): Promise<{
  legacy: ReturnType<typeof parseSlipText>;
  smart: ReturnType<typeof parseSmartSlip>;
} | null> {
  const key = process.env.OCR_SPACE_API_KEY;
  if (!key || !imageUrl) return null;
  try {
    const form = new URLSearchParams({
      apikey: key,
      url: imageUrl,
      OCREngine: '2',
      scale: 'true',
      isTable: 'true',
      detectOrientation: 'true',
      language: 'tha',
    });
    const res = await fetch('https://api.ocr.space/parse/imageurl', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const json: any = await res.json();
    const text: string | undefined = json?.ParsedResults?.[0]?.ParsedText;
    if (!text) return null;
    const legacy = parseSlipText(text);
    if (legacy.amount == null) legacy.amount = pickExplicitThbAmount(text);
    return { legacy, smart: parseSmartSlip(text) };
  } catch {
    return null;
  }
}

async function extractThbAmountFromOcrSpace(imageUrl: string): Promise<number | null> {
  const parsed = await extractSlipTextFromOcrSpace(imageUrl);
  return parsed?.smart.amount ?? parsed?.legacy.amount ?? null;
}
