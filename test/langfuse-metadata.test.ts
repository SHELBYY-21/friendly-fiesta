import assert from 'node:assert/strict';
import { langfuseConfig, privateVisionSpan } from '../src/lib/observability/langfuse';

const env = {
  LANGFUSE_TELEMETRY_ENABLED: '1',
  LANGFUSE_PUBLIC_KEY: 'pk-lf-test-only',
  LANGFUSE_SECRET_KEY: 'sk-lf-test-only',
  LANGFUSE_BASE_URL: 'https://cloud.langfuse.com',
};

assert.equal(langfuseConfig({ ...env, LANGFUSE_TELEMETRY_ENABLED: '0' }), null);
assert.equal(langfuseConfig({ ...env, LANGFUSE_SECRET_KEY: '' }), null);
assert.equal(langfuseConfig({ ...env, LANGFUSE_BASE_URL: 'http://cloud.langfuse.com' }), null);
assert.equal(langfuseConfig({ ...env, LANGFUSE_BASE_URL: 'https://evil.example/' }), null);
assert.equal(langfuseConfig({ ...env, LANGFUSE_BASE_URL: 'https://cloud.langfuse.com@evil.example' }), null);
assert.equal(langfuseConfig(env)?.endpoint, 'https://cloud.langfuse.com/api/public/otel/v1/traces');

const payload = privateVisionSpan({
  operation: 'bank-slip-ocr',
  model: 'grok-4.20-non-reasoning',
  startedAtMs: 1700000000000,
  endedAtMs: 1700000000400,
  statusCode: 200,
  ok: true,
}, '0123456789abcdef0123456789abcdef', '0123456789abcdef');
const json = JSON.stringify(payload);
const span = payload.resourceSpans[0].scopeSpans[0].spans[0];

assert.equal(span.name, 'bank-slip-ocr');
assert.equal(span.status.code, 1);
assert.equal(span.startTimeUnixNano, '1700000000000000000');
assert.equal(span.endTimeUnixNano, '1700000000400000000');
assert.deepEqual(span.attributes.map((a) => a.key), [
  'langfuse.observation.type',
  'langfuse.observation.model.name',
  'langfuse.observation.metadata.operation',
  'langfuse.observation.metadata.http_status',
  'langfuse.observation.metadata.success',
]);
// Only explicit operational metadata should be exported.
for (const forbidden of ['receiver', 'sender', 'account', 'amount', 'prompt', 'image_url', 'transRef', 'input', 'output']) {
  assert.equal(json.includes(forbidden), false, `PII field detected: ${forbidden}`);
}

console.log('langfuse-metadata-only ok');
