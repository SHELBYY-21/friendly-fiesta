export interface SandboxActivity {
  jobs: Array<{ id: string; reference: string; state: string; summary: string; updatedAt: string }>;
  events: Array<{ id: string; jobId: string; type: string; detail: string; occurredAt: string }>;
  pendingOutbox: number;
  failedOutbox: number;
}
const redact = (value: unknown): string => String(value ?? '').replace(/\b\d{6,}\b/g, (digits) => `••••${digits.slice(-4)}`);
export function buildSandboxActivity(jobs: any[], events: any[], outbox: any[] = []): SandboxActivity {
  return {
    jobs: jobs.map((row) => ({ id: String(row.id), reference: redact(row.public_ref), state: String(row.state), summary: redact(row.summary), updatedAt: String(row.updated_at) })),
    events: events.map((row) => ({ id: String(row.event_id), jobId: String(row.job_id), type: String(row.event_type), detail: redact(JSON.stringify(row.payload ?? {})), occurredAt: String(row.occurred_at) })),
    pendingOutbox: outbox.filter((row) => row.status === 'PENDING').length,
    failedOutbox: outbox.filter((row) => row.status === 'FAILED').length,
  };
}
