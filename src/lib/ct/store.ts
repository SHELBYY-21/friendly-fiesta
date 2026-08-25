import { supabaseAdmin } from '../supabaseAdmin';
import { makeRef, ymdBkk } from './format';

export type SlipStatus =
  | 'IN_READY'
  | 'IN_READY_REVIEW'
  | 'OCR_WEAK'
  | 'NEED_UNIT'
  | 'PIN_MISMATCH'
  | 'HOLD'
  | 'LOCKED'
  | 'SETTLED'
  | 'DELETED';

export interface PendingSlip {
  id: string;
  short_ref: string;
  date_key: string;
  ledger_ref: string;
  chat_id: number;
  admin_tg_id: number;
  admin_name: string | null;
  status: SlipStatus;
  thb_in: number | null;
  should_send: number | null;
  desk_rate: number | null;
  mkt_rate: number | null;
  bot_usd: number | null;
  bank: string | null;
  account_masked: string | null;
  name: string | null;
  pin_match: boolean;
  ocr_confidence: number | null;
  source_file_id: string | null;
  slip_url: string | null;
  slip_fingerprint: string | null;
  message_id: number | null;
  undo_until: string | null;
  tx_id: string | null;
  note: string | null;
  bank_account_id: string | null;
}

function mapRow(r: any): PendingSlip {
  return {
    id: r.id,
    short_ref: r.short_ref,
    date_key: r.date_key,
    ledger_ref: r.ledger_ref,
    chat_id: r.chat_id,
    admin_tg_id: r.admin_tg_id,
    admin_name: r.admin_name,
    status: r.status,
    thb_in: r.thb_in == null ? null : Number(r.thb_in),
    should_send: r.should_send == null ? null : Number(r.should_send),
    desk_rate: r.desk_rate == null ? null : Number(r.desk_rate),
    mkt_rate: r.mkt_rate == null ? null : Number(r.mkt_rate),
    bot_usd: r.bot_usd == null ? null : Number(r.bot_usd),
    bank: r.bank,
    account_masked: r.account_masked,
    name: r.name,
    pin_match: !!r.pin_match,
    ocr_confidence: r.ocr_confidence == null ? null : Number(r.ocr_confidence),
    source_file_id: r.source_file_id,
    slip_url: r.slip_url,
    slip_fingerprint: r.slip_fingerprint,
    message_id: r.message_id,
    undo_until: r.undo_until,
    tx_id: r.tx_id,
    note: r.note,
    bank_account_id: r.bank_account_id ?? null,
  };
}

export async function insertPending(input: Omit<PendingSlip, 'id' | 'short_ref' | 'date_key' | 'ledger_ref'> & {
  short_ref?: string;
  date_key?: string;
  ledger_ref?: string;
}): Promise<PendingSlip> {
  const ref = makeRef();
  const row = {
    short_ref: input.short_ref ?? ref.short,
    date_key: input.date_key ?? ref.ymd,
    ledger_ref: input.ledger_ref ?? ref.ledger,
    chat_id: input.chat_id,
    admin_tg_id: input.admin_tg_id,
    admin_name: input.admin_name,
    status: input.status,
    thb_in: input.thb_in,
    should_send: input.should_send,
    desk_rate: input.desk_rate,
    mkt_rate: input.mkt_rate,
    bot_usd: input.bot_usd,
    bank: input.bank,
    account_masked: input.account_masked,
    name: input.name,
    pin_match: input.pin_match,
    ocr_confidence: input.ocr_confidence,
    source_file_id: input.source_file_id,
    slip_url: input.slip_url,
    slip_fingerprint: input.slip_fingerprint,
    message_id: input.message_id,
    undo_until: input.undo_until,
    tx_id: input.tx_id,
    note: input.note,
    bank_account_id: input.bank_account_id ?? null,
  };
  const { data, error } = await supabaseAdmin.from('pending_slips').insert(row).select('*').single();
  if (error) throw new Error(`PENDING_SLIP_WRITE: ${error.message}`);
  return mapRow(data);
}

export async function findSlip(chatId: number, short: string, dateKey = ymdBkk()): Promise<PendingSlip | null> {
  const ref = short.trim().toUpperCase();
  const { data, error } = await supabaseAdmin
    .from('pending_slips')
    .select('*')
    .eq('chat_id', chatId)
    .eq('date_key', dateKey)
    .eq('short_ref', ref)
    .maybeSingle();
  if (error) throw new Error(`PENDING_SLIP_READ: ${error.message}`);
  if (data) return mapRow(data);
  const { data: anyDay } = await supabaseAdmin
    .from('pending_slips')
    .select('*')
    .eq('chat_id', chatId)
    .eq('short_ref', ref)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return anyDay ? mapRow(anyDay) : null;
}

export async function patchSlip(id: string, patch: Partial<PendingSlip>): Promise<PendingSlip> {
  const { data, error } = await supabaseAdmin
    .from('pending_slips')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(`PENDING_SLIP_PATCH: ${error.message}`);
  return mapRow(data);
}

export async function latestOpenSlip(chatId: number, adminTgId: number): Promise<PendingSlip | null> {
  const { data } = await supabaseAdmin
    .from('pending_slips')
    .select('*')
    .eq('chat_id', chatId)
    .eq('admin_tg_id', adminTgId)
    .in('status', ['IN_READY', 'IN_READY_REVIEW', 'OCR_WEAK', 'NEED_UNIT', 'PIN_MISMATCH', 'HOLD'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? mapRow(data) : null;
}
