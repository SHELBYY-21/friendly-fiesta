import { fetchBinanceThUsdtRate } from './binance';

const BITKUB_V3 = 'https://api.bitkub.com/api/v3/market/ticker?sym=USDT_THB';
const BITKUB_ALL = 'https://api.bitkub.com/api/market/ticker';
const BOT_USD = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json';

let mktCache: { rate: number; at: number } | null = null;
let usdCache: { rate: number; at: number } | null = null;

function positive(n: unknown): number | null {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : null;
}

async function fetchBitkub(): Promise<number | null> {
  try {
    const res = await fetch(BITKUB_V3, { cache: 'no-store' });
    const json: any = await res.json();
    const row = Array.isArray(json) ? json[0] : json;
    const last = positive(row?.last);
    if (last) return last;
  } catch { /* next */ }
  try {
    const res = await fetch(BITKUB_ALL, { cache: 'no-store' });
    const json: any = await res.json();
    const last = positive(json?.THB_USDT?.last);
    if (last) return last;
  } catch { /* next source */ }
  return null;
}

/** Bitkub USDT_THB last, then Binance TH USDTTHB. Never env. Never desk rate. */
export async function fetchMktRate(): Promise<number | null> {
  if (mktCache && Date.now() - mktCache.at < 60_000) return mktCache.rate;
  const bitkub = await fetchBitkub();
  if (bitkub) {
    mktCache = { rate: bitkub, at: Date.now() };
    return bitkub;
  }
  const binance = await fetchBinanceThUsdtRate();
  const rate = binance ?? mktCache?.rate ?? null;
  if (rate) mktCache = { rate, at: Date.now() };
  return rate;
}

export async function fetchUsdThb(): Promise<number | null> {
  if (usdCache && Date.now() - usdCache.at < 60 * 60_000) return usdCache.rate;
  try {
    const res = await fetch(BOT_USD, { cache: 'no-store' });
    const json: any = await res.json();
    const thb = positive(json?.usd?.thb);
    if (thb) {
      usdCache = { rate: thb, at: Date.now() };
      return thb;
    }
  } catch { /* show dash */ }
  return usdCache?.rate ?? null;
}
