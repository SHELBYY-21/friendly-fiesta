// ============================================================
// อ่านสลิป — ลำดับความสำคัญ:
//   1) Grok Vision (ถ้ามี GROK_API_KEY) — คืนข้อมูล structured ทั้งชุด
//   2) OCR.space (fallback) — คืนแค่ยอด THB
// ============================================================
import { analyzeSlipWithGrok, analyzeUsdtWithGrok, SlipExtract, UsdtExtract } from './grokVision';
import { pickExplicitThbAmount } from './ocrAmount';
import { parseSlipText } from '../bot/parse';

export type { SlipExtract, UsdtExtract };

/** อ่านสกรีนช็อตโอน USDT (Grok, 12s timeout) — null ถ้าอ่านไม่ได้/ไม่มี key */
export async function analyzeUsdtScreenshot(imageUrl: string): Promise<UsdtExtract | null> {
  try {
    return await Promise.race([
      analyzeUsdtWithGrok(imageUrl),
      new Promise<UsdtExtract | null>((resolve) => setTimeout(() => resolve(null), 12000)),
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
  return s != null && s.thbAmount != null && Boolean(s.receiverLast4);
}

function mergeSlip(grok: SlipExtract | null, ocr: ReturnType<typeof parseSlipText> | null): SlipExtract {
  return {
    thbAmount: grok?.thbAmount ?? ocr?.amount ?? null,
    time: grok?.time ?? ocr?.time ?? null,
    date: grok?.date ?? ocr?.date ?? null,
    receiverLast4: grok?.receiverLast4 || ocr?.last4 || null,
    senderLast4: grok?.senderLast4 ?? null,
    bank: grok?.bank || ocr?.bank || null,
    receiverName: grok?.receiverName || ocr?.receiverName || null,
    senderName: grok?.senderName ?? null,
    confidence: grok?.confidence ?? (ocr?.amount ? 70 : null),
    raw: grok?.raw,
  };
}

/** Vision จาก data URL ขนานกับอัปโหลด + OCR.space */
export async function analyzeSlipFast(
  dataUrl: string,
  publicUrlP: Promise<string>,
): Promise<{ url: string; slip: SlipExtract }> {
  const grokP = raceMs(analyzeSlipWithGrok(dataUrl), 7000, null).catch(() => null);
  const ocrP = publicUrlP
    .then((url) => raceMs(extractSlipTextFromOcrSpace(url), 5000, null).then((ocr) => ({ url, ocr })))
    .catch(async () => ({ url: await publicUrlP, ocr: null }));

  const grok = await grokP;
  if (visionReady(grok)) {
    const url = await publicUrlP;
    return { url, slip: grok };
  }
  const { url, ocr } = await ocrP;
  return { url, slip: mergeSlip(grok, ocr) };
}

export async function analyzeSlip(imageUrl: string): Promise<SlipExtract> {
  const grokP = raceMs(analyzeSlipWithGrok(imageUrl), 7000, null).catch(() => null);
  const ocrP = raceMs(extractSlipTextFromOcrSpace(imageUrl), 6000, null).catch(() => null);
  const grok = await grokP;
  if (visionReady(grok)) return grok;
  return mergeSlip(grok, await ocrP);
}

/** legacy helper — ใช้ในโค้ดเก่าที่รับแค่ยอด THB */
export async function extractThbAmount(imageUrl: string): Promise<number | null> {
  const r = await analyzeSlip(imageUrl);
  return r.thbAmount;
}

async function extractSlipTextFromOcrSpace(imageUrl: string): Promise<ReturnType<typeof parseSlipText> | null> {
  const key = process.env.OCR_SPACE_API_KEY;
  if (!key || !imageUrl) return null;
  try {
    const form = new URLSearchParams({
      apikey: key,
      url: imageUrl,
      OCREngine: '2',
      scale: 'true',
      isTable: 'true',
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
    const parsed = parseSlipText(text);
    if (parsed.amount == null) parsed.amount = pickExplicitThbAmount(text);
    return parsed;
  } catch {
    return null;
  }
}

async function extractThbAmountFromOcrSpace(imageUrl: string): Promise<number | null> {
  const parsed = await extractSlipTextFromOcrSpace(imageUrl);
  return parsed?.amount ?? null;
}
