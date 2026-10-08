import type { OutgoingMessage } from '../telegram';
import { escapeTelegramHtml } from '../botSecurity';
import { findReceiversByLast4 } from '../receivers';
import { supabaseAdmin } from '../supabaseAdmin';
import { getAdminByTelegramId, getLatestRates } from '../transactions';

export interface OperatorHistoryItem {
  bank: string | null;
  last4: string;
  name: string | null;
  count: number;
  totalThb: number;
  totalUsdt: number;
  status: string;
}

export interface OperatorStatusItem {
  reference: string;
  status: string;
  thb: number;
  usdt: number;
}

export interface OperatorCommandServices {
  isAuthorized(userId: number): Promise<boolean>;
  getRates(): Promise<{ sellRate: number; marketRate: number | null }>;
  findHistory(last4: string): Promise<OperatorHistoryItem[]>;
  findStatus(reference: string): Promise<OperatorStatusItem | null>;
  getBalance(): Promise<{ thb: number; accounts: number }>;
}

export interface OperatorCommandInput {
  chatId: number;
  userId: number;
  text: string;
  updateId?: number;
}

const money = (value: number) => Number(value || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const usdt = (value: number) => (Math.round((Number(value || 0) + Number.EPSILON) * 10_000) / 10_000).toFixed(4);

export function createOperatorCommandHandler(services: OperatorCommandServices) {
  return async (input: OperatorCommandInput): Promise<OutgoingMessage | null> => {
    const match = input.text.trim().match(/^\/(history|status|rates|balance|demo)(?:@[a-z0-9_]+)?(?:\s+(.*))?$/i);
    if (!match) return null;
    if (!(await services.isAuthorized(input.userId))) {
      return { text: '⛔ คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลระบบ' };
    }

    const command = match[1].toLowerCase();
    const argument = (match[2] ?? '').trim();
    if (command === 'history') {
      const last4 = argument.match(/\d{4}/)?.[0];
      if (!last4) return { text: 'วิธีใช้: <code>/history 1234</code>' };
      const rows = await services.findHistory(last4);
      if (!rows.length) return { text: `ไม่พบประวัติเลขท้าย <code>${last4}</code>` };
      return {
        text: rows.slice(0, 3).map((row) => [
          `🏦 <b>${escapeTelegramHtml(row.bank ?? 'UNKNOWN')} ••••${escapeTelegramHtml(row.last4)}</b>`,
          escapeTelegramHtml(row.name ?? 'ไม่ระบุชื่อ'),
          `${row.count} รายการ · ${money(row.totalThb)} THB · ${usdt(row.totalUsdt)} USDT`,
          `สถานะ: ${escapeTelegramHtml(row.status)}`,
        ].join('\n')).join('\n\n'),
      };
    }

    if (command === 'status') {
      if (!argument) return { text: 'วิธีใช้: <code>/status CE-...</code>' };
      const row = await services.findStatus(argument);
      if (!row) return { text: `ไม่พบรายการ <code>${escapeTelegramHtml(argument)}</code>` };
      return { text: `📌 <code>${escapeTelegramHtml(row.reference)}</code>\nสถานะ: <b>${escapeTelegramHtml(row.status)}</b>\n${money(row.thb)} THB · ${usdt(row.usdt)} USDT` };
    }

    if (command === 'rates') {
      const row = await services.getRates();
      return { text: `💱 เรตขาย <b>${money(row.sellRate)}</b> THB/USDT\nเรตตลาด ${row.marketRate == null ? '—' : money(row.marketRate)} THB/USDT` };
    }

    if (command === 'balance') {
      const row = await services.getBalance();
      return { text: `🏦 ยอดบัญชีรวม <b>${money(row.thb)} THB</b>\n${row.accounts} บัญชี` };
    }

    return {
      text: '🧪 <b>DEMO</b> — โหมดสาธิตแบบอ่านอย่างเดียว\n/history 1234 · /status CE-... · /rates · /balance',
    };
  };
}

const defaultServices: OperatorCommandServices = {
  isAuthorized: async (userId) => Boolean(await getAdminByTelegramId(userId)),
  getRates: async () => {
    const rates = await getLatestRates();
    return { sellRate: rates.sellRate, marketRate: rates.marketUsdtRate };
  },
  findHistory: async (last4) => (await findReceiversByLast4(last4)).map((row) => ({
    bank: row.bank,
    last4: row.account_last4,
    name: row.receiver_name,
    count: row.total_transactions,
    totalThb: Number(row.total_amount_thb),
    totalUsdt: Number(row.total_usdt),
    status: row.status,
  })),
  findStatus: async (reference) => {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('ledger_ref,status,thb_amount,usdt_amount')
      .eq('ledger_ref', reference)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      reference: String(data.ledger_ref),
      status: String(data.status ?? 'recorded'),
      thb: Number(data.thb_amount ?? 0),
      usdt: Number(data.usdt_amount ?? 0),
    };
  },
  getBalance: async () => {
    const { data, error } = await supabaseAdmin.from('bank_accounts').select('current_balance');
    if (error) throw error;
    const rows = data ?? [];
    return { thb: rows.reduce((sum, row) => sum + Number(row.current_balance ?? 0), 0), accounts: rows.length };
  },
};

export const handleOperatorCommand = createOperatorCommandHandler(defaultServices);
