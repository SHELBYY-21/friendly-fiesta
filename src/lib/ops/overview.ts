export interface OpsTransaction {
  ledger_ref?: string | null;
  type: string;
  status?: string | null;
  thb_amount?: string | number | null;
  expected_usdt?: string | number | null;
  usdt_amount?: string | number | null;
  created_at: string;
}

export interface OpsPendingSlip {
  short_ref?: string | null;
  ledger_ref?: string | null;
  status: string;
  thb_in?: string | number | null;
  should_send?: string | number | null;
  bank?: string | null;
  account_masked?: string | null;
  created_at: string;
}

export interface OpsRate {
  sell_rate?: string | number | null;
  market_usdt_rate?: string | number | null;
  created_at: string;
}

export interface OpsBankAccount {
  label?: string | null;
  bank_name?: string | null;
  current_balance?: string | number | null;
  account_number?: string | null;
}

type Decimal = { coefficient: bigint; scale: number };

function decimal(value: string | number | null | undefined): Decimal {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(String(value ?? 0).trim());
  if (!match) throw new Error('INVALID_DECIMAL');
  const fraction = match[3] ?? '';
  return {
    coefficient: BigInt(`${match[2]}${fraction}`) * (match[1] === '-' ? -1n : 1n),
    scale: fraction.length,
  };
}

function render(value: Decimal): string {
  const negative = value.coefficient < 0n;
  let digits = (negative ? -value.coefficient : value.coefficient).toString();
  if (value.scale === 0) return `${negative ? '-' : ''}${digits}`;
  digits = digits.padStart(value.scale + 1, '0');
  const fraction = digits.slice(-value.scale).replace(/0+$/, '');
  return `${negative ? '-' : ''}${digits.slice(0, -value.scale)}${fraction ? `.${fraction}` : ''}`;
}

function add(left: string | number | null | undefined, right: string | number | null | undefined): string {
  const a = decimal(left);
  const b = decimal(right);
  const scale = Math.max(a.scale, b.scale);
  const coefficient = a.coefficient * 10n ** BigInt(scale - a.scale) + b.coefficient * 10n ** BigInt(scale - b.scale);
  return render({ coefficient, scale });
}

function subtract(left: string | number | null | undefined, right: string | number | null | undefined): string {
  const b = decimal(right);
  return add(left, render({ coefficient: -b.coefficient, scale: b.scale }));
}

function sum(values: Array<string | number | null | undefined>): string {
  return values.reduce<string>((total, value) => add(total, value), '0');
}

function bangkokDate(value: string | Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function maskedReference(value?: string | null): string | null {
  if (!value) return null;
  return `••••${value.slice(-4)}`;
}

export function buildOpsOverview(input: {
  transactions: OpsTransaction[];
  pendingSlips: OpsPendingSlip[];
  rates: OpsRate[];
  bankAccounts: OpsBankAccount[];
  now: Date;
  transactionLimit?: number;
}) {
  const businessDate = bangkokDate(input.now);
  const today = input.transactions.filter((row) => bangkokDate(row.created_at) === businessDate && row.status !== 'reversed');
  const sentUsdt = sum(today.map((row) => row.usdt_amount));
  const pendingUsdt = sum(today.map((row) => {
    const delta = subtract(row.expected_usdt, row.usdt_amount);
    return decimal(delta).coefficient > 0n ? delta : '0';
  }));
  const limit = input.transactionLimit ?? 1000;
  const capped = input.transactions.length >= limit;

  return {
    generatedAt: input.now.toISOString(),
    businessDate,
    mode: 'READ_ONLY' as const,
    totals: {
      thbIn: sum(today.filter((row) => row.type === 'THB_DEPOSIT').map((row) => row.thb_amount)),
      sentUsdt,
      pendingUsdt,
      transactions: today.length,
      pendingSlips: input.pendingSlips.length,
    },
    rate: input.rates[0] ? {
      sellRate: String(input.rates[0].sell_rate ?? '0'),
      marketRate: String(input.rates[0].market_usdt_rate ?? '0'),
      createdAt: input.rates[0].created_at,
    } : null,
    banks: input.bankAccounts.map((row) => ({
      label: row.label ?? null,
      bankName: row.bank_name ?? null,
      currentBalance: String(row.current_balance ?? '0'),
    })),
    recentTransactions: today.slice(0, 25).map((row) => ({
      reference: maskedReference(row.ledger_ref),
      type: row.type,
      status: row.status ?? null,
      thbAmount: String(row.thb_amount ?? '0'),
      expectedUsdt: String(row.expected_usdt ?? '0'),
      sentUsdt: String(row.usdt_amount ?? '0'),
      createdAt: row.created_at,
    })),
    pendingSlips: input.pendingSlips.slice(0, 25).map((row) => ({
      reference: maskedReference(row.ledger_ref ?? row.short_ref),
      status: row.status,
      thbIn: row.thb_in == null ? null : String(row.thb_in),
      shouldSend: row.should_send == null ? null : String(row.should_send),
      bank: row.bank ?? null,
      accountMasked: row.account_masked ?? null,
      createdAt: row.created_at,
    })),
    coverage: {
      complete: !capped,
      transactionsScanned: input.transactions.length,
      note: capped ? 'Current-day totals may be incomplete because the read cap was reached.' : null,
    },
  };
}

export type OpsOverview = ReturnType<typeof buildOpsOverview>;
