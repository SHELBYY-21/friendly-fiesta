/** Daily house payout wallet + dest. Secrets stay in env; this is the switchable desk rail. */
import { supabaseAdmin } from '../supabaseAdmin';

export const PAYOUT_RAILS = ['sol-usdc', 'manual-trc20'] as const;
export type PayoutRail = (typeof PAYOUT_RAILS)[number];

export type PayoutWallet = {
  label: string;
  fromAddress: string;
  walletId: string;
  rail: PayoutRail;
  destAddress: string;
  updatedAt: string;
};

export function payoutSettingKey(chatId: number): string {
  return `payout_wallet:${chatId}`;
}

export function isPayoutRail(value: unknown): value is PayoutRail {
  return value === 'sol-usdc' || value === 'manual-trc20';
}

export function railLabel(rail: PayoutRail): string {
  return rail === 'sol-usdc' ? 'USDC · Solana' : 'USDT · TRC20 โอนมือ';
}

export function looksLikeSolAddr(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

export function looksLikeTronAddr(value: string): boolean {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value);
}

function cleanAddr(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, '').trim();
}

export function parsePayoutWallet(raw: unknown): PayoutWallet | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const rail = isPayoutRail(o.rail) ? o.rail : null;
  if (!rail) return null;
  const label = String(o.label ?? '').trim().slice(0, 40);
  const fromAddress = cleanAddr(o.fromAddress);
  const destAddress = cleanAddr(o.destAddress);
  const walletId = String(o.walletId ?? '').trim().slice(0, 80);
  const updatedAt = String(o.updatedAt ?? '').trim() || new Date().toISOString();
  if (!label && !fromAddress && !destAddress) return null;
  return { label, fromAddress, walletId, rail, destAddress, updatedAt };
}

export function normalizePayoutInput(input: {
  label?: string;
  fromAddress?: string;
  walletId?: string;
  rail?: string;
  destAddress?: string;
}): PayoutWallet {
  const rail: PayoutRail = isPayoutRail(input.rail) ? input.rail : 'manual-trc20';
  return {
    label: String(input.label ?? '').trim().slice(0, 40) || 'กระเป๋าวันนี้',
    fromAddress: cleanAddr(input.fromAddress),
    walletId: String(input.walletId ?? '').trim().slice(0, 80),
    rail,
    destAddress: cleanAddr(input.destAddress),
    updatedAt: new Date().toISOString(),
  };
}

export function payoutInputErrors(wallet: PayoutWallet): string[] {
  const errors: string[] = [];
  if (!wallet.fromAddress) errors.push('ใส่ที่อยู่กระเป๋าต้นทาง');
  if (wallet.rail === 'sol-usdc') {
    if (wallet.fromAddress && !looksLikeSolAddr(wallet.fromAddress)) {
      errors.push('ที่อยู่ต้นทางต้องเป็น Solana');
    }
    if (wallet.destAddress && !looksLikeSolAddr(wallet.destAddress)) {
      errors.push('ที่อยู่ลูกค้าต้องเป็น Solana');
    }
  }
  if (wallet.rail === 'manual-trc20') {
    if (wallet.fromAddress && !looksLikeTronAddr(wallet.fromAddress)) {
      errors.push('ที่อยู่ต้นทางต้องเป็น TRON (ขึ้นต้น T)');
    }
    if (wallet.destAddress && !looksLikeTronAddr(wallet.destAddress)) {
      errors.push('ที่อยู่ลูกค้าต้องเป็น TRON (ขึ้นต้น T)');
    }
  }
  return errors;
}

export async function readPayoutWallet(chatId: number): Promise<PayoutWallet | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', payoutSettingKey(chatId))
      .maybeSingle();
    if (error || data == null) return null;
    return parsePayoutWallet(data.value);
  } catch {
    return null;
  }
}

export async function writePayoutWallet(
  chatId: number,
  wallet: PayoutWallet,
  by = 'desk',
): Promise<void> {
  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      key: payoutSettingKey(chatId),
      value: wallet,
      updated_at: wallet.updatedAt,
      updated_by: by,
    },
    { onConflict: 'key' },
  );
  if (error) throw error;
}
