import { last4FromPayeeMask, nameFromPayee } from '../bot/parse';
import { parseSmartSlip } from './ct/smartSlip';
import type { SlipExtract } from './grokVision';

const BASE = () => (process.env.TYPHOON_BASE_URL || 'https://api.opentyphoon.ai/v1').replace(/\/$/, '');
const OCR_MODEL = () => process.env.TYPHOON_OCR_MODEL || 'typhoon-ocr';
const LLM_MODEL = () => process.env.TYPHOON_MODEL || 'typhoon-v2.5-30b-a3b-instruct';

const OCR_PROMPT = `Extract all text from this Thai bank transfer slip.

Instructions:
- Only return clean Markdown of everything visible.
- Do not redact account numbers, names, or references.
- Keep dashes in account numbers exactly as printed.
- Tables: use HTML <table>.
- Describe logos/bank names in Thai.`;

const JSON_PROMPT = `คุณเป็นผู้เชี่ยวชาญอ่านสลิปโอนเงินไทย (KPlus, SCB Easy, Krungthai NEXT, Bualuang, ttb touch, GSB, TrueMoney, LINE BK, PromptPay)
อ่านข้อความ OCR ด้านล่าง แล้วตอบเป็น JSON เท่านั้น ห้ามปิดบังเลขบัญชี ห้ามตัดท้ายสี่ตัว ห้ามแต่งข้อมูล
PAYEE = ไปยัง / ผู้รับ / เข้าบัญชี / บัญชีปลายทาง
SENDER = จาก / ผู้โอน / บัญชีต้นทาง
bank = ธนาคารของผู้รับ กรุงไทย=KTB กสิกร/LINE BK=KBANK ไทยพาณิชย์=SCB กรุงเทพ=BBL กรุงศรี=BAY
{
  "thbAmount": number,
  "feeThb": number|null,
  "time": "HH:MM:SS or HH:MM",
  "date": "DD/MM/YYYY",
  "receiverAccount": "full digits as printed, keep dashes",
  "senderAccount": "full digits as printed or null",
  "receiverLast4": "last 4 of PAYEE",
  "senderLast4": "last 4 of SENDER or null",
  "bank": "KBANK|SCB|BBL|KTB|BAY|TTB|GSB|KKP|CIMB|LH|UOB|TISCO|TRUEMONEY|PROMPTPAY",
  "senderBank": "same codes or null",
  "receiverName": "full payee name as printed",
  "senderName": "full sender name as printed",
  "transRef": "เลขที่รายการ / COR / Ref No",
  "channel": "KPLUS|SCB_EASY|KTB_NEXT|BBL|TTB|GSB|TRUEMONEY|LINEBK|PROMPTPAY|OTHER",
  "promptpay": "PromptPay id if shown",
  "balanceThb": number|null,
  "slipType": "TRANSFER|TOPUP|BILL|WITHDRAW|OTHER",
  "confidence": 0-100
}
Raw JSON only.`;

const EMPTY = (): SlipExtract => ({
  thbAmount: null, feeThb: null, time: null, date: null,
  receiverLast4: null, senderLast4: null, receiverAccount: null, senderAccount: null,
  bank: null, senderBank: null, receiverName: null, senderName: null,
  transRef: null, channel: null, promptpay: null, balanceThb: null,
  slipType: null, confidence: null,
});

export function typhoonKey(): string | null {
  const k = process.env.TYPHOON_API_KEY || process.env.TYPHOON_OCR_API_KEY || process.env.OPENTYPHOON_API_KEY;
  return k && k.trim() && !/YOUR_API_KEY|placeholder/i.test(k) ? k.trim() : null;
}

const num = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v)
    ? v
    : Number.isFinite(parseFloat(String(v ?? '').replace(/,/g, '')))
      ? parseFloat(String(v).replace(/,/g, ''))
      : null;
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const last4 = (v: unknown) => str(v)?.replace(/\D/g, '').slice(-4) || null;

function parseJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first < 0 || last < 0) return null;
  try { return JSON.parse(cleaned.slice(first, last + 1)); } catch { return null; }
}

async function chat(opts: {
  model: string;
  messages: unknown[];
  maxTokens?: number;
  temperature?: number;
}): Promise<string | null> {
  const key = typhoonKey();
  if (!key) return null;
  const res = await fetch(`${BASE()}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.1,
      top_p: 0.6,
      repetition_penalty: 1.2,
      stream: false,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    console.error('Typhoon error:', opts.model, res.status, await res.text().catch(() => ''));
    return null;
  }
  const json: any = await res.json();
  return json?.choices?.[0]?.message?.content ?? null;
}

async function asDataUrl(src: string): Promise<string | null> {
  if (src.startsWith('data:')) return src;
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 4_500_000) return null;
    const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0];
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

export function slipFromTyphoonJson(text: string, markdown?: string): SlipExtract {
  const data = parseJsonObject(text);
  const smart = markdown ? parseSmartSlip(markdown) : null;
  if (!data) {
    return {
      ...EMPTY(),
      thbAmount: smart?.amount ?? null,
      receiverLast4: smart?.receiverLast4 ?? null,
      receiverAccount: smart?.receiverAccount ?? null,
      receiverName: smart?.receiverName ?? null,
      senderName: smart?.senderName ?? null,
      bank: smart?.bank ?? null,
      transRef: smart?.transRef ?? null,
      time: smart?.time ?? null,
      date: smart?.date ?? null,
      confidence: smart?.confidence ?? null,
      raw: [markdown, text].filter(Boolean).join('\n'),
    };
  }
  const receiverLast4 = last4(data.receiverLast4) || last4(data.receiverAccount) || smart?.receiverLast4 || null;
  const senderLast4 = last4(data.senderLast4) || last4(data.senderAccount) || smart?.senderLast4 || null;
  const fromMask = last4FromPayeeMask(text + '\n' + (markdown || ''));
  let payee = fromMask || receiverLast4;
  if (senderLast4 && payee === senderLast4 && receiverLast4 && receiverLast4 !== senderLast4) {
    payee = receiverLast4;
  }
  return {
    thbAmount: num(data.thbAmount) ?? smart?.amount ?? null,
    feeThb: num(data.feeThb) ?? smart?.fee ?? null,
    time: str(data.time) ?? smart?.time ?? null,
    date: str(data.date) ?? smart?.date ?? null,
    receiverLast4: payee,
    senderLast4,
    receiverAccount: str(data.receiverAccount) ?? smart?.receiverAccount ?? null,
    senderAccount: str(data.senderAccount),
    bank: str(data.bank)?.toUpperCase() ?? smart?.bank ?? null,
    senderBank: str(data.senderBank)?.toUpperCase() ?? null,
    receiverName: str(data.receiverName) || nameFromPayee(text) || smart?.receiverName || null,
    senderName: str(data.senderName) ?? smart?.senderName ?? null,
    transRef: str(data.transRef) ?? smart?.transRef ?? null,
    channel: str(data.channel)?.toUpperCase() ?? null,
    promptpay: str(data.promptpay),
    balanceThb: num(data.balanceThb),
    slipType: str(data.slipType)?.toUpperCase() ?? null,
    confidence: num(data.confidence) ?? smart?.confidence ?? 80,
    raw: [markdown, text].filter(Boolean).join('\n'),
  };
}

export async function analyzeSlipWithTyphoon(imageUrl: string): Promise<SlipExtract | null> {
  if (!typhoonKey() || !imageUrl) return null;
  try {
    const dataUrl = await asDataUrl(imageUrl);
    if (!dataUrl) return null;
    const markdown = await chat({
      model: OCR_MODEL(),
      maxTokens: 4096,
      temperature: 0.1,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: OCR_PROMPT },
        ],
      }],
    });
    if (!markdown || markdown.trim().length < 8) return null;
    const jsonText = await chat({
      model: LLM_MODEL(),
      maxTokens: 900,
      temperature: 0,
      messages: [
        { role: 'system', content: 'You are Typhoon created by SCB 10X. Reply with raw JSON only.' },
        { role: 'user', content: `${JSON_PROMPT}\n\nOCR:\n${markdown.slice(0, 6000)}` },
      ],
    });
    return slipFromTyphoonJson(jsonText || '', markdown);
  } catch (e: any) {
    console.error('Typhoon OCR error:', e?.message);
    return null;
  }
}
