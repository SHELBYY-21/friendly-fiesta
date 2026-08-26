import { last4FromPayeeMask } from '../bot/parse';

export interface SlipExtract {
  thbAmount: number | null;
  time: string | null;
  date: string | null;
  receiverLast4: string | null;
  senderLast4: string | null;
  bank: string | null;
  receiverName: string | null;
  senderName: string | null;
  confidence: number | null;
  raw?: string;
}

const PROMPT = `You are an expert Thai bank slip parser (KPlus, SCB Easy, Krungthai NEXT, Bualuang, ttb, GSB, TrueMoney, LINE BK).
Reply with ONLY a JSON object:
{
  "thbAmount": number,
  "time": "HH:MM",
  "date": "DD/MM/YY",
  "receiverLast4": "XXXX",
  "senderLast4": "XXXX or null",
  "bank": "KBANK|SCB|BBL|KTB|BAY|TTB|GSB|KKP|CIMB|LH|UOB|TISCO|TRUEMONEY|PROMPTPAY",
  "receiverName": "name or null",
  "senderName": "name or null",
  "confidence": number|null
}
CRITICAL — account roles:
- receiverLast4 = PAYEE / บัญชีรับเงิน / ไปยัง / ผู้รับ / เข้าบัญชี. This is the desk account we match.
- senderLast4 = ผู้โอน / จาก / บัญชีต้นทาง. NEVER copy sender digits into receiverLast4.
- Krungthai NEXT mask xxx-x-x6034-x → 6034 when that mask is the payee or the incoming account.
- Do NOT use digits from เลขที่รายการ / COR / QR / barcode as last4.
- bank = bank of the RECEIVER. กรุงไทย → KTB. กสิกร/LINE BK → KBANK. ไทยพาณิชย์ → SCB.
- Incoming credit slips: the masked account on the slip is US (receiver).
Rules: raw JSON only. Buddhist year 2569 → 26. Unreadable fields = null. Never invent.`;

export interface UsdtExtract {
  amount: number | null;
  network: string | null;
  txid: string | null;
  time: string | null;
  confidence: number | null;
  raw?: string;
}

const USDT_PROMPT = `You are an expert crypto transfer screenshot parser for exchanges and wallets (Binance, OKX, Bitkub, Bybit, HTX, Gate.io, TronScan, Trust Wallet, MetaMask).
Analyze this screenshot and reply with ONLY a JSON object (no prose, no markdown fence):
{
  "amount": number,
  "network": "TRC20|ERC20|BEP20|SOL|POLYGON|null",
  "txid": "transaction hash or null",
  "time": "HH:MM or null",
  "confidence": number|null
}
Rules: Output raw JSON only. Do not invent values. If unreadable use null. Never infer currency.`;

const FAST_MODEL = 'grok-4.20-non-reasoning';
function pickModel(): string {
  const m = process.env.GROK_MODEL;
  if (!m || /grok-2-vision|grok-4\.5|grok-4\.3|reasoning$/i.test(m)) return FAST_MODEL;
  return m;
}

export async function analyzeUsdtWithGrok(imageUrl: string): Promise<UsdtExtract | null> {
  const key = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
  if (!key || !imageUrl) return null;
  const model = pickModel();
  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model, temperature: 0,
        messages: [{ role: 'user', content: [
          { type: 'text', text: USDT_PROMPT },
          { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
        ] }],
      }),
    });
    if (!res.ok) { console.error('Grok USDT error:', res.status); return null; }
    const json: any = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? '';
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const first = cleaned.indexOf('{'), last = cleaned.lastIndexOf('}');
    if (first < 0 || last < 0) return { amount: null, network: null, txid: null, time: null, confidence: null, raw: text };
    const data = JSON.parse(cleaned.slice(first, last + 1));
    const num = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.isFinite(parseFloat(v)) ? parseFloat(v) : null);
    const str = (v: any) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    return {
      amount: num(data.amount),
      network: str(data.network)?.toUpperCase() ?? null,
      txid: str(data.txid),
      time: str(data.time),
      confidence: num(data.confidence),
      raw: text,
    };
  } catch (e: any) {
    console.error('analyzeUsdtWithGrok error:', e?.message);
    return null;
  }
}

export async function analyzeSlipWithGrok(imageUrl: string): Promise<SlipExtract | null> {
  const key = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
  if (!key || !imageUrl) return null;
  const model = pickModel();

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error('Grok API error:', res.status, await res.text().catch(() => ''));
      return null;
    }
    const json: any = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? '';
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first < 0 || last < 0) {
      return {
        raw: text, thbAmount: null, time: null, date: null,
        receiverLast4: null, senderLast4: null, bank: null,
        receiverName: null, senderName: null, confidence: null,
      };
    }
    const data = JSON.parse(cleaned.slice(first, last + 1));
    const num = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.isFinite(parseFloat(v)) ? parseFloat(v) : null);
    const str = (v: any) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    const last4 = (v: any) => str(v)?.replace(/\D/g, '').slice(-4) || null;
    const receiverLast4 = last4(data.receiverLast4);
    const senderLast4 = last4(data.senderLast4);
    const fromMask = last4FromPayeeMask(text);
    let payee = fromMask || receiverLast4;
    if (senderLast4 && payee === senderLast4 && receiverLast4 && receiverLast4 !== senderLast4) {
      payee = receiverLast4;
    }

    return {
      thbAmount: num(data.thbAmount),
      time: str(data.time),
      date: str(data.date),
      receiverLast4: payee,
      senderLast4,
      bank: str(data.bank)?.toUpperCase() ?? null,
      receiverName: str(data.receiverName),
      senderName: str(data.senderName),
      confidence: num(data.confidence),
      raw: text,
    };
  } catch (e: any) {
    console.error('grokVision error:', e?.message);
    return null;
  }
}
