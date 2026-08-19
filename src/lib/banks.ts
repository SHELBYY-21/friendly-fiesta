import { supabaseAdmin } from './supabaseAdmin';
import { normalizeBankCode } from './botSecurity';

export const MAX_PINNED_ACCOUNTS = 3;

export interface PinnedBank {
  id: string;
  bank_name: string;
  account_number: string | null;
  label: string;
}

function todayBangkok(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function accountLast4(value: string | null | undefined): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

export async function listPinnedBanks(chatId: number, date = todayBangkok()): Promise<PinnedBank[]> {
  const { data, error } = await supabaseAdmin
    .from('pinned_bank_accounts')
    .select('bank_account_id, bank_accounts(id, bank_name, account_number, label)')
    .eq('chat_id', chatId)
    .eq('pinned_for_date', date)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .map((row: any) => (Array.isArray(row.bank_accounts) ? row.bank_accounts[0] : row.bank_accounts))
    .filter(Boolean) as PinnedBank[];
}

export async function pinBankAccount(
  chatId: number,
  bankInput: string,
  accountInput: string,
): Promise<{ bank: PinnedBank; pinned: PinnedBank[] }> {
  const bankCode = normalizeBankCode(bankInput);
  const digits = accountInput.replace(/\D/g, '');
  if (!bankCode || digits.length < 4 || digits.length > 20) throw new Error('INVALID_BANK_ACCOUNT');

  const existingPins = await listPinnedBanks(chatId);
  const already = existingPins.find(
    (bank) => normalizeBankCode(bank.bank_name) === bankCode && accountLast4(bank.account_number) === digits.slice(-4),
  );
  if (already) return { bank: already, pinned: existingPins };
  if (existingPins.length >= MAX_PINNED_ACCOUNTS) throw new Error('PIN_LIMIT_REACHED');

  const { data: candidates, error: findError } = await supabaseAdmin
    .from('bank_accounts')
    .select('id, bank_name, account_number, label')
    .eq('bank_name', bankCode);
  if (findError) throw findError;
  let bank = (candidates ?? []).find((item: any) => accountLast4(item.account_number) === digits.slice(-4)) as PinnedBank | undefined;
  if (!bank) {
    const { data, error } = await supabaseAdmin
      .from('bank_accounts')
      .insert({ bank_name: bankCode, account_number: digits, label: `${bankCode} ••••${digits.slice(-4)}` })
      .select('id, bank_name, account_number, label')
      .single();
    if (error || !data) throw error ?? new Error('BANK_CREATE_FAILED');
    bank = data as PinnedBank;
  }

  const { error } = await supabaseAdmin.from('pinned_bank_accounts').insert({
    chat_id: chatId,
    bank_account_id: bank.id,
    pinned_for_date: todayBangkok(),
  });
  if (error && error.code !== '23505') throw error;
  return { bank, pinned: [...existingPins, bank] };
}

export async function unpinBankAccount(chatId: number, selector: string): Promise<PinnedBank | null> {
  const pinned = await listPinnedBanks(chatId);
  const compact = selector.replace(/\s+/g, '');
  let bank: PinnedBank | undefined;
  if (/^\d+$/.test(compact) && Number(compact) >= 1 && Number(compact) <= pinned.length && compact.length < 4) {
    bank = pinned[Number(compact) - 1];
  } else {
    const last4 = compact.replace(/\D/g, '').slice(-4);
    bank = pinned.find((item) => accountLast4(item.account_number) === last4);
  }
  if (!bank) return null;
  const { error } = await supabaseAdmin
    .from('pinned_bank_accounts')
    .delete()
    .eq('chat_id', chatId)
    .eq('bank_account_id', bank.id)
    .eq('pinned_for_date', todayBangkok());
  if (error) throw error;
  return bank;
}

export function matchPinnedBank(
  bankInput: string | null | undefined,
  last4Input: string | null | undefined,
  pinned: PinnedBank[],
): PinnedBank | null {
  const bankCode = normalizeBankCode(bankInput);
  const last4 = accountLast4(last4Input);
  if (!bankCode || !last4) return null;
  return pinned.find(
    (item) => normalizeBankCode(item.bank_name) === bankCode && accountLast4(item.account_number) === last4,
  ) ?? null;
}
