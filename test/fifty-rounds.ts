/** 50 desk cycles: gate → tape chip → park/KEEP → settle guard. */
const { gateOcr } = require('../src/lib/ct/gate');
const { canAutoQueue } = require('../src/lib/ct/queue');
const { stateFromSlip, statusChip, tapeChip } = require('../src/lib/ct/state');
const { settleBlockReason, HIGH_VALUE_THB } = require('../src/lib/ct/settleGuard');
const { computeShouldSend } = require('../src/bot/parse');

function assert(ok: boolean, msg: string) {
  if (!ok) throw new Error(`FAIL: ${msg}`);
}

const PINS = [
  { id: 'k1', bank_name: 'KTB', account_number: '6661260343', label: 'KTB' },
  { id: 's1', bank_name: 'SCB', account_number: '123457573', label: 'SCB' },
];

type Round = {
  n: number;
  name: string;
  thb: number | null;
  conf: number | null;
  pin: boolean;
  desk: number;
  bank: string;
  last4: string;
  qr?: boolean;
  currency?: boolean;
  after?: 'park' | 'keep' | 'settle' | 'done';
  expectGate: string;
  expectAuto: boolean;
  expectChip: string;
  expectSettle: string | null;
};

function rounds(): Round[] {
  const out: Round[] = [];
  const banks = [
    { bank: 'KTB', last4: '6034', pin: true },
    { bank: 'KTB', last4: '0343', pin: true },
    { bank: 'SCB', last4: '7573', pin: true },
    { bank: 'SCB', last4: '0343', pin: false },
    { bank: 'TTB', last4: '4987', pin: false },
  ];
  const amts = [500, 1000, 1020, 1090, 2500, 4110, 10000];
  let n = 1;
  for (const a of amts) {
    const b = banks[(n - 1) % 3];
    out.push({
      n, name: `clean-${a}-${b.bank}`, thb: a, conf: 96 + (n % 3), pin: true, desk: 36.7,
      bank: b.bank, last4: b.last4, after: 'keep', expectGate: 'IN_READY', expectAuto: true,
      expectChip: 'WAIT', expectSettle: b.pin ? null : 'PIN_MISMATCH',
    });
    n += 1;
  }
  for (const conf of [80, 88, 90, 94]) {
    out.push({
      n, name: `review-${conf}`, thb: 1000, conf, pin: true, desk: 41, bank: 'KTB', last4: '6034',
      after: 'keep', expectGate: 'IN_READY_REVIEW', expectAuto: false, expectChip: 'WAIT', expectSettle: null,
    });
    n += 1;
  }
  for (const conf of [0, 40, 79]) {
    out.push({
      n, name: `weak-${conf}`, thb: 1000, conf, pin: true, desk: 41, bank: 'KTB', last4: '6034',
      after: 'park', expectGate: 'OCR_WEAK', expectAuto: false, expectChip: 'ERR', expectSettle: 'NOT_LOCKED',
    });
    n += 1;
  }
  out.push({
    n, name: 'conf-null', thb: 1000, conf: null, pin: true, desk: 41, bank: 'KTB', last4: '6034',
    after: 'park', expectGate: 'OCR_WEAK', expectAuto: false, expectChip: 'ERR', expectSettle: 'NOT_LOCKED',
  });
  n += 1;
  for (const b of banks.filter((x) => !x.pin)) {
    out.push({
      n, name: `miss-${b.bank}-${b.last4}`, thb: 1090, conf: 99, pin: false, desk: 36.7,
      bank: b.bank, last4: b.last4, after: 'park', expectGate: 'PIN_MISMATCH', expectAuto: false,
      expectChip: 'ERR', expectSettle: 'NOT_LOCKED',
    });
    n += 1;
  }
  out.push({
    n, name: 'junk-10m-pin', thb: 10_000_000, conf: 99, pin: true, desk: 41, bank: 'KTB', last4: '6034',
    after: 'park', expectGate: 'OCR_WEAK', expectAuto: false, expectChip: 'ERR', expectSettle: 'NOT_LOCKED',
  });
  n += 1;
  out.push({
    n, name: 'junk-10m-miss', thb: 10_000_000, conf: 99, pin: false, desk: 41, bank: 'SCB', last4: '9999',
    after: 'park', expectGate: 'OCR_WEAK', expectAuto: false, expectChip: 'ERR', expectSettle: 'NOT_LOCKED',
  });
  n += 1;
  out.push({
    n, name: 'no-thb', thb: null, conf: 99, pin: true, desk: 41, bank: 'KTB', last4: '6034',
    after: 'park', expectGate: 'NEED_UNIT', expectAuto: false, expectChip: 'SCAN', expectSettle: 'NOT_LOCKED',
  });
  n += 1;
  out.push({
    n, name: 'zero-thb', thb: 0, conf: 99, pin: true, desk: 41, bank: 'KTB', last4: '6034',
    after: 'park', expectGate: 'NEED_UNIT', expectAuto: false, expectChip: 'SCAN', expectSettle: 'NOT_LOCKED',
  });
  n += 1;
  out.push({
    n, name: 'no-currency', thb: 1000, conf: 99, pin: true, desk: 41, bank: 'KTB', last4: '6034',
    currency: false, after: 'park', expectGate: 'NEED_UNIT', expectAuto: false, expectChip: 'SCAN', expectSettle: 'NOT_LOCKED',
  });
  n += 1;
  out.push({
    n, name: 'no-desk-auto-off', thb: 1000, conf: 99, pin: true, desk: 0, bank: 'KTB', last4: '6034',
    after: 'keep', expectGate: 'IN_READY', expectAuto: false, expectChip: 'WAIT', expectSettle: null,
  });
  n += 1;
  for (let i = 0; i < 6; i += 1) {
    const a = 800 + i * 110;
    out.push({
      n, name: `park-hold-${a}`, thb: a, conf: 97, pin: true, desk: 36.7, bank: 'KTB', last4: '6034',
      after: 'park', expectGate: 'IN_READY', expectAuto: true, expectChip: 'HOLD', expectSettle: 'NOT_LOCKED',
    });
    n += 1;
  }
  for (let i = 0; i < 6; i += 1) {
    const a = 900 + i * 50;
    out.push({
      n, name: `keep-from-hold-${a}`, thb: a, conf: 97, pin: true, desk: 36.7, bank: 'KTB', last4: '6034',
      after: 'keep', expectGate: 'IN_READY', expectAuto: true, expectChip: 'WAIT', expectSettle: null,
    });
    n += 1;
  }
  out.push({
    n, name: 'high-31k', thb: 31000, conf: 99, pin: true, desk: 41, bank: 'KTB', last4: '6034',
    after: 'keep', expectGate: 'IN_READY', expectAuto: true, expectChip: 'WAIT', expectSettle: 'HIGH_VALUE',
  });
  n += 1;
  out.push({
    n, name: 'c416-ttb', thb: 31000, conf: 99, pin: false, desk: 41, bank: 'TTB', last4: '4987',
    after: 'keep', expectGate: 'PIN_MISMATCH', expectAuto: false, expectChip: 'WAIT', expectSettle: 'PIN_MISMATCH',
  });
  n += 1;
  out.push({
    n, name: 'already-settled', thb: 1020, conf: 99, pin: true, desk: 41, bank: 'KTB', last4: '6034',
    after: 'done', expectGate: 'IN_READY', expectAuto: true, expectChip: 'DONE', expectSettle: 'ALREADY_SETTLED',
  });
  n += 1;
  out.push({
    n, name: 'qr-beats-weak-ocr', thb: 1020, conf: 70, pin: true, desk: 36.7, bank: 'KTB', last4: '6034',
    qr: true, after: 'keep', expectGate: 'IN_READY', expectAuto: true, expectChip: 'WAIT', expectSettle: null,
  });
  n += 1;
  out.push({
    n, name: 'above-target', thb: 12000, conf: 98, pin: true, desk: 36.7, bank: 'SCB', last4: '7573',
    after: 'keep', expectGate: 'IN_READY', expectAuto: true, expectChip: 'WAIT', expectSettle: null,
  });
  n += 1;
  while (out.length < 50) {
    const a = 600 + out.length * 17;
    out.push({
      n: out.length + 1, name: `fill-clean-${a}`, thb: a, conf: 98, pin: true, desk: 36.7,
      bank: 'KTB', last4: '6034', after: 'keep', expectGate: 'IN_READY', expectAuto: true,
      expectChip: 'WAIT', expectSettle: null,
    });
  }
  return out.slice(0, 50).map((r, i) => ({ ...r, n: i + 1 }));
}

function runOne(r: Round) {
  const gate = gateOcr({
    thb: r.thb,
    confidence: r.conf,
    pinMatch: r.pin,
    hasCurrency: r.currency,
    qrVerified: r.qr,
  });
  const auto = canAutoQueue(gate, r.thb, r.desk);
  assert(gate === r.expectGate, `R${r.n} ${r.name} gate ${gate} != ${r.expectGate}`);
  assert(auto === r.expectAuto, `R${r.n} ${r.name} auto ${auto} != ${r.expectAuto}`);

  let slipStatus = gate;
  if (r.after === 'park') slipStatus = 'HOLD';
  if (r.after === 'keep') slipStatus = 'LOCKED';
  if (r.after === 'done') slipStatus = 'SETTLED';

  const expected = r.thb && r.desk > 0 ? computeShouldSend(r.thb, r.desk) : (r.thb ? 1 : 0);
  const sent = r.after === 'done' ? expected : null;
  const state = stateFromSlip({
    slipStatus,
    gate: r.after === 'park' || r.after === 'keep' || r.after === 'done' ? slipStatus : gate,
    expectedUsdt: expected,
    sentUsdt: sent,
  });
  const chip = tapeChip(slipStatus, state);
  assert(chip === r.expectChip, `R${r.n} ${r.name} chip ${chip} != ${r.expectChip} (state=${state} slip=${slipStatus})`);

  if (r.after === 'park') {
    assert(statusChip(state) === 'ERR', `R${r.n} parked HOLD internal state is ERROR`);
    assert(chip === 'HOLD', `R${r.n} parked tape shows HOLD`);
  }

  const block = settleBlockReason({
    status: r.after === 'done' ? 'SETTLED' : r.after === 'keep' ? 'LOCKED' : slipStatus,
    thb_in: r.thb,
    should_send: expected && expected > 0 ? expected : 24.39,
    bank: r.bank,
    account_masked: `····${r.last4}`,
  }, PINS);
  assert(block === r.expectSettle, `R${r.n} ${r.name} settle ${block} != ${r.expectSettle}`);

  if (r.thb != null && r.thb >= HIGH_VALUE_THB && r.after === 'keep' && r.pin) {
    assert(block === 'HIGH_VALUE', `R${r.n} high value blocked`);
  }
}

export function runFiftyRounds() {
  const all = rounds();
  assert(all.length === 50, `want 50 rounds got ${all.length}`);
  let due = 0;
  let hold = 0;
  let sent = 0;
  for (const r of all) {
    runOne(r);
    if (r.after === 'park') hold += 1;
    if (r.after === 'keep' && r.expectSettle == null && r.thb) due += r.thb;
    if (r.after === 'done') sent += 1;
    console.log(`PASS: R${String(r.n).padStart(2, '0')} ${r.name}`);
  }
  assert(hold >= 6, 'at least 6 HOLD parks');
  assert(sent === 1, 'one settled cycle');
  assert(due > 0, 'open KEEP queue has THB');
  console.log(`fifty-rounds ok · 50/50 · HOLD ${hold} · openTHB ${due} · settled ${sent}`);
}

if (require.main === module) {
  runFiftyRounds();
}
