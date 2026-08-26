import { Admin } from '@/types/transactions';

const { parseSlipText, computeShouldSend, parseDeskPin, parseDeskRate, hasRatePrefix, isBareDeskRate, parseTelegramId, last4FromPayeeMask, nameFromPayee } = require('../src/bot/parse');
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

const lineBk = parseSlipText(`โอนเงินสำเร็จ
฿365.00
24 ส.ค. 69 08:45:35
จาก น.ส. มาลัย ภ กสิกรไทย xxx-x-x9434-x
ไปยัง บจก. พิมพ์ใจ คลีนนิ่งรูมแอนด์คอนโด กสิกรไทย xxx-x-x5012-x
ค่าธรรมเนียม ฿0.00
LINE BK Powered by KBank`);
assert(lineBk.amount === 365, `LINE BK amount 365 (got ${lineBk.amount})`);
assert(lineBk.last4 === '5012', `LINE BK last4 is payee 5012 not sender 9434 (got ${lineBk.last4})`);
assert(lineBk.bank === 'KBANK', `LINE BK bank KBANK (got ${lineBk.bank})`);

assert(last4FromPayeeMask(`จาก น.ส. มาลัย กสิกรไทย xxx-x-x9434-x
ไปยัง บจก. พิมพ์ใจ กสิกรไทย xxx-x-x5012-x`) === '5012', 'payee mask ignores sender');
assert(last4FromPayeeMask(`กรุงไทย
xxx-x-x6034-x
เลขที่รายการ: 016238120625COR004437
จำนวน: 1,020.00 บาท`) === '6034', 'Krungthai incoming last4 is 6034 not COR ref');

const ktbPin = parseDeskPin(`ชื่อเต็ม: สุพัตรา อั้นเจริญ
ธนาคาร: กรุงไทย
เลขบัญชี: xxx-x-x6034-x`);
assert(ktbPin?.bank === 'KTB', `ชื่อเต็ม pin bank KTB (got ${ktbPin?.bank})`);
assert(ktbPin?.name === 'สุพัตรา อั้นเจริญ', `pin name สุพัตรา (got ${ktbPin?.name})`);

const kplusName = nameFromPayee(`โอนเงินสำเร็จ
นาย ซอฟวัน ก
ธ.กสิกรไทย
xxx-x-x5521-x
สุพัตรา อั้นเจริญ
ธ.กรุงไทย
xxx-x-x6034-x
จำนวน: 1,020.00 บาท`);
assert(kplusName === 'สุพัตรา อั้นเจริญ', `K+ payee name (got ${kplusName})`);
assert(nameFromPayee('ไปยัง สุพัตรา อั้นเจริญ x-0343') === 'สุพัตรา อั้นเจริญ', `ไปยัง name (got ${nameFromPayee('ไปยัง สุพัตรา อั้นเจริญ x-0343')})`);

const { matchPinnedBank, accountLast4, accountLast4Candidates } = require('../src/lib/banks');
const pins = [{ id: '1', bank_name: 'KTB', account_number: 'xx6034', label: 'KTB' }];
assert(matchPinnedBank('SCB', '6034', pins)?.id === '1', 'match pin by last4 even if OCR bank is wrong');
assert(matchPinnedBank('KTB', '0343', pins) == null, 'do not match sender last4 0343');
assert(accountLast4('xxx-x-x6034-x') === '6034', 'mask last4 6034');

const livePin = parseDeskPin(`✍️ ชื่อเต็ม: สุพัตรา อั้นเจริญ 
🏦 ธนาคาร: กรุงไทย (KTB)
📝 บัญชี: 6661260343
📱วงเงินธุรกรรม/วัน = 500,000฿`);
assert(livePin?.bank === 'KTB', `live pin bank KTB (got ${livePin?.bank})`);
assert(livePin?.account === '6661260343', `live pin account (got ${livePin?.account})`);
assert(livePin?.name === 'สุพัตรา อั้นเจริญ', `live pin name (got ${livePin?.name})`);
const livePins = [{ id: 's', bank_name: 'KTB', account_number: '6661260343', label: 'สุพัตรา' }];
assert(accountLast4Candidates('6661260343').includes('0343'), 'true last4 0343');
assert(accountLast4Candidates('6661260343').includes('6034'), 'KTB mask 6034');
assert(matchPinnedBank('KTB', '6034', livePins)?.id === 's', 'slip 6034 matches account 6661260343');
assert(matchPinnedBank('KTB', '0343', livePins)?.id === 's', 'slip 0343 matches account 6661260343');
assert(matchPinnedBank('KTB', '5521', livePins) == null, 'sender 5521 does not match');

const deskPin = parseDeskPin(`BBL วงเงิน 150k
ชื่อ-สกุล :  วุฒิ บุญสุข
เลขบัญชี : 0989887823
bank : กรุงเทพ`);
assert(deskPin?.bank === 'BBL', `desk pin BBL (got ${deskPin?.bank})`);
assert(deskPin?.account === '0989887823', `desk pin account (got ${deskPin?.account})`);
assert(Boolean(deskPin?.name && deskPin.name.includes('วุฒิ')), `desk pin name (got ${deskPin?.name})`);
assert(parseDeskPin('/pin KBANK 1234567890')?.bank === 'KBANK', 'slash pin KBANK');
assert(parseDeskPin('BBL 1234567890') == null, 'bare bank+acct in group is not a pin');
assert(parseDeskRate('40') === 40, 'desk rate 40');
assert(parseDeskRate('เรตแลก 36.65') === 36.65, 'desk rate thai prefix');
assert(parseDeskRate('/setrate 36.70') === 36.70, 'setrate command');
assert(parseDeskRate('/rate 36.70') === 36.70, 'rate command');
assert(parseDeskRate('500') === null, '500 is not a desk rate');

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
const { DEFAULT_SELL_RATE: _s, DEFAULT_MARKET_RATE: _m, ...prodWithoutDefaults } = validProductionEnv as any;
assert(validateProductionEnvironment(prodWithoutDefaults).length === 0, 'desk rate is per-room, not required in env');
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
assert(unclearUi.text.includes('(OCR Failed)'), 'OCR unclear UI uses standard OCR Failed label');
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
assert(
  Array.isArray((incomingUi.reply_markup as any)?.inline_keyboard) &&
    JSON.stringify(incomingUi.reply_markup).includes('qa:today') &&
    JSON.stringify(incomingUi.reply_markup).includes('qa:rate'),
  'success card carries Quick Action inline keyboard',
);

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
  ledgerUi.text.includes('สรุปวันนี้') &&
    ledgerUi.text.includes("(Today's Summary)") &&
    ledgerUi.text.includes('กำไรสุทธิ (Net Profit)') &&
    ledgerUi.text.includes('ปริมาณ (Volume)') &&
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

const { gateOcr } = require('../src/lib/ct/gate');
assert(gateOcr({ thb: 500, confidence: 98, pinMatch: true }) === 'IN_READY', 'OCR >=95 pin match is IN_READY');
assert(gateOcr({ thb: 500, confidence: 90, pinMatch: true }) === 'IN_READY_REVIEW', 'OCR 80-94 pin match is review');
assert(gateOcr({ thb: 500, confidence: 72, pinMatch: true }) === 'OCR_WEAK', 'OCR <80 is weak');
assert(gateOcr({ thb: 500, confidence: 99, pinMatch: false }) === 'PIN_MISMATCH', 'pin mismatch never ready');
assert(gateOcr({ thb: null, confidence: 99, pinMatch: true }) === 'NEED_UNIT', 'missing amount is NEED_UNIT');

const CT = require('../src/lib/ct/copy');
const { parseCb, isCtCallback } = require('../src/lib/ct/callbacks');
assert(isCtCallback('slip:lock:A4F2') && isCtCallback('vault:today'), 'CT callback domains');
assert(parseCb('slip:amt:A4F2:+500B').extra === '+500B', 'callback extra amount preserved');
assert(parseCb('slip:lock:a4f2').ref === 'A4F2', 'short ref is uppercased');
const inReady = CT.cardInReady({
  review: false, thb: 10000, shouldSend: 250, desk: 40, mkt: 34.84,
  bank: 'SCB', last4: '3303', name: 'อัญญา ระดาบุตร', confidence: 95,
  ledger: 'CE-20260826-A4F2', adminName: 'Admin A', short: 'A4F2',
});
assert(inReady.text.includes('THB'), 'IN_READY amount table');
assert(inReady.text.includes('ส่วนต่าง'), 'IN_READY pnl');
assert(inReady.text.includes('MKT'), 'IN_READY market');
assert(inReady.text.includes('ตรวจ'), 'IN_READY progress tape');
assert(inReady.text.includes('●──'), 'IN_READY dots');
assert(inReady.text.includes('┃'), 'IN_READY rail');
assert(inReady.text.includes('<blockquote'), 'IN_READY amount quote');
assert(inReady.text.includes('#CE-20260826-A4F2'), 'ledger id with hash');
assert(JSON.stringify(inReady.reply_markup).includes('slip:lock:A4F2'), 'lock callback present');
assert(hasBalancedTelegramHtml(inReady.text), 'IN_READY html balanced');
assert(!/[👑✨🌿💎🤍🟢🔴💰📈🎯💵🏦👤⚠❤🔥⚡]/.test(inReady.text), 'IN_READY has no public emoji');
const vault = CT.vaultBanner({
  mode: 'today', dateLabel: '26 Aug', clock: '03:59',
  inThb: 0, inCount: 0, inRows: [], outUsdt: 0, outCount: 0, outRows: [],
  pendingUsdt: 0, desk: 36.7, mkt: 36.52, pendingShorts: [],
});
assert(vault.text.includes('◈') && vault.text.includes('[ สรุปยอด (VAULT) ]'), 'empty vault density');
assert(vault.text.includes('วันนี้ยังไม่มีสลิป'), 'empty vault microcopy');
assert(hasBalancedTelegramHtml(vault.text), 'vault html balanced');
assert(!/[👑✨🌿💎🤍🟢🔴💰📈🎯💵🏦👤⚠❤🔥⚡]/.test(vault.text), 'vault has no public emoji');

const {
  matchReplyCommand,
  parseCb: parseCb2,
  isCtCallback: isCt2,
  SLIP_ACTIONS,
  VAULT_ACTIONS,
  PIN_ACTIONS,
  ADMIN_ACTIONS,
} = require('../src/lib/ct/callbacks');
const { adminKeyboard } = require('../src/lib/ct/format');

const pad = adminKeyboard().keyboard.flat().map((b: { text: string }) => b.text);
assert(JSON.stringify(pad) === JSON.stringify(['ยอดวันนี้', 'รอส่ง', 'อัตรา', 'บัญชีรับ', 'ตั้งค่า', 'วันใหม่']), 'reply pad labels');
const padMap: Record<string, string> = {
  'ยอดวันนี้': 'vault',
  'รอส่ง': 'pending',
  'บัญชีรับ': 'pin',
  'อัตรา': 'rate',
  'ตั้งค่า': 'settings',
  'วันใหม่': 'newday',
};
for (const label of pad) {
  assert(matchReplyCommand(label) === padMap[label], `pad ${label} wired`);
}

const sample = {
  review: false, thb: 500, shouldSend: 13.62, desk: 36.7, mkt: 32.71,
  bank: 'BBL', last4: '7823', name: 'วุฒิ', confidence: 96,
  ledger: 'CE-20260826-A4F2', adminName: 'RAZEN', short: 'A4F2',
};
const cards = [
  CT.cardInReady(sample),
  CT.cardOcrWeak({ bank: 'BBL', last4: '7823', name: 'วุฒิ', confidence: 40, short: 'A4F2', chips: [500, 1000] }),
  CT.cardLocked({ thb: 500, shouldSend: 13.62, desk: 36.7, mkt: 32.71, bank: 'BBL', last4: '7823', name: 'วุฒิ', ledger: 'CE-20260826-A4F2', adminName: 'RAZEN', time: '06:20', short: 'A4F2', canUndo: true }),
  CT.vaultBanner({
    mode: 'today', dateLabel: '26 Aug', clock: '03:59',
    inThb: 500, inCount: 1,
    inRows: [{ thb: 500, usdt: 13.62, time: '06:20', short: 'A4F2', pending: true }],
    outUsdt: 0, outCount: 0, outRows: [], pendingUsdt: 13.62, desk: 36.7, mkt: 32.71,
    pendingShorts: ['A4F2'],
  }),
  CT.pinView([{ bank: 'BBL', last4: '7823' }]),
];
function collectCbs(card: { reply_markup?: any }): string[] {
  const rows = card.reply_markup?.inline_keyboard ?? [];
  return rows.flat().map((b: any) => b.callback_data).filter(Boolean);
}
const cbs = cards.flatMap(collectCbs);
assert(cbs.length > 0, 'cards expose callbacks');
for (const data of cbs) {
  assert(isCt2(data), `callback domain ${data}`);
  const cb = parseCb2(data);
  if (cb.domain === 'slip') assert(SLIP_ACTIONS.has(cb.action), `slip action ${cb.action} from ${data}`);
  if (cb.domain === 'vault') assert(VAULT_ACTIONS.has(cb.action), `vault action ${cb.action} from ${data}`);
  if (cb.domain === 'pin') assert(PIN_ACTIONS.has(cb.action), `pin action ${cb.action} from ${data}`);
  if (cb.domain === 'admin') assert(ADMIN_ACTIONS.has(cb.action), `admin action ${cb.action} from ${data}`);
}
assert(collectCbs(CT.cardInReady(sample)).includes('slip:lock:A4F2'), 'keep → lock');
assert(collectCbs(CT.cardInReady(sample)).includes('slip:queue:A4F2'), 'queue later');
assert(collectCbs(CT.cardLocked({ ...sample, time: '06:20', canUndo: true })).includes('slip:settle:A4F2'), 'sent → settle');
assert(collectCbs(CT.pinView([{ bank: 'BBL', last4: '7823' }])).includes('pin:unpin:1'), 'unpin 1');
assert(matchReplyCommand('36.70') === null, 'bare rate number is not a pad command');
assert(hasRatePrefix('36.70') === false, 'bare number is not an explicit rate command');
assert(hasRatePrefix('/setrate 36.70') === true, 'setrate is explicit');
assert(isBareDeskRate('36.70') === true, '36.70 is a bare desk rate token');
assert(isBareDeskRate('โอน 36.70 แล้ว') === false, 'rate inside chat is not bare');
assert(VAULT_ACTIONS.has('set'), 'settings callback exists');
assert(VAULT_ACTIONS.has('batch'), 'batch settle callback exists');
const { batchProgress, canAutoQueue, BATCH_THB } = require('../src/lib/ct/queue');
assert(BATCH_THB === 10000, 'batch target 10000');
assert(batchProgress(4110).remain === 5890, 'remain to 10k');
assert(batchProgress(10000).ready === true, 'ready at 10k');
assert(canAutoQueue('IN_READY', 1090, 36.7) === true, 'auto queue matched slip');
assert(canAutoQueue('PIN_MISMATCH', 1090, 36.7) === false, 'do not auto queue mismatch');
assert(collectCbs(CT.cardLocked({ ...sample, time: '06:20', canUndo: true, queued: true, batch: { count: 4, thb: 4110, usdt: 112, target: 10000, remain: 5890, ready: false } })).includes('vault:batch'), 'locked card exposes batch');
assert(matchReplyCommand('/admin') === 'addadmin', '/admin asks for id');
assert(parseTelegramId('/admin 5676959274') === 5676959274, '/admin + telegram id');
assert(parseTelegramId('5676959274') === 5676959274, 'bare telegram id parses');
assert(parseTelegramId('โอน 5676959274 แล้ว') === null, 'id inside chat is ignored');
assert(collectCbs(CT.settingsCard({ desk: 36.7, mkt: 32.7, pins: [], admins: [] })).includes('admin:add'), 'settings has add-admin');

console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
