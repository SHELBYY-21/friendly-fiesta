/** Accuracy cases for CE slip routing. Run: npx ts-node --project test/tsconfig.json test/accuracy-cases.ts */
const { gateOcr } = require('../src/lib/ct/gate');
const { canAutoQueue } = require('../src/lib/ct/queue');
const { last4FromPayeeMask, nameFromPayee } = require('../src/bot/parse');
const { accountLast4 } = require('../src/lib/banks');

function assert(ok: boolean, msg: string) {
  if (!ok) throw new Error(`FAIL: ${msg}`);
  console.log(`PASS: ${msg}`);
}

type AxisCase = {
  name: string;
  thb: number | null;
  conf: number | null;
  pin: boolean;
  desk: number;
  currency?: boolean;
  expectGate: string;
  expectAuto: boolean;
};

const AXIS: AxisCase[] = [
  { name: 'clear-small', thb: 500, conf: 98, pin: true, desk: 41, expectGate: 'IN_READY', expectAuto: true },
  { name: 'clear-1k', thb: 1000, conf: 99, pin: true, desk: 41, expectGate: 'IN_READY', expectAuto: true },
  { name: 'clear-ktb', thb: 1020, conf: 97, pin: true, desk: 41, expectGate: 'IN_READY', expectAuto: true },
  { name: 'clear-scb', thb: 1090, conf: 96, pin: true, desk: 36.7, expectGate: 'IN_READY', expectAuto: true },
  { name: 'clear-10k', thb: 10000, conf: 99, pin: true, desk: 41, expectGate: 'IN_READY', expectAuto: true },
  { name: 'review-80', thb: 1000, conf: 80, pin: true, desk: 41, expectGate: 'IN_READY_REVIEW', expectAuto: false },
  { name: 'review-94', thb: 1000, conf: 94, pin: true, desk: 41, expectGate: 'IN_READY_REVIEW', expectAuto: false },
  { name: 'review-big-88', thb: 20000, conf: 88, pin: true, desk: 41, expectGate: 'IN_READY_REVIEW', expectAuto: false },
  { name: 'review-extreme-93', thb: 999999, conf: 93, pin: true, desk: 41, expectGate: 'IN_READY_REVIEW', expectAuto: false },
  { name: 'weak-79', thb: 1000, conf: 79, pin: true, desk: 41, expectGate: 'OCR_WEAK', expectAuto: false },
  { name: 'weak-0', thb: 1000, conf: 0, pin: true, desk: 41, expectGate: 'OCR_WEAK', expectAuto: false },
  { name: 'conf-null', thb: 1000, conf: null, pin: true, desk: 41, expectGate: 'OCR_WEAK', expectAuto: false },
  { name: 'miss-high', thb: 1000, conf: 99, pin: false, desk: 41, expectGate: 'PIN_MISMATCH', expectAuto: false },
  { name: 'miss-weak', thb: 1000, conf: 70, pin: false, desk: 41, expectGate: 'PIN_MISMATCH', expectAuto: false },
  { name: 'no-thb', thb: null, conf: 99, pin: true, desk: 41, expectGate: 'NEED_UNIT', expectAuto: false },
  { name: 'zero-thb', thb: 0, conf: 99, pin: true, desk: 41, expectGate: 'NEED_UNIT', expectAuto: false },
  { name: 'no-currency', thb: 1000, conf: 99, pin: true, desk: 41, currency: false, expectGate: 'NEED_UNIT', expectAuto: false },
  { name: 'no-desk', thb: 1000, conf: 99, pin: true, desk: 0, expectGate: 'IN_READY', expectAuto: false },
];

const PAYEE = [
  {
    name: 'ktb-1020',
    text: [
      '\u0e01\u0e23\u0e38\u0e07\u0e44\u0e17\u0e22',
      '\u0e44\u0e1b\u0e22\u0e31\u0e07  \u0e2a\u0e38\u0e1e\u0e31\u0e15\u0e23\u0e32 \u0e2d\u0e31\u0e49\u0e19\u0e40\u0e08\u0e23\u0e34\u0e0d',
      'xxx-x-x6034-x',
      '\u0e08\u0e33\u0e19\u0e27\u0e19: 1,020.00 \u0e1a\u0e32\u0e17',
    ].join('\n'),
    last4: '6034',
    person: '\u0e2a\u0e38\u0e1e\u0e31\u0e15\u0e23\u0e32',
  },
  {
    name: 'scb-payee-not-sender',
    text: [
      '\u0e08\u0e32\u0e01 \u0e1c\u0e39\u0e49\u0e42\u0e2d\u0e19 x-0343',
      '\u0e44\u0e1b\u0e22\u0e31\u0e07 \u0e2a\u0e38\u0e1e\u0e31\u0e15\u0e23\u0e32 \u0e2d\u0e31\u0e49\u0e19\u0e40\u0e08\u0e23\u0e34\u0e0d',
      '\u0e40\u0e02\u0e49\u0e32\u0e1a\u0e31\u0e0d\u0e0a\u0e35 \u00b7\u00b7\u00b7\u00b76034',
      '1,090.00 \u0e1a\u0e32\u0e17',
    ].join('\n'),
    last4: '6034',
    person: '\u0e2a\u0e38\u0e1e\u0e31\u0e15\u0e23\u0e32',
  },
];

function digitsLast4(mask: string) {
  const d = String(mask).replace(/\D/g, '');
  return d.length >= 4 ? d.slice(-4) : d || null;
}

export function runAccuracyCases() {
  console.log('accuracy cases');
  for (const c of AXIS) {
    const gate = gateOcr({
      thb: c.thb,
      confidence: c.conf,
      pinMatch: c.pin,
      hasCurrency: c.currency,
    });
    const auto = canAutoQueue(gate, c.thb, c.desk);
    assert(gate === c.expectGate, `${c.name} gate ${gate} == ${c.expectGate}`);
    assert(auto === c.expectAuto, `${c.name} auto ${auto} == ${c.expectAuto}`);
  }
  assert(digitsLast4('xxx-x-x6034-x') === '6034', 'mask 6034');
  assert(digitsLast4('x-0343') === '0343', 'mask 0343');
  assert(digitsLast4('KTB') === null, 'bank name is not last4');
  assert(accountLast4('6661260343') === '0343', 'full account last4');
  for (const p of PAYEE) {
    const got = last4FromPayeeMask(p.text);
    assert(got === p.last4, `${p.name} last4 ${got} == ${p.last4}`);
    const who = nameFromPayee(p.text) || '';
    assert(who.includes(p.person), `${p.name} name has ${p.person} (${who})`);
  }
  console.log(`accuracy ${AXIS.length + 3 + PAYEE.length} checks passed`);
}

if (require.main === module) {
  runAccuracyCases();
}
