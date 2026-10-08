import assert from 'node:assert/strict';
import { createOperatorCommandHandler } from '../src/lib/telegram/operatorCommands';

async function main() {
let reads = 0;
const handler = createOperatorCommandHandler({
  isAuthorized: async (userId: number) => userId === 7,
  getRates: async () => ({ sellRate: 36.7, marketRate: 34.8 }),
  findHistory: async (last4: string) => { reads += 1; return [{ bank: 'SCB', last4, name: 'Receiver', count: 3, totalThb: 1200, totalUsdt: 32.70005, status: 'normal' }]; },
  findStatus: async (reference: string) => ({ reference, status: 'recorded', thb: 1000, usdt: 27.24715 }),
  getBalance: async () => ({ thb: 2500.25, accounts: 2 }),
});

async function run(text: string, userId = 7) {
  return handler({ chatId: -100, userId, text, updateId: 101 });
}

assert.match((await run('/history SCB 1234'))?.text ?? '', /Receiver/);
assert.match((await run('/history SCB 1234'))?.text ?? '', /32\.7001 USDT/);
assert.match((await run('/status CE-001'))?.text ?? '', /recorded/);
assert.match((await run('/rates'))?.text ?? '', /36\.70/);
assert.match((await run('/balance'))?.text ?? '', /2,500\.25 THB/);
assert.match((await run('/demo'))?.text ?? '', /DEMO/);
assert.equal(await run('/unknown'), null);

const beforeUnauthorized = reads;
assert.match((await run('/history SCB 1234', 8))?.text ?? '', /ผู้ดูแล/);
assert.equal(reads, beforeUnauthorized);

console.log('operator-commands ok');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
