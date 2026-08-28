import jpeg from 'jpeg-js';
import jsQR from 'jsqr';
import { isOcrJunkAmount } from './settleGuard';
import { normalizeBankCode } from '../botSecurity';
import type { SlipExtract } from '../grokVision';

const { slipVerify } = require('promptparse/validate') as {
  slipVerify: (payload: string) => { sendingBank?: string; transRef?: string } | null;
};

/** BOT 3-digit codes on slip-verify mini QR (sending bank). */
export const BOT_BANK: Record<string, string> = {
  '002': 'BBL',
  '004': 'KBANK',
  '006': 'KTB',
  '011': 'TTB',
  '014': 'SCB',
  '022': 'CIMB',
  '024': 'UOB',
  '025': 'BAY',
  '030': 'GSB',
  '033': 'GHB',
  '034': 'BAAC',
  '067': 'TISCO',
  '069': 'KKP',
  '073': 'LH',
};

export function botBank(code: string | null | undefined): string | null {
  const raw = String(code ?? '').trim();
  if (!raw) return null;
  if (BOT_BANK[raw]) return BOT_BANK[raw];
  if (/^[A-Z]{2,12}$/.test(raw.toUpperCase())) return raw.toUpperCase();
  return null;
}

export type SlipQrParse = {
  payload: string;
  transRef: string | null;
  sendingBankCode: string | null;
  sendingBank: string | null;
};

export type SlipInquiryData = {
  valid: boolean;
  provider: string | null;
  thb: number | null;
  receiverLast4: string | null;
  senderLast4: string | null;
  receiverBank: string | null;
  senderBank: string | null;
  receiverName: string | null;
  senderName: string | null;
  transRef: string | null;
};

export type SlipQrResult = SlipQrParse & {
  inquiry: SlipInquiryData | null;
};

export function parseSlipPayload(payload: string): SlipQrParse | null {
  const p = String(payload || '').trim();
  if (!p || p.length < 16) return null;
  try {
    const sv = slipVerify(p) as { sendingBank?: string; transRef?: string } | null;
    if (sv?.transRef) {
      return {
        payload: p,
        transRef: String(sv.transRef),
        sendingBankCode: sv.sendingBank ? String(sv.sendingBank) : null,
        sendingBank: botBank(sv.sendingBank),
      };
    }
  } catch {
    /* not a slip-verify mini QR */
  }
  return { payload: p, transRef: null, sendingBankCode: null, sendingBank: null };
}

function asNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('amount' in o) return asNum(o.amount);
    if ('local' in o && o.local && typeof o.local === 'object') {
      return asNum((o.local as Record<string, unknown>).amount);
    }
  }
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function asLast4(v: unknown): string | null {
  if (v != null && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return asLast4(o.bank ?? o.number ?? o.account ?? o.acc ?? o.accountNo);
  }
  const d = String(v ?? '').replace(/\D/g, '');
  return d.length >= 4 ? d.slice(-4) : null;
}

function asName(v: unknown): string | null {
  if (v != null && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return asName(o.name ?? o.accountName ?? o.account);
  }
  const s = String(v ?? '').trim();
  return s || null;
}

function partyBank(party: unknown): string | null {
  if (party == null || typeof party !== 'object') return null;
  const o = party as Record<string, unknown>;
  const bank = o.bank;
  if (bank != null && typeof bank === 'object') {
    const b = bank as Record<string, unknown>;
    return normalizeBankCode(String(b.short ?? b.name ?? b.id ?? '')) ?? botBank(String(b.id ?? ''));
  }
  return botBank(String(o.bankCode ?? o.bank ?? ''));
}

function partyAccount(party: unknown): unknown {
  if (party == null || typeof party !== 'object') return null;
  const o = party as Record<string, unknown>;
  return o.account ?? o.acc ?? o.accountNo ?? o.accountNumber;
}

export function extractInquiryFields(raw: unknown, provider: string | null, valid: boolean): SlipInquiryData {
  const root = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = (root.data && typeof root.data === 'object' ? root.data : root) as Record<string, unknown>;
  const receiver = d.receiver ?? d.to ?? d.transTo ?? d.receiverData;
  const sender = d.sender ?? d.from ?? d.transFrom ?? d.senderData;
  const thb = asNum(d.amount ?? d.transAmount ?? d.amountTHB);
  const transRef = d.transRef != null ? String(d.transRef) : d.trans_ref != null ? String(d.trans_ref) : null;
  return {
    valid,
    provider,
    thb,
    receiverLast4: asLast4(partyAccount(receiver) ?? d.receiverAccount ?? d.receiver_account),
    senderLast4: asLast4(partyAccount(sender) ?? d.senderAccount ?? d.sender_account),
    receiverBank: partyBank(receiver) ?? botBank(String(d.receiverBank ?? d.receiver_bank ?? '')),
    senderBank: partyBank(sender) ?? botBank(String(d.senderBank ?? d.sender_bank ?? '')),
    receiverName: asName(receiver) ?? asName(d.receiverName ?? d.receiver_name),
    senderName: asName(sender) ?? asName(d.senderName ?? d.sender_name),
    transRef: transRef && transRef !== 'undefined' ? transRef : null,
  };
}

export function applyQrToOcr(ocr: SlipExtract, qr: SlipQrResult): SlipExtract {
  const iq = qr.inquiry;
  let thb = iq?.thb ?? ocr.thbAmount;
  if (isOcrJunkAmount(thb) && qr.transRef) thb = iq?.thb ?? null;
  return {
    ...ocr,
    thbAmount: thb,
    receiverLast4: iq?.receiverLast4 ?? ocr.receiverLast4,
    senderLast4: iq?.senderLast4 ?? ocr.senderLast4,
    bank: iq?.receiverBank ?? ocr.bank,
    receiverName: iq?.receiverName ?? ocr.receiverName,
    senderName: iq?.senderName ?? ocr.senderName,
    confidence: iq?.valid ? 99 : ocr.confidence,
  };
}

export function decodeQrFromImage(buf: Buffer): string | null {
  if (!buf?.length) return null;
  try {
    const raw = jpeg.decode(buf, { maxMemoryUsageInMB: 48, maxResolutionInMP: 6, useTArray: true } as any);
    if (!raw?.data || !raw.width || !raw.height) return null;
    const result = jsQR(new Uint8ClampedArray(raw.data.buffer, raw.data.byteOffset, raw.data.byteLength), raw.width, raw.height, {
      inversionAttempts: 'attemptBoth',
    });
    const text = result?.data?.trim();
    return text || null;
  } catch {
    return null;
  }
}
