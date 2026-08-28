import { decodeQrFromImage, extractInquiryFields, parseSlipPayload, type SlipQrResult } from './slipQr';

/** CJS require — test tsconfig is Node10 and cannot resolve package `exports` subpaths. */
type SlipProvider = {
  name: string;
  inquiry: (payload: string) => Promise<{ valid: boolean; data?: unknown }>;
};

const { inquiry } = require('slipverify') as {
  inquiry: (opts: { provider: SlipProvider; payload: string }) => Promise<{
    valid: boolean;
    data?: unknown;
    provider?: string;
  }>;
};

const {
  easyslip,
  kbank,
  rdcw,
  scb,
  slipok,
  thunder,
  truemoney,
} = require('slipverify/providers') as {
  easyslip: (c: { accessToken: string }) => SlipProvider;
  slipok: (c: { apiKey: string; branchId: string }) => SlipProvider;
  thunder: (c: { apiKey: string }) => SlipProvider;
  scb: (c: { apiKey: string; apiSecret: string; env?: 'sandbox' | 'production' }) => SlipProvider;
  kbank: (c: { clientId: string; clientSecret: string; env?: 'sandbox' | 'production' }) => SlipProvider;
  rdcw: (c: { clientId: string; clientSecret: string }) => SlipProvider;
  truemoney: (c: { accessToken: string }) => SlipProvider;
};

function env(name: string): string | null {
  const v = process.env[name]?.trim();
  return v ? v : null;
}

export function configuredSlipProvider(): { name: string; provider: SlipProvider } | null {
  const easy = env('EASYSLIP_ACCESS_TOKEN');
  if (easy) return { name: 'easyslip', provider: easyslip({ accessToken: easy }) };

  const slipokKey = env('SLIPOK_API_KEY');
  const slipokBranch = env('SLIPOK_BRANCH_ID');
  if (slipokKey && slipokBranch) return { name: 'slipok', provider: slipok({ apiKey: slipokKey, branchId: slipokBranch }) };

  const thunderKey = env('THUNDER_API_KEY') ?? env('SLIPVERIFY_THUNDER_API_KEY');
  if (thunderKey) return { name: 'thunder', provider: thunder({ apiKey: thunderKey }) };

  const scbKey = env('SCB_API_KEY');
  const scbSecret = env('SCB_API_SECRET');
  if (scbKey && scbSecret) {
    const sandbox = env('SCB_SLIP_ENV') === 'sandbox';
    return { name: 'scb', provider: scb({ apiKey: scbKey, apiSecret: scbSecret, env: sandbox ? 'sandbox' : 'production' }) };
  }

  const kId = env('KBANK_CLIENT_ID');
  const kSecret = env('KBANK_CLIENT_SECRET');
  if (kId && kSecret) {
    const sandbox = env('KBANK_SLIP_ENV') === 'sandbox';
    return { name: 'kbank', provider: kbank({ clientId: kId, clientSecret: kSecret, env: sandbox ? 'sandbox' : 'production' }) };
  }

  const rId = env('RDCW_CLIENT_ID');
  const rSecret = env('RDCW_CLIENT_SECRET');
  if (rId && rSecret) return { name: 'rdcw', provider: rdcw({ clientId: rId, clientSecret: rSecret }) };

  const tm = env('TRUEMONEY_ACCESS_TOKEN');
  if (tm) return { name: 'truemoney', provider: truemoney({ accessToken: tm }) };

  return null;
}

async function inquirePayload(payload: string): Promise<SlipQrResult['inquiry']> {
  const cfg = configuredSlipProvider();
  if (!cfg) return null;
  try {
    const inquiryP = inquiry({ provider: cfg.provider, payload }).catch(() => null);
    const raced = await Promise.race([
      inquiryP,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);
    if (!raced) return null;
    return extractInquiryFields(raced.data, cfg.name, Boolean(raced.valid));
  } catch (e) {
    console.warn('slipverify inquiry failed', cfg.name, e instanceof Error ? e.message : e);
    return null;
  }
}

export async function inspectSlipImage(buf: Buffer): Promise<SlipQrResult | null> {
  const payload = decodeQrFromImage(buf);
  if (!payload) return null;
  const parsed = parseSlipPayload(payload) ?? {
    payload,
    transRef: null,
    sendingBankCode: null,
    sendingBank: null,
  };
  const inquiryData = await inquirePayload(payload);
  return { ...parsed, payload, inquiry: inquiryData };
}
