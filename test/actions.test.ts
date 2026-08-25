const { routeIncomingSlip, routeOutgoingSlip } = require('../src/lib/actions');

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  console.log(`PASS: ${msg}`);
}

const pinnedBanks = [
  { id: 'b1', bank_name: 'KBANK', account_number: '1234567890', label: '' },
  { id: 'b2', bank_name: 'SCB', account_number: '9876543210', label: '' },
];

const autoRoute = routeIncomingSlip({
  authorized: true,
  ocrThb: 500,
  ocrConfidence: 96,
  ocrAutoMin: 90,
  pinned: pinnedBanks,
  ocrBank: 'KBANK',
  ocrLast4: '7890',
});
assert(autoRoute.level === 'AUTO' && autoRoute.thb === 500 && autoRoute.bank.id === 'b1', 'high-confidence matched slip routes AUTO');
assert(routeIncomingSlip({
  authorized: true, ocrThb: 500, ocrConfidence: 40, ocrAutoMin: 90,
  pinned: pinnedBanks, ocrBank: 'KBANK', ocrLast4: '7890',
}).level === 'REVIEW', 'low-confidence OCR never auto-commits');
assert(routeIncomingSlip({
  authorized: true, ocrThb: 500, ocrConfidence: 96, ocrAutoMin: 90,
  pinned: pinnedBanks, ocrBank: 'KBANK', ocrLast4: '0000',
}).reason === 'account_mismatch', 'account mismatch stays in REVIEW');
assert(routeIncomingSlip({
  authorized: true, manualThb: 800, ocrThb: 500, ocrConfidence: 40, ocrAutoMin: 90,
  pinned: pinnedBanks, ocrBank: 'KBANK', ocrLast4: '0000',
  manualBank: 'SCB', manualLast4: '3210',
}).level === 'AUTO', 'manual /save_slip + pin override auto-commits');
assert(routeIncomingSlip({
  authorized: false, ocrThb: 500, ocrConfidence: 99, ocrAutoMin: 90,
  pinned: pinnedBanks, ocrBank: 'KBANK', ocrLast4: '7890',
}).reason === 'unauthorized', 'unauthorized never auto-commits');
assert(routeIncomingSlip({
  authorized: true, duplicate: true, ocrThb: 500, ocrConfidence: 99, ocrAutoMin: 90,
  pinned: pinnedBanks, ocrBank: 'KBANK', ocrLast4: '7890',
}).reason === 'duplicate', 'duplicate slip is BLOCK');
assert(routeOutgoingSlip({
  authorized: true, usdt: 13.6, ocrConfidence: 95, ocrAutoMin: 90,
}).level === 'AUTO', 'high-confidence USDT screenshot routes AUTO');
assert(routeOutgoingSlip({
  authorized: true, usdt: 13.6, ocrConfidence: 70, ocrAutoMin: 90,
}).level === 'REVIEW', 'low-confidence USDT stays REVIEW until -13.6U');

console.log('ALL ACTION TESTS PASSED');
