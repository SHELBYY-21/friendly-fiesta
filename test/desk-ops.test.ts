const { matchPinnedBank, accountLast4Candidates } = require('../src/lib/banks');
const { statusChip, stateFromSlip } = require('../src/lib/ct/state');
const { gateOcr } = require('../src/lib/ct/gate');

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  console.log(`PASS: ${msg}`);
}

const ktb = { id: 'k1', bank_name: 'KTB', account_number: '6661260343', label: 'KTB' };
assert(accountLast4Candidates(ktb.account_number).includes('6034'), 'KTB masked 6034 is a last4 candidate');
assert(matchPinnedBank('KTB', '6034', [ktb])?.id === 'k1', 'masked KTB slip matches pinned 0343 account');
assert(matchPinnedBank('SCB', '7573', [ktb]) == null, 'other bank last4 does not match KTB pin');
assert(gateOcr({ thb: 500, confidence: 96, pinMatch: true }) === 'IN_READY', 'matched high-confidence is ready');
assert(gateOcr({ thb: 500, confidence: 96, pinMatch: false }) === 'PIN_MISMATCH', 'no pin is mismatch');
assert(statusChip(stateFromSlip({ slipStatus: 'PIN_MISMATCH', expectedUsdt: 12, sentUsdt: null })) === 'ERR', 'mismatch shows ERR');
console.log('desk-ops ok');
