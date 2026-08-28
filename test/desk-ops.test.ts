const { matchPinnedBank, matchSlipPins, accountLast4Candidates } = require('../src/lib/banks');
const { statusChip, stateFromSlip } = require('../src/lib/ct/state');
const { gateOcr, MAX_SLIP_THB } = require('../src/lib/ct/gate');
const { canAutoQueue } = require('../src/lib/ct/queue');

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  console.log(`PASS: ${msg}`);
}

const ktb = { id: 'k1', bank_name: 'KTB', account_number: '6661260343', label: 'KTB' };
const scb = { id: 's1', bank_name: 'SCB', account_number: '123457573', label: 'SCB' };
assert(accountLast4Candidates(ktb.account_number).includes('6034'), 'KTB masked 6034 is a last4 candidate');
assert(matchPinnedBank('KTB', '6034', [ktb])?.id === 'k1', 'masked KTB slip matches pinned 0343 account');
assert(matchPinnedBank('SCB', '7573', [ktb]) == null, 'other bank last4 does not match KTB pin');
assert(matchSlipPins('SCB', '0209', '7573', [scb])?.id === 's1', 'OCR swap still matches sender last4 to pin');
assert(matchSlipPins('KTB', '6311', '0343', [ktb])?.id === 'k1', 'OCR swap still matches KTB pin');
assert(gateOcr({ thb: 500, confidence: 96, pinMatch: true }) === 'IN_READY', 'matched high-confidence is ready');
assert(gateOcr({ thb: 500, confidence: 96, pinMatch: false }) === 'PIN_MISMATCH', 'no pin is mismatch');
assert(gateOcr({ thb: 10_000_000, confidence: 99, pinMatch: true }) === 'OCR_WEAK', 'barcode 10M is OCR junk');
assert(10_000_000 > MAX_SLIP_THB, '10M exceeds desk cap');
assert(canAutoQueue('IN_READY', 500, 41) === true, 'normal slip can auto-queue');
assert(canAutoQueue('IN_READY', 10_000_000, 41) === false, '10M cannot auto-queue');
assert(statusChip(stateFromSlip({ slipStatus: 'PIN_MISMATCH', expectedUsdt: 12, sentUsdt: null })) === 'ERR', 'mismatch shows ERR');
assert(statusChip(stateFromSlip({ slipStatus: 'LOCKED', expectedUsdt: 24.39, sentUsdt: null })) === 'WAIT', 'locked slip is WAIT');
console.log('desk-ops ok');
