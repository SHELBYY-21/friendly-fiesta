// ============================================================
// อ่านสลิป — ลำดับความสำคัญ:
//   1) Typhoon OCR + v2.5 (ถ้ามี TYPHOON_API_KEY) — สลิปไทย
//   2) Grok Vision (ถ้ามี GROK_API_KEY) — structured ทั้งชุด
//   3) AksonOCR / OCR.space + smart-slip-verifier parser
// ============================================================
import { analyzeSlipWithGrok, analyzeUsdtWithGrok, SlipExtract, UsdtExtract } from './grokVision';
import { analyzeSlipWithTyphoon } from './typhoon';
import { pickExplicitThbAmount } from './ocrAmount';
import { parseSlipText } from '../bot/parse';
import { parseSmartSlip } from './ct/smartSlip';
import { normalizeBankCode } from './botSecurity';
import { extractTextWithAkson } from './aksonOcr';

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

function mergeSlip(
  typhoon: SlipExtract | null,
  grok: SlipExtract | null,
  ocr: ReturnType<typeof parseSlipText> | null,
  smart?: ReturnType<typeof parseSmartSlip> | null,
): SlipExtract {
  return {
    thbAmount: typhoon?.thbAmount ?? grok?.thbAmount ?? smart?.amount ?? ocr?.amount ?? null,
    feeThb: typhoon?.feeThb ?? grok?.feeThb ?? smart?.fee ?? null,
    time: typhoon?.time ?? grok?.time ?? smart?.time ?? ocr?.time ?? null,
    date: typhoon?.date ?? grok?.date ?? smart?.date ?? ocr?.date ?? null,
    receiverLast4: typhoon?.receiverLast4 || grok?.receiverLast4 || smart?.receiverLast4 || ocr?.last4 || null,
    senderLast4: typhoon?.senderLast4 ?? grok?.senderLast4 ?? smart?.senderLast4 ?? null,
    receiverAccount: typhoon?.receiverAccount ?? grok?.receiverAccount ?? smart?.receiverAccount ?? null,
    senderAccount: typhoon?.senderAccount ?? grok?.senderAccount ?? null,
    bank: normalizeBankCode(typhoon?.bank || grok?.bank || smart?.bank || ocr?.bank) ?? null,
    senderBank: normalizeBankCode(typhoon?.senderBank ?? grok?.senderBank) ?? null,
    receiverName: typhoon?.receiverName || grok?.receiverName || smart?.receiverName || ocr?.receiverName || null,
    senderName: typhoon?.senderName ?? grok?.senderName ?? smart?.senderName ?? null,
    transRef: typhoon?.transRef ?? grok?.transRef ?? smart?.transRef ?? null,
    channel: typhoon?.channel ?? grok?.channel ?? null,
    promptpay: typhoon?.promptpay ?? grok?.promptpay ?? null,
    balanceThb: typhoon?.balanceThb ?? grok?.balanceThb ?? null,
    slipType: typhoon?.slipType ?? grok?.slipType ?? null,
    confidence: typhoon?.confidence ?? grok?.confidence ?? smart?.confidence ?? (ocr?.amount ? 70 : null),
    raw: [typhoon?.raw, grok?.raw].filter(Boolean).join('\n') || undefined,
  };
}

/** Vision จาก data URL ขนานกับอัปโหลด + OCR.space */
export async function analyzeSlipFast(
  dataUrl: string,
  publicUrlP: Promise<string>,
): Promise<{ url: string; slip: SlipExtract }> {
  const typhoonP = raceMs(analyzeSlipWithTyphoon(dataUrl), 22000, null).catch(() => null);
  const grokP = raceMs(analyzeSlipWithGrok(dataUrl), 18000, null).catch(() => null);
  const ocrP = publicUrlP
    .then((url) => raceMs(extractSlipTextFallback(url), 10000, null).then((ocr) => ({ url, ocr })))
    .catch(async () => ({ url: await publicUrlP, ocr: null }));

  const [typhoon, grok, pack] = await Promise.all([typhoonP, grokP, ocrP]);
  return { url: pack.url, slip: mergeSlip(typhoon, grok, pack.ocr?.legacy ?? null, pack.ocr?.smart ?? null) };
}

export async function analyzeSlip(imageUrl: string): Promise<SlipExtract> {
  const typhoonP = raceMs(analyzeSlipWithTyphoon(imageUrl), 22000, null).catch(() => null);
  const grokP = raceMs(analyzeSlipWithGrok(imageUrl), 18000, null).catch(() => null);
  const ocrP = raceMs(extractSlipTextFallback(imageUrl), 10000, null).catch(() => null);
  const [typhoon, grok, pack] = await Promise.all([typhoonP, grokP, ocrP]);
  return mergeSlip(typhoon, grok, pack?.legacy ?? null, pack?.smart ?? null);
}

/** legacy helper — ใช้ในโค้ดเก่าที่รับแค่ยอด THB */
export async function extractThbAmount(imageUrl: string): Promise<number | null> {
  const r = await analyzeSlip(imageUrl);
  return r.thbAmount;
}

function packParsedText(text: string): {
  legacy: ReturnType<typeof parseSlipText>;
  smart: ReturnType<typeof parseSmartSlip>;
} {
  const legacy = parseSlipText(text);
  if (legacy.amount == null) legacy.amount = pickExplicitThbAmount(text);
  return { legacy, smart: parseSmartSlip(text) };
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
    return packParsedText(text);
  } catch {
    return null;
  }
}

/** Fallback OCR: race OCR.space + AksonOCR; prefer OCR.space pack, else Akson markdown. */
async function extractSlipTextFallback(imageSrc: string): Promise<{
  legacy: ReturnType<typeof parseSlipText>;
  smart: ReturnType<typeof parseSmartSlip>;
} | null> {
  if (!imageSrc) return null;
  const ocrP = raceMs(extractSlipTextFromOcrSpace(imageSrc), 10000, null).catch(() => null);
  const aksonP = raceMs(extractTextWithAkson(imageSrc), 15000, null).catch(() => null);
  const [ocr, aksonText] = await Promise.all([ocrP, aksonP]);
  if (ocr) return ocr;
  if (aksonText) return packParsedText(aksonText);
  return null;
}

async function extractThbAmountFromOcrSpace(imageUrl: string): Promise<number | null> {
  const parsed = await extractSlipTextFallback(imageUrl);
  return parsed?.smart.amount ?? parsed?.legacy.amount ?? null;
}
