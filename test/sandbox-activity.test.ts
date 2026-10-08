import assert from 'node:assert/strict';
import { buildSandboxActivity } from '../src/lib/sandbox/activity';

assert.deepEqual(buildSandboxActivity([], []), { jobs: [], events: [], pendingOutbox: 0, failedOutbox: 0 });
const result = buildSandboxActivity(
  [{ id: 'j1', public_ref: 'SBX-1', state: 'WAITING', summary: 'account 1234567890', metadata: { account: '1234567890' }, updated_at: '2026-10-08T00:00:00Z' }],
  [{ event_id: 'e1', job_id: 'j1', event_type: 'job.state_changed.v1', payload: { account: '1234567890' }, occurred_at: '2026-10-08T00:00:00Z' }],
  [{ status: 'FAILED', last_error_code: 'NETWORK' }, { status: 'PENDING', last_error_code: null }],
);
assert.match(result.jobs[0].summary, /••••7890/);
assert.doesNotMatch(JSON.stringify(result), /1234567890/);
assert.equal(result.pendingOutbox, 1);
assert.equal(result.failedOutbox, 1);
console.log('sandbox-activity ok');
