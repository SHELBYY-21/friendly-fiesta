const { parseSlipText, computeShouldSend } = require('../src/bot/parse');
const { parseAmounts, parseAmountTokens } = require('../src/lib/amounts');
const {
  commandName,
  escapeTelegramHtml,
  isBootstrapAdmin,
  isLowConfidence,
  parseRecentLimit,
  parseSaveSlipArgs,
  slipFingerprint,
  requiresAdminAccess,
} = require('../src/lib/botSecurity');
const { pickExplicitThbAmount } = require('../src/lib/ocrAmount');
const UI = require('../src/lib/botUi');
const {
  getOcrAutoMin,
  getSupabaseAdminKey,
  validateProductionEnvironment,
} = require('../src/lib/runtimeEnv');

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`PASS: ${msg}`);
}

function hasBalancedTelegramHtml(text: string): boolean {
  const allowed = new Set([
    'a', 'b', 'blockquote', 'code', 'del', 'em', 'i', 'ins', 'pre',
    's', 'span', 'strike', 'strong', 'tg-spoiler', 'u',
  ]);
  const tags = /<\/?([a-z][a-z0-9-]*)(?:\s+[^>]*)?>/giu;
  const stack: string[] = [];
  for (const match of text.matchAll(tags)) {
    const tag = match[1].toLowerCase();
    if (!allowed.has(tag)) return false;
    if (match[0].startsWith('</')) {
      if (stack.pop() !== tag) return false;
    } else {
      stack.push(tag);
    }
  }
  return stack.length === 0;
}

console.log('🧪 Running parse tests...');

const t1 = parseSlipText('ยอด 5,000 บาท ธนาคาร CIMB 2330 วันที่ 24/07/26 ผู้รับ นางสาว อัญยา ระดาบุตร');
assert(t1.amount === 5000, `amount 5000 (got ${t1.amount})`);
assert(t1.bank === 'CIMB', `bank CIMB (got ${t1.bank})`);
assert(t1.last4 === '2330', `last4 2330 (got ${t1.last4})`);
assert(t1.receiverName === 'อัญยา ระดาบุตร', `receiverName อัญยา ระดาบุตร (got ${t1.receiverName})`);
assert(t1.date === '24/07/26', `date 24/07/26 (got ${t1.date})`);

const t2 = parseSlipText('โอนสำเร็จ 12,500.50 THB ธนาคาร KBANK xxxx1234 เวลา 14:30');
assert(t2.amount === 12500.5, `amount 12500.5 (got ${t2.amount})`);
assert(t2.bank === 'KBANK', `bank KBANK (got ${t2.bank})`);
assert(t2.last4 === '1234', `last4 1234 (got ${t2.last4})`);
assert(t2.time === '14:30', `time 14:30 (got ${t2.time})`);

assert(computeShouldSend(5000, 42) === 119.05, `computeShouldSend(5000, 42) = 119.05 (got ${computeShouldSend(5000, 42)})`);
assert(computeShouldSend(1000, 35.5) === 28.17, `computeShouldSend(1000, 35.5) = 28.17 (got ${computeShouldSend(1000, 35.5)})`);
assert(computeShouldSend(0, 35.5) === 0, `computeShouldSend(0, 35.5) = 0`);

const explicit = parseAmounts('+500B -13.6U');
assert(explicit.thb?.value === 500 && explicit.thb?.sign === 1, 'accepts explicit +500B');
assert(explicit.usdt?.value === 13.6 && explicit.usdt?.sign === -1, 'accepts explicit -13.6U');
assert(parseAmountTokens('+500').length === 0, 'never infers THB when currency is missing');
assert(parseAmountTokens('-13.6').length === 0, 'never infers USDT when currency is missing');
assert(parseAmounts('500').hasBareNumber === true, 'flags bare amount for actionable error');
assert(parseAmounts('+500B +600B').ambiguous === true, 'rejects multiple THB amounts');
assert(parseAmountTokens('+500USDX').length === 0, 'rejects partial currency suffix matches');

assert(commandName('/recent_slips@cevault_bot 10') === 'recent_slips', 'parses command with bot mention');
assert(requiresAdminAccess('/recent_slips 10') === true, 'recent ledger requires admin access');
assert(requiresAdminAccess('/ยอด') === true, 'Thai ledger alias requires admin access');
assert(parseRecentLimit('/recent_slips') === 5, 'recent slips default limit is 5');
assert(parseRecentLimit('/recent_slips 20') === 20, 'recent slips accepts upper bound');
assert(parseRecentLimit('/recent_slips 21') === null, 'recent slips rejects limit above 20');
assert(parseSaveSlipArgs('/save_slip')?.thb === null, 'save slip accepts OCR amount confirmation');
assert(parseSaveSlipArgs('/save_slip +500B')?.thb === 500, 'save slip accepts explicit THB IN override');
const manualSlip = parseSaveSlipArgs('/save_slip +500B KBANK 7890');
assert(manualSlip?.bank === 'KBANK' && manualSlip?.last4 === '7890', 'save slip accepts explicit bank fallback');
assert(parseSaveSlipArgs('/save_slip 500') === null, 'save slip rejects amount without sign and currency');
assert(isBootstrapAdmin(123, '123,456') === true, 'bootstrap admin allowlist accepts configured id');
assert(isBootstrapAdmin(999, '123,456') === false, 'bootstrap admin allowlist rejects unknown id');
assert(escapeTelegramHtml('<Admin & Co>') === '&lt;Admin &amp; Co&gt;', 'escapes Telegram HTML input');
assert(slipFingerprint('stable-id') === slipFingerprint('stable-id'), 'slip fingerprint is deterministic');
assert(slipFingerprint('stable-id') !== slipFingerprint('other-id'), 'slip fingerprints differ');
assert(isLowConfidence(89.9) === true && isLowConfidence(90) === false, 'confidence threshold is exactly 90%');

const validProductionEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://project-ref.supabase.co',
  SUPABASE_SECRET_KEY: `sb_secret_${'S'.repeat(32)}`,
  API_SECRET: 'a'.repeat(64),
  BOT_TOKEN: `123456:${'B'.repeat(32)}`,
  TELEGRAM_WEBHOOK_SECRET: 'webhook_secret_1234567890',
  ADMIN_TELEGRAM_IDS: '123456789,987654321',
  APP_URL: 'https://vault.example.com',
  DEFAULT_SELL_RATE: '35.5',
  DEFAULT_MARKET_RATE: '34.8',
  OCR_AUTO_MIN: '90',
  GROK_API_KEY: 'xai-test-key-not-a-placeholder',
};
assert(validateProductionEnvironment(validProductionEnv).length === 0, 'accepts complete production environment');
assert(getSupabaseAdminKey(validProductionEnv)?.startsWith('sb_secret_') === true, 'accepts new Supabase secret key');
assert(getOcrAutoMin({ OCR_AUTO_MIN: '80' }) === 90, 'never allows OCR threshold below 90%');
assert(
  validateProductionEnvironment({ ...validProductionEnv, OCR_AUTO_MIN: '80' })
    .some((issue: { key: string }) => issue.key === 'OCR_AUTO_MIN'),
  'rejects production OCR threshold below 90%',
);
assert(
  validateProductionEnvironment({
    ...validProductionEnv,
    TELEGRAM_WEBHOOK_SECRET: validProductionEnv.API_SECRET,
  }).some((issue: { key: string; code: string }) => issue.key === 'TELEGRAM_WEBHOOK_SECRET' && issue.code === 'conflict'),
  'requires webhook and API secrets to be independent',
);
assert(
  validateProductionEnvironment({ ...validProductionEnv, BOT_TOKEN: 'your-telegram-bot-token' })
    .some((issue: { key: string }) => issue.key === 'BOT_TOKEN'),
  'rejects placeholder secrets in production',
);

assert(pickExplicitThbAmount('ยอดโอน 5,000.00 บาท') === 5000, 'OCR fallback accepts explicitly labelled THB');
assert(pickExplicitThbAmount('เลขอ้างอิง 999999 ยอดคงเหลือ 5000') === null, 'OCR fallback does not guess from unrelated numbers');
assert(pickExplicitThbAmount('ยอดโอน 500 บาท ยอดเงิน 600 บาท') === null, 'OCR fallback rejects conflicting explicit amounts');

const unclearUi = UI.slipUnclear(999999);
assert(unclearUi.text.includes('(OCR Unclear)'), 'OCR unclear UI includes the bilingual status');
assert(unclearUi.text.includes('+500B') && !unclearUi.text.includes('999999'), 'OCR unclear UI never guesses an amount');

const mismatchUi = UI.accountMismatch('<script>bad</script>');
assert(mismatchUi.text.includes('(Account Mismatch)'), 'account mismatch UI uses the enterprise status');
assert(!mismatchUi.text.includes('<script>'), 'account mismatch UI escapes dynamic HTML');

const pinsUi = UI.pinnedAccounts([{ bank: '<KBANK>', last4: '7890' }]);
assert(pinsUi.text.includes("(Today's Receiving Accounts)"), 'pinned account UI uses the bilingual heading');
assert(pinsUi.text.includes('&lt;KBANK&gt;') && !pinsUi.text.includes('<KBANK>'), 'pinned account UI escapes bank data');

const incomingUi = UI.incomingRecorded({
  transactionId: '00000000-0000-0000-0000-000000000001',
  ledgerRef: 'CE-TEST-0001',
  thb: 500,
  usdtOwed: 13.6,
  sellRate: 36.76,
  adminName: '<Admin>',
  bank: '<BANK>',
  last4: '1234',
  confidence: 90,
});
assert(
  incomingUi.text.includes('เข้า (IN)') &&
    incomingUi.text.includes('ต้องส่ง (Should Send)') &&
    incomingUi.text.includes('เรทขาย (Sell Rate)') &&
    incomingUi.text.includes('อ้างอิง (Reference)'),
  'recorded transaction UI follows the TH + EN terminology standard',
);
assert(!incomingUi.text.includes('<Admin>') && !incomingUi.text.includes('<BANK>'), 'transaction UI escapes operator and bank data');

const ledgerUi = UI.ledgerCard({
  incomingList: [{ time: '10:00', thb: 500, usdt: 13.6 }],
  outgoingList: [{ time: '10:05', usdt: 13.6 }],
  totalThb: 500,
  totalIncomingUsdt: 13.6,
  totalOutgoingUsdt: 13.6,
  fixedRate: 36.76,
  feePercent: 0,
  netProfitThb: 5,
  lastAdminName: '<Admin>',
  roomName: '<Room>',
});
assert(
  ledgerUi.text.includes('สรุปวันนี้ (Today Summary)') &&
    ledgerUi.text.includes('ปริมาณ (Volume)') &&
    ledgerUi.text.includes('กำไรสุทธิ (Net Profit)') &&
    ledgerUi.text.includes('Settled'),
  'today ledger UI follows the enterprise summary standard',
);
assert(ledgerUi.text.length < 4096, 'today ledger UI stays within Telegram message limits');
assert(!ledgerUi.text.includes('<Admin>') && !ledgerUi.text.includes('<Room>'), 'today ledger UI escapes dynamic HTML');

const uiSamples = [
  UI.welcomeRegistered('<Admin>'),
  UI.amountFormatHelp(),
  UI.slipReady({ type: 'THB_DEPOSIT', thb: 500, confidence: 91, bank: '<BANK>', last4: '1234', chatRate: 36.76 }),
  UI.liveInitial('CE-TEST-0001', '<Admin>'),
  UI.liveOcrUpdate({ ledgerRef: 'CE-TEST-0001', thb: 500, receiver: '<Receiver>', bank: '<BANK>', confidence: 91, sellRate: 36.76, marketRate: 36.5, shouldSend: 13.6 }),
  UI.liveCompleted({ ledgerRef: 'CE-TEST-0001', thb: 500, usdt: 13.6, profitThb: 5, remaining: 0, todayTotalThb: 500 }),
  UI.dealConfirm({ ledgerRef: 'CE-TEST-0001', thb: 500, usdt: 13.6, buyRate: 36.5, sellRate: 36.76, profitThb: 5, receiverName: '<Receiver>', bank: '<BANK>', last4: '1234' }),
  UI.dealSuccess({ transactionId: '00000000-0000-0000-0000-000000000001', ledgerRef: 'CE-TEST-0001', adminName: '<Admin>', thb: 500, usdt: 13.6, buyRate: 36.5, sellRate: 36.76, profitThb: 5 }),
  UI.confirmDeposit(500, 13.6, 36.76),
  UI.confirmSend(13.6, 20),
  UI.rateShow(36.76, 36.5, 'manual'),
  UI.thbSuccess({ transactionId: '00000000-0000-0000-0000-000000000001', adminName: '<Admin>', thb: 500, usdt: 13.6, netProfitThb: 5, profitPercent: 1, feeUsdt: 0.1, feePercent: 0.7, holdingUsdt: 13.6 }),
  UI.usdtSendSuccess({ transactionId: '00000000-0000-0000-0000-000000000001', adminName: '<Admin>', usdt: 13.6, holdingUsdt: 0 }),
  UI.editPrompt(),
  ledgerUi,
  UI.menuCard(),
  UI.resetAsk('<Room>'),
  UI.receiverCard({ bank: '<BANK>', last4: '1234', name: '<Receiver>', totalTx: 1, totalThb: 500 }),
  UI.error('<failure>'),
  pinsUi,
];
assert(uiSamples.every((message: { text: string }) => message.text.length <= 4096), 'enterprise UI samples stay within Telegram message limits');
assert(uiSamples.every((message: { text: string }) => hasBalancedTelegramHtml(message.text)), 'enterprise UI samples use balanced Telegram HTML');

console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
