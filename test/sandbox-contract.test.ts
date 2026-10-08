import assert from 'node:assert/strict';
import { CANONICAL_STATES, canTransition, targetForCommand, assertSandboxFlags } from '../src/lib/sandbox/contract';

const allowed: Array<[string, string]> = [
  ['IDLE', 'SCANNING'], ['SCANNING', 'OCR_EXTRACTING'], ['SCANNING', 'FAILED'],
  ['OCR_EXTRACTING', 'VERIFYING'], ['VERIFYING', 'NEED_CONFIRMATION'],
  ['NEED_CONFIRMATION', 'PROCESSING'], ['PROCESSING', 'WAITING'],
  ['WAITING', 'PROCESSING'], ['PROCESSING', 'SETTLING'], ['SETTLING', 'COMPLETED'],
];
for (const [from, to] of allowed) assert.equal(canTransition(from, to), true, `${from} -> ${to}`);
for (const terminal of ['COMPLETED', 'FAILED', 'DUPLICATE', 'TIMEOUT']) {
  for (const state of CANONICAL_STATES) assert.equal(canTransition(terminal, state), false);
}
assert.equal(canTransition('UNKNOWN', 'COMPLETED'), false);
assert.equal(targetForCommand('CONFIRM_PROCESS', 'NEED_CONFIRMATION'), 'PROCESSING');
assert.equal(targetForCommand('UNKNOWN', 'NEED_CONFIRMATION'), null);
assert.throws(() => assertSandboxFlags({}), /SANDBOX_MODE_REQUIRED/);
assert.throws(() => assertSandboxFlags({ CE_VAULT_SANDBOX: 'true', LIVE_SETTLEMENT: 'true', LIVE_SETTLEMENT_ENABLED: 'false' }), /LIVE_SETTLEMENT_MUST_BE_FALSE/);
assert.doesNotThrow(() => assertSandboxFlags({ CE_VAULT_SANDBOX: 'true', LIVE_SETTLEMENT: 'false', LIVE_SETTLEMENT_ENABLED: 'false' }));
console.log('sandbox-contract ok');
