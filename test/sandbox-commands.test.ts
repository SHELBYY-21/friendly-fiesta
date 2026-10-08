import assert from 'node:assert/strict';
import { createSandboxCommands, SandboxCommandError } from '../src/lib/sandbox/commands';

async function main() {
let calls = 0;
const api = createSandboxCommands({
  create: async (input) => { calls += 1; return { id: 'j1', publicRef: 'SBX-1', state: 'IDLE', stateVersion: 1, ...input }; },
  transition: async (input) => { calls += 1; return { id: input.jobId, publicRef: 'SBX-1', state: input.toState, stateVersion: input.expectedVersion + 1 }; },
}, { CE_VAULT_SANDBOX: 'true', LIVE_SETTLEMENT: 'false', LIVE_SETTLEMENT_ENABLED: 'false' });

async function expectCode(run: () => Promise<unknown>, code: string) {
  await assert.rejects(run, (error: unknown) => error instanceof SandboxCommandError && error.code === code);
}
await expectCode(() => api.createSandboxJob({ summary: 'x' }, { id: '', isAdmin: false }), 'ADMIN_REQUIRED');
assert.equal(calls, 0);
const created = await api.createSandboxJob({ summary: 'review only', amount: 50, currency: 'THB' }, { id: 'a1', isAdmin: true });
assert.equal(created.state, 'IDLE');
const moved = await api.transitionSandboxJob({ jobId: 'j1', expectedVersion: 1, action: 'ADVANCE', toState: 'SCANNING', idempotencyKey: 'key-1' }, { id: 'a1', isAdmin: true });
assert.equal(moved.state, 'SCANNING');
await expectCode(() => api.transitionSandboxJob({ jobId: 'j1', expectedVersion: 1, action: 'ADVANCE', toState: 'COMPLETED', idempotencyKey: 'key-2' }, { id: 'a1', isAdmin: true }), 'INVALID_TRANSITION');
const disabled = createSandboxCommands({ create: async () => created, transition: async () => moved }, {});
await assert.rejects(() => disabled.createSandboxJob({ summary: 'x' }, { id: 'a1', isAdmin: true }), /SANDBOX_MODE_REQUIRED/);
console.log('sandbox-commands ok');
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
