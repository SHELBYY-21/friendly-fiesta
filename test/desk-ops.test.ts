const { matchPinnedBank, matchSlipPins, accountLast4Candidates } = require('../src/lib/banks');
const { statusChip, stateFromSlip } = require('../src/lib/ct/state');
const { gateOcr, MAX_SLIP_THB } = require('../src/lib/ct/gate');
const { canAutoQueue } = require('../src/lib/ct/queue');
const {
  settleBlockReason,
  outgoingLedgerRef,
  outgoingIndexKeys,
  pinMatchesForSettle,
  HIGH_VALUE_THB,
  isOcrJunkAmount,
} = require('../src/lib/ct/settleGuard');

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  console.log(`PASS: ${msg}`);
}

const ktb = { id: 'k1', bank_name: 'KTB', account_number: '6661260343', label: 'KTB' };
const scb = { id: 's1', bank_name: 'SCB', account_number: '123457573', label: 'SCB' };
const pins = [ktb, scb];
assert(accountLast4Candidates(ktb.account_number).includes('6034'), 'KTB masked 6034 is a last4 candidate');
assert(matchPinnedBank('KTB', '6034', [ktb])?.id === 'k1', 'masked KTB slip matches pinned 0343 account');
assert(matchPinnedBank('SCB', '7573', [ktb]) == null, 'other bank last4 does not match KTB pin');
assert(matchSlipPins('SCB', '0209', '7573', [scb])?.id === 's1', 'OCR swap still matches sender last4 to pin');
assert(matchSlipPins('KTB', '6311', '0343', [ktb])?.id === 'k1', 'OCR swap still matches KTB pin');
assert(gateOcr({ thb: 500, confidence: 96, pinMatch: true }) === 'IN_READY', 'matched high-confidence is ready');
assert(gateOcr({ thb: 500, confidence: 96, pinMatch: false }) === 'PIN_MISMATCH', 'no pin is mismatch');
assert(gateOcr({ thb: 10_000_000, confidence: 99, pinMatch: true }) === 'OCR_WEAK', 'barcode 10M is OCR junk');
assert(gateOcr({ thb: 10_000_000, confidence: 99, pinMatch: false }) === 'OCR_WEAK', '10M junk even when pin mismatches');
assert(10_000_000 > MAX_SLIP_THB, '10M exceeds desk cap');
assert(isOcrJunkAmount(10_000_000) === true, '10M flagged as OCR junk');
assert(isOcrJunkAmount(31000) === false, '31k is not OCR junk');
assert(canAutoQueue('IN_READY', 500, 41) === true, 'normal slip can auto-queue');
assert(canAutoQueue('IN_READY', 10_000_000, 41) === false, '10M cannot auto-queue');
assert(statusChip(stateFromSlip({ slipStatus: 'PIN_MISMATCH', expectedUsdt: 12, sentUsdt: null })) === 'ERR', 'mismatch shows ERR');
assert(statusChip(stateFromSlip({ slipStatus: 'LOCKED', expectedUsdt: 24.39, sentUsdt: null })) === 'WAIT', 'locked slip is WAIT');
assert(statusChip(stateFromSlip({ slipStatus: 'OCR_WEAK', expectedUsdt: 0, sentUsdt: null })) === 'ERR', 'quarantined junk stays ERR');

const c416 = {
  status: 'LOCKED',
  thb_in: 31000,
  should_send: 756.1,
  bank: 'TTB',
  account_masked: '••••4987',
};
assert(c416.thb_in >= HIGH_VALUE_THB, 'C416 is high-value');
assert(settleBlockReason(c416, pins) === 'HIGH_VALUE', 'C416 TTB 31k is blocked as HIGH_VALUE');
assert(settleBlockReason(c416, pins, { confirmHigh: true }) === 'PIN_MISMATCH', 'C416 still blocked: TTB 4987 is not a shop pin');
assert(
  settleBlockReason({ status: 'LOCKED', thb_in: 1020, should_send: 24.88, bank: 'KTB', account_masked: '••••6034' }, pins) === null,
  'KTB 6034 locked slip can settle',
);
assert(
  settleBlockReason({ status: 'LOCKED', thb_in: 1000, should_send: 24.39, bank: 'KTB', account_masked: '••••0343' }, pins) === null,
  'KTB 0343 locked slip can settle',
);
assert(
  pinMatchesForSettle('SCB', '0343', pins) === false,
  'SCB 0343 does not match KTB pin even if last4 collides',
);
assert(
  settleBlockReason({ status: 'LOCKED', thb_in: 1090, should_send: 25.35, bank: 'SCB', account_masked: '••••0343' }, pins) === 'PIN_MISMATCH',
  'AFF2 SCB 0343 is account mismatch — do not auto-settle',
);
assert(
  settleBlockReason({ status: 'SETTLED', thb_in: 1020, should_send: 24.88, bank: 'KTB', account_masked: '••••6034' }, pins) === 'ALREADY_SETTLED',
  'second settle is idempotent skip',
);
assert(
  settleBlockReason({ status: 'LOCKED', thb_in: 10_000_000, should_send: 243902.44, bank: 'SCB', account_masked: null }, pins) === 'AMOUNT_TOO_LARGE',
  '10M never settles',
);
assert(
  settleBlockReason({ status: 'HOLD', thb_in: 1020, should_send: 24.88, bank: 'KTB', account_masked: '••••6034' }, pins) === 'NOT_LOCKED',
  'parked HOLD queue cannot settle',
);
assert(statusChip(stateFromSlip({ slipStatus: 'HOLD', expectedUsdt: 24.88, sentUsdt: null })) === 'ERR', 'parked HOLD is not WAIT');
assert(outgoingLedgerRef('CE-20260827-C416') === 'CE-20260827-C416-OUT', 'outgoing uses distinct ledger');
assert(outgoingLedgerRef('CE-20260827-C416-OUT') === 'CE-20260827-C416-OUT', 'outgoing suffix is stable');
assert(
  outgoingIndexKeys('CE-20260827-C416-OUT').includes('CE-20260827-C416'),
  'tape can join incoming deposit to -OUT send',
);
console.log('desk-ops ok');
