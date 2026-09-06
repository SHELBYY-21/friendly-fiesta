import { last4FromPayeeMask, nameFromPayee } from '../bot/parse';

export interface SlipExtract {
  thbAmount: number | null;
  feeThb: number | null;
  time: string | null;
  date: string | null;
  receiverLast4: string | null;
  senderLast4: string | null;
  receiverAccount: string | null;
  senderAccount: string | null;
  bank: string | null;
  senderBank: string | null;
  receiverName: string | null;
  senderName: string | null;
  transRef: string | null;
  channel: string | null;
  promptpay: string | null;
  balanceThb: number | null;
  slipType: string | null;
  confidence: number | null;
  raw?: string;
}

const EMPTY_SLIP = (): SlipExtract => ({
  thbAmount: null, feeThb: null, time: null, date: null,
  receiverLast4: null, senderLast4: null, receiverAccount: null, senderAccount: null,
  bank: null, senderBank: null, receiverName: null, senderName: null,
  transRef: null, channel: null, promptpay: null, balanceThb: null,
  slipType: null, confidence: null,
});

const PROMPT = `You are an expert Thai bank-slip OCR. Read EVERY visible field. Do not redact. Do not skip PII. Do not invent.
Banks: KPlus, SCB Easy, Krungthai NEXT, Bualuang mBanking, ttb touch, GSB, TrueMoney, LINE BK, PromptPay, Paotang, KMA, CIMB.
Reply with ONLY a JSON object:
{
  "thbAmount": number,
  "feeThb": number|null,
  "time": "HH:MM:SS or HH:MM",
  "date": "DD/MM/YYYY",
  "receiverAccount": "full digits as printed, keep dashes if shown",
  "senderAccount": "full digits as printed or null",
  "receiverLast4": "last 4 of PAYEE",
  "senderLast4": "last 4 of SENDER or null",
  "bank": "KBANK|SCB|BBL|KTB|BAY|TTB|GSB|KKP|CIMB|LH|UOB|TISCO|TRUEMONEY|PROMPTPAY",
  "senderBank": "same codes or null",
  "receiverName": "full payee name exactly as printed, keep titles",
  "senderName": "full sender name exactly as printed, keep titles",
  "transRef": "เลขที่รายการ / COR / Ref No full string",
  "channel": "KPLUS|SCB_EASY|KTB_NEXT|BBL|TTB|GSB|TRUEMONEY|LINEBK|PROMPTPAY|OTHER",
  "promptpay": "PromptPay id / phone / national id if shown",
  "balanceThb": number|null,
  "slipType": "TRANSFER|TOPUP|BILL|WITHDRAW|OTHER",
  "confidence": 0-100
}
Roles:
- PAYEE = ไปยัง / ผู้รับ / เข้าบัญชี / บัญชีปลายทาง. That is receiver*.
- SENDER = จาก / ผู้โอน / บัญชีต้นทาง. That is sender*.
- K+ stacked: top name+bank = sender, bottom = receiver.
- bank = RECEIVER bank. กรุงไทย=KTB กสิกร/LINE BK=KBANK ไทยพาณิชย์=SCB กรุงเทพ=BBL กรุงศรี=BAY.
- transRef is เลขที่รายการ, not account digits.
- Copy names and account numbers exactly. Buddhist year 2569 → 2026 in date if you normalize, or keep BE.
Raw JSON only. Unreadable = null.`;

export interface UsdtExtract {
  amount: number | null;
  fee: number | null;
  network: string | null;
  txid: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  time: string | null;
  status: string | null;
  confidence: number | null;
  raw?: string;
}

const USDT_PROMPT = `You are an expert crypto transfer screenshot OCR (Binance, OKX, Bitkub, Bybit, HTX, Gate, TronScan, Trust, MetaMask, Tonkeeper).
Read EVERY visible field. Do not redact addresses. Reply ONLY JSON:
{
  "amount": number,
  "fee": number|null,
  "network": "TRC20|ERC20|BEP20|SOL|POLYGON|TON|null",
  "txid": "full hash",
  "fromAddress": "full or null",
  "toAddress": "full or null",
  "time": "as printed",
  "status": "SUCCESS|PENDING|FAILED|null",
  "confidence": 0-100
}
Raw JSON only. Do not invent. Unreadable = null.`;

const FAST_MODEL = 'grok-4.20-non-reasoning';
function pickModel(): string {
  const m = process.env.GROK_MODEL;
  if (!m || /grok-2-vision|grok-4\.5|grok-4\.3|reasoning$/i.test(m)) return FAST_MODEL;
  return m;
}

const num = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.isFinite(parseFloat(v)) ? parseFloat(String(v).replace(/,/g, '')) : null);
const str = (v: any) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const last4 = (v: any) => str(v)?.replace(/\D/g, '').slice(-4) || null;

function parseJsonObject(text: string): any | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first < 0 || last < 0) return null;
  try { return JSON.parse(cleaned.slice(first, last + 1)); } catch { return null; }
}

async function vision(imageUrl: string, prompt: string): Promise<string | null> {
  const key = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
  if (!key || !imageUrl) return null;
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: pickModel(),
      temperature: 0,
      max_tokens: 1400,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
        ],
      }],
    }),
  });
  if (!res.ok) {
    console.error('Grok vision error:', res.status, await res.text().catch(() => ''));
    return null;
  }
  const json: any = await res.json();
  return json?.choices?.[0]?.message?.content ?? '';
}

export async function analyzeUsdtWithGrok(imageUrl: string): Promise<UsdtExtract | null> {
  try {
    const text = await vision(imageUrl, USDT_PROMPT);
    if (text == null) return null;
    const data = parseJsonObject(text) || {};
    return {
      amount: num(data.amount),
      fee: num(data.fee),
      network: str(data.network)?.toUpperCase() ?? null,
      txid: str(data.txid),
      fromAddress: str(data.fromAddress),
      toAddress: str(data.toAddress),
      time: str(data.time),
      status: str(data.status)?.toUpperCase() ?? null,
      confidence: num(data.confidence),
      raw: text,
    };
  } catch (e: any) {
    console.error('analyzeUsdtWithGrok error:', e?.message);
    return null;
  }
}

export async function analyzeSlipWithGrok(imageUrl: string): Promise<SlipExtract | null> {
  try {
    const text = await vision(imageUrl, PROMPT);
    if (text == null) return null;
    const data = parseJsonObject(text);
    if (!data) return { ...EMPTY_SLIP(), raw: text };

    const receiverLast4 = last4(data.receiverLast4) || last4(data.receiverAccount);
    const senderLast4 = last4(data.senderLast4) || last4(data.senderAccount);
    const fromMask = last4FromPayeeMask(text);
    let payee = fromMask || receiverLast4;
    if (senderLast4 && payee === senderLast4 && receiverLast4 && receiverLast4 !== senderLast4) {
      payee = receiverLast4;
    }

    const receiverName = str(data.receiverName) || nameFromPayee(text);
    const senderName = str(data.senderName);

    return {
      thbAmount: num(data.thbAmount),
      feeThb: num(data.feeThb),
      time: str(data.time),
      date: str(data.date),
      receiverLast4: payee,
      senderLast4,
      receiverAccount: str(data.receiverAccount),
      senderAccount: str(data.senderAccount),
      bank: str(data.bank)?.toUpperCase() ?? null,
      senderBank: str(data.senderBank)?.toUpperCase() ?? null,
      receiverName,
      senderName,
      transRef: str(data.transRef),
      channel: str(data.channel)?.toUpperCase() ?? null,
      promptpay: str(data.promptpay),
      balanceThb: num(data.balanceThb),
      slipType: str(data.slipType)?.toUpperCase() ?? null,
      confidence: num(data.confidence),
      raw: text,
    };
  } catch (e: any) {
    console.error('grokVision error:', e?.message);
    return null;
  }
}
