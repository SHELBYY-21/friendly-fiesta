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

/** Thai slips often mask a middle group, not the true last4.
 *  KTB 10-digit AAA-B-CCCCC-D e.g. 666-1-26034-3 → slip shows 6034, true last4 is 0343. */
export function accountLast4Candidates(value: string | null | undefined): string[] {
  const digits = String(value ?? '').replace(/\D/g, '');
  const out = new Set<string>();
  if (digits.length >= 4) out.add(digits.slice(-4));
  if (digits.length >= 5) out.add(digits.slice(-5, -1));
  if (digits.length === 10) out.add(digits.slice(5, 9));
  return [...out];
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
    .map((row: any) => row.bank_accounts)
    .filter(Boolean) as PinnedBank[];
}

export async function pinBankAccount(
  chatId: number,
  bankInput: string,
  accountInput: string,
  holderName?: string | null,
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
      .insert({
        bank_name: bankCode,
        account_number: digits,
        label: holderName
          ? `${holderName} · ${bankCode} ••••${digits.slice(-4)}`
          : `${bankCode} ••••${digits.slice(-4)}`,
      })
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
  const last4 = accountLast4(last4Input);
  if (!last4 || !pinned.length) return null;
  const last4Hits = pinned.filter((item) => accountLast4Candidates(item.account_number).includes(last4));
  if (!last4Hits.length) return null;
  if (last4Hits.length === 1) return last4Hits[0];
  const bankCode = normalizeBankCode(bankInput);
  if (!bankCode) return null;
  return last4Hits.find((item) => normalizeBankCode(item.bank_name) === bankCode) ?? null;
}

/** OCR often swaps payee/payer. Try receiver last4 first, then sender. */
export function matchSlipPins(
  bankInput: string | null | undefined,
  receiverLast4: string | null | undefined,
  senderLast4: string | null | undefined,
  pinned: PinnedBank[],
): PinnedBank | null {
  return matchPinnedBank(bankInput, receiverLast4, pinned)
    ?? matchPinnedBank(bankInput, senderLast4, pinned);
}

export async function ensureTodayPins(chatId: number): Promise<PinnedBank[]> {
  const today = todayBangkok();
  const have = await listPinnedBanks(chatId, today);
  if (have.length) return have;

  const { data: latest, error: latestErr } = await supabaseAdmin
    .from('pinned_bank_accounts')
    .select('pinned_for_date')
    .eq('chat_id', chatId)
    .order('pinned_for_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr) throw latestErr;
  const prevDate = latest?.pinned_for_date;
  if (!prevDate || prevDate === today) return have;

  const prev = await listPinnedBanks(chatId, prevDate);
  for (const bank of prev.slice(0, MAX_PINNED_ACCOUNTS)) {
    const { error } = await supabaseAdmin.from('pinned_bank_accounts').insert({
      chat_id: chatId,
      bank_account_id: bank.id,
      pinned_for_date: today,
    });
    if (error && error.code !== '23505') throw error;
  }
  return listPinnedBanks(chatId, today);
}
