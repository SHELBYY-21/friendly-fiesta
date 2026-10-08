# CE VAULT Langfuse: privacy-safe instrumentation

Status: **opt-in only**, requires a configured runtime and verified deployment.

## Architecture

`src/lib/observability/langfuse.ts` exports one complete OTLP/HTTP JSON span per Grok Vision request, using Langfuse's documented v4 trace endpoint.

### Payload allowlist

The only exported metadata are:
- Operation category (bank-slip OCR or USDT screenshot OCR).
- Model identifier (restricted to alphanumerics and safe punctuation).
- Request duration, HTTP status code, and success/failure status.
- Random trace/span identifiers and static service name.

**Never export** the image, OCR output, prompt, completion, customer name, bank/account data, transaction reference, balance, amount, addresses, or secrets. The implementation deliberately does not use automatic LLM SDK instrumentation because default input/output capture could expose financial documents.

A failed tracing request must not influence OCR result or business logic. Tracing is disabled until the opt-in flag is exactly `1`.

## GitHub environment is not the VPS runtime

The GitHub Actions environment `production` may contain the following:
- Environment variable `LANGFUSE_BASE_URL=https://cloud.langfuse.com`
- Environment variable `LANGFUSE_PUBLIC_KEY`
- Environment secret `LANGFUSE_SECRET_KEY`

**The actual app runs on VPS Docker Compose, using `.env.production`.** GitHub Actions variables and secrets do not automatically appear inside that file or the container. Configure the backend through a secure deployment mechanism with the same names. Do not commit `.env.production`, log it, echo it, or put keys into `NEXT_PUBLIC_*` variables.

The existing production deployment first requires valid `VPS_SSH_KEY`, `VPS_HOST`, `VPS_USER`, and `VPS_DEPLOY_PATH` GitHub Actions environment secrets. Missing these blocks all VPS deployments, regardless of Langfuse configuration.

## Enable only after checks

1. Rotate any Langfuse secret previously sent through chat. Use a fresh secret with the correct key name `LANGFUSE_SECRET_KEY`, not `SECRET`. GitHub does not let us read secret values or rename them.
2. Inject the Langfuse keys server-side into the actual application runtime, and ensure `LANGFUSE_BASE_URL` points to the matching region.
3. Set `LANGFUSE_TELEMETRY_ENABLED=1` in the **actual server runtime**, not as a browser-visible variable.
4. After deployment, run one authorized test OCR with a deliberately synthetic/test-only screenshot, then verify a metadata-only span in the Langfuse project. Never use a real customer slip as a diagnostic probe.
5. Confirm no PII in the trace, then monitor ingestion errors and sample latency. Disable flag to roll back tracing immediately.

## Validation and rollback

- Verify CI: `npm ci`, `npm run typecheck`, `npm test` including `test/langfuse-metadata.test.ts`.
- Full Langfuse integration is **not confirmed** merely by passing CI or by setting GitHub Secrets. Verify one real end-to-end synthetic trace from the deployed runtime.
- Disable tracing with `LANGFUSE_TELEMETRY_ENABLED=0` or remove the flag, then redeploy/restart the application.
- Never bypass failing CI, production SSH preflight, webhook safety checks, or transaction verification to enable telemetry.

See [official Langfuse OTEL docs](https://langfuse.com/integrations/native/opentelemetry) for the v4 endpoint and header.
