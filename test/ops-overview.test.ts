import assert from 'node:assert/strict';
import { buildOpsOverview } from '../src/lib/ops/overview';

const now = new Date('2026-10-08T05:00:00.000Z');

const empty = buildOpsOverview({ transactions: [], pendingSlips: [], rates: [], bankAccounts: [], now });
assert.equal(empty.businessDate, '2026-10-08');
assert.deepEqual(empty.totals, { thbIn: '0', sentUsdt: '0', pendingUsdt: '0', transactions: 0, pendingSlips: 0 });
assert.equal(empty.coverage.complete, true);

const overview = buildOpsOverview({
  now,
  transactionLimit: 3,
  transactions: [
    { ledger_ref: 'CE-SECRET-1234', type: 'THB_DEPOSIT', status: 'recorded', thb_amount: '1000.10', expected_usdt: '30.005', usdt_amount: '20.001', created_at: '2026-10-08T04:00:00.000Z' },
    { ledger_ref: 'CE-OTHER-9999', type: 'USDT_SEND', status: 'settled', thb_amount: '0', expected_usdt: '0', usdt_amount: '5.004', created_at: '2026-10-08T04:10:00.000Z' },
    { ledger_ref: 'CE-REVERSED', type: 'THB_DEPOSIT', status: 'reversed', thb_amount: '9999', expected_usdt: '999', usdt_amount: '999', created_at: '2026-10-08T04:20:00.000Z' },
  ],
  pendingSlips: [{ short_ref: 'A4F2', ledger_ref: 'CE-PENDING-A4F2', status: 'IN_READY', thb_in: '500', should_send: '15', bank: 'UNKNOWN BANK', account_masked: '••••1234', created_at: '2026-10-08T04:30:00.000Z' }],
  rates: [{ sell_rate: '36.7', market_usdt_rate: '34.8', created_at: '2026-10-08T04:45:00.000Z' }],
  bankAccounts: [{ label: 'Primary', bank_name: 'SCB', current_balance: '1250.25', account_number: '1234567890' }],
});

assert.deepEqual(overview.totals, { thbIn: '1000.1', sentUsdt: '25.005', pendingUsdt: '10.004', transactions: 2, pendingSlips: 1 });
assert.equal(overview.recentTransactions[0].reference, '••••1234');
assert.equal('accountNumber' in overview.banks[0], false);
assert.equal(overview.pendingSlips[0].bank, 'UNKNOWN BANK');
assert.equal(overview.coverage.complete, false);
assert.match(overview.coverage.note ?? '', /incomplete/i);

console.log('ops-overview ok');
