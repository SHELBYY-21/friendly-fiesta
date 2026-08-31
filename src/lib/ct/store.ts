import { supabaseAdmin } from '../supabaseAdmin';
import { makeRef, ymdBkk } from './format';
import { MAX_SLIP_THB } from './gate';

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
  created_at?: string | null;
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
    created_at: r.created_at ?? null,
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
  if (error) {
    if (error.code === '23505' && input.slip_fingerprint) {
      const existing = await findPendingByFingerprint(input.slip_fingerprint);
      if (existing) return existing;
    }
    throw new Error(`PENDING_SLIP_WRITE: ${error.message}`);
  }
  return mapRow(data);
}

export async function findPendingByFingerprint(fingerprint: string): Promise<PendingSlip | null> {
  const { data, error } = await supabaseAdmin
    .from('pending_slips')
    .select('*')
    .eq('slip_fingerprint', fingerprint)
    .maybeSingle();
  if (error) throw new Error(`PENDING_SLIP_READ: ${error.message}`);
  return data ? mapRow(data) : null;
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

export async function findSlipByShort(short: string): Promise<PendingSlip | null> {
  const raw = short.trim().toUpperCase().replace(/^#/, '');
  const ref = raw.includes('-') ? raw.split('-').pop() || raw : raw;
  if (!ref) return null;
  const { data, error } = await supabaseAdmin
    .from('pending_slips')
    .select('*')
    .eq('short_ref', ref)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`PENDING_SLIP_READ: ${error.message}`);
  return data ? mapRow(data) : null;
}

export async function listOpenPending(chatId?: number | null, limit = 40): Promise<PendingSlip[]> {
  let q = supabaseAdmin
    .from('pending_slips')
    .select('*')
    .in('status', ['PIN_MISMATCH', 'OCR_WEAK', 'NEED_UNIT', 'IN_READY', 'IN_READY_REVIEW', 'LOCKED', 'HOLD'])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (chatId != null) q = q.eq('chat_id', chatId);
  const { data, error } = await q;
  if (error) throw new Error(`PENDING_SLIP_LIST: ${error.message}`);
  return (data ?? []).map(mapRow);
}

export async function listLockedOpen(chatId: number): Promise<PendingSlip[]> {
  const { data, error } = await supabaseAdmin
    .from('pending_slips')
    .select('*')
    .eq('chat_id', chatId)
    .eq('status', 'LOCKED')
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw new Error(`PENDING_SLIP_LIST: ${error.message}`);
  return (data ?? []).map(mapRow);
}

/** Open LOCKED slips for a room — includes carry-over from previous days. */
export async function listLockedToday(chatId: number): Promise<PendingSlip[]> {
  return listLockedOpen(chatId);
}

export async function markSettledIfLocked(id: string, batchId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('pending_slips')
    .update({
      status: 'SETTLED',
      undo_until: null,
      note: `BATCH:${batchId}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'LOCKED')
    .select('id')
    .maybeSingle();
  if (error) throw new Error(`PENDING_SLIP_PATCH: ${error.message}`);
  return Boolean(data);
}

export async function quarantineOcrJunk(chatId?: number | null): Promise<string[]> {
  let q = supabaseAdmin
    .from('pending_slips')
    .select('id, short_ref, thb_in, status, note')
    .gt('thb_in', MAX_SLIP_THB)
    .in('status', ['PIN_MISMATCH', 'IN_READY', 'IN_READY_REVIEW', 'LOCKED', 'NEED_UNIT', 'OCR_WEAK']);
  if (chatId != null) q = q.eq('chat_id', chatId);
  const { data, error } = await q;
  if (error) throw new Error(`PENDING_SLIP_LIST: ${error.message}`);
  const marked: string[] = [];
  for (const row of data ?? []) {
    const note = String(row.note || '');
    if (row.status === 'OCR_WEAK' && note.includes('OCR_JUNK:AMOUNT_TOO_LARGE')) continue;
    const nextNote = note.includes('OCR_JUNK:AMOUNT_TOO_LARGE')
      ? note
      : [note, 'OCR_JUNK:AMOUNT_TOO_LARGE'].filter(Boolean).join('|');
    await supabaseAdmin
      .from('pending_slips')
      .update({
        status: 'OCR_WEAK',
        should_send: 0,
        note: nextNote,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .neq('status', 'SETTLED');
    marked.push(String(row.short_ref));
  }
  return marked;
}

/** Park live queue in place. Never deletes, never marks SETTLED, never sends USDT. */
export async function parkOpenQueue(chatId: number, tag: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('pending_slips')
    .select('id, short_ref, status, note')
    .eq('chat_id', chatId)
    .in('status', ['PIN_MISMATCH', 'OCR_WEAK', 'NEED_UNIT', 'IN_READY', 'IN_READY_REVIEW', 'HOLD', 'LOCKED']);
  if (error) throw new Error(`PENDING_SLIP_LIST: ${error.message}`);
  const marked: string[] = [];
  for (const row of data ?? []) {
    const note = String(row.note || '');
    if (row.status === 'HOLD' && note.includes(tag)) continue;
    const nextNote = note.includes(tag) ? note : [note, tag].filter(Boolean).join('|');
    await supabaseAdmin
      .from('pending_slips')
      .update({
        status: 'HOLD',
        undo_until: null,
        note: nextNote,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .neq('status', 'SETTLED');
    marked.push(String(row.short_ref));
  }
  return marked;
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
