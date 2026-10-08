import { randomBytes } from 'node:crypto';

/**
 * CE VAULT observability: metadata-only, server-side, opt-in.
 *
 * NEVER send OCR images, prompts, completions, account identifiers,
 * names, transaction references, bank details, or amounts to Langfuse.
 * Each span contains only safe operational metadata.
 */
export interface PrivateVisionMetric {
  operation: 'bank-slip-ocr' | 'crypto-screenshot-ocr';
  model: string;
  startedAtMs: number;
  endedAtMs: number;
  statusCode: number | null;
  ok: boolean;
}

type Environment = Readonly<Record<string, string | undefined>>;

const ALLOWED_HOSTS = new Set([
  'cloud.langfuse.com',
  'us.cloud.langfuse.com',
  'jp.cloud.langfuse.com',
  'hipaa.cloud.langfuse.com',
]);

export function langfuseConfig(env: Environment = process.env) {
  if (env.LANGFUSE_TELEMETRY_ENABLED !== '1') return null;

  const publicKey = env.LANGFUSE_PUBLIC_KEY?.trim();
  const secretKey = env.LANGFUSE_SECRET_KEY?.trim();
  if (!publicKey?.startsWith('pk-lf-') || !secretKey?.startsWith('sk-lf-')) return null;

  let url: URL;
  try {
    url = new URL(env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com');
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname) ||
      url.port || url.username || url.password || url.search || url.hash ||
      url.pathname !== '/') {
    return null;
  }

  return {
    endpoint: `${url.origin}/api/public/otel/v1/traces`,
    authorization: `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString('base64')}`,
  };
}

function attribute(key: string, value: string) {
  return { key, value: { stringValue: value } };
}

/** Construct an OTLP/HTTP JSON payload from an explicit allowlist, never a model's data. */
export function privateVisionSpan(
  metric: PrivateVisionMetric,
  traceId: string,
  spanId: string,
) {
  const model = /^[a-z0-9_.-]{1,64}$/i.test(metric.model) ? metric.model : 'unknown';
  const start = Math.max(0, Math.floor(metric.startedAtMs));
  const end = Math.max(start, Math.floor(metric.endedAtMs));
  const httpStatus = metric.statusCode != null && metric.statusCode >= 100 &&
    metric.statusCode <= 599 ? String(metric.statusCode) : 'network-error';

  return {
    resourceSpans: [{
      resource: { attributes: [attribute('service.name', 'ce-vault')] },
      scopeSpans: [{
        scope: { name: 'ce-vault-private-vision-telemetry' },
        spans: [{
          traceId,
          spanId,
          name: metric.operation,
          startTimeUnixNano: (BigInt(start) * 1000000n).toString(),
          endTimeUnixNano: (BigInt(end) * 1000000n).toString(),
          status: { code: metric.ok ? 1 : 2 },
          attributes: [
            attribute('langfuse.observation.type', 'generation'),
            attribute('langfuse.observation.model.name', model),
            attribute('langfuse.observation.metadata.operation', metric.operation),
            attribute('langfuse.observation.metadata.http_status', httpStatus),
            attribute('langfuse.observation.metadata.success', String(metric.ok)),
          ],
        }],
      }],
    }],
  };
}

/**
 * Best-effort trace export. Never blocks an OCR result and never logs response
 * bodies or credentials. A failed export cannot alter transaction state.
 */
export async function reportPrivateVisionMetric(metric: PrivateVisionMetric): Promise<void> {
  const config = langfuseConfig();
  if (!config) return;

  const payload = privateVisionSpan(
    metric,
    randomBytes(16).toString('hex'),
    randomBytes(8).toString('hex'),
  );
  try {
    await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        authorization: config.authorization,
        'content-type': 'application/json',
        'x-langfuse-ingestion-version': '4',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // Langfuse is optional. Do not log credentials, OCR contents, or raw errors.
  }
}
