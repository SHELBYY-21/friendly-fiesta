export const CANONICAL_STATES = [
  'IDLE', 'SCANNING', 'OCR_EXTRACTING', 'VERIFYING', 'NEED_CONFIRMATION',
  'PROCESSING', 'WAITING', 'SETTLING', 'COMPLETED', 'FAILED', 'DUPLICATE', 'TIMEOUT',
] as const;
export type JobState = typeof CANONICAL_STATES[number];
export type SandboxAction = 'CONFIRM_PROCESS' | 'ADVANCE';

const TRANSITIONS: Record<JobState, readonly JobState[]> = {
  IDLE: ['SCANNING'], SCANNING: ['OCR_EXTRACTING', 'FAILED', 'TIMEOUT'],
  OCR_EXTRACTING: ['VERIFYING', 'FAILED', 'DUPLICATE'],
  VERIFYING: ['NEED_CONFIRMATION', 'FAILED', 'DUPLICATE'],
  NEED_CONFIRMATION: ['PROCESSING', 'TIMEOUT'],
  PROCESSING: ['WAITING', 'SETTLING', 'FAILED', 'TIMEOUT'],
  WAITING: ['PROCESSING', 'SETTLING', 'FAILED', 'TIMEOUT'],
  SETTLING: ['COMPLETED', 'FAILED', 'TIMEOUT'],
  COMPLETED: [], FAILED: [], DUPLICATE: [], TIMEOUT: [],
};

export function isJobState(value: unknown): value is JobState {
  return typeof value === 'string' && (CANONICAL_STATES as readonly string[]).includes(value);
}
export function canTransition(from: unknown, to: unknown): boolean {
  return isJobState(from) && isJobState(to) && TRANSITIONS[from].includes(to);
}
export function targetForCommand(action: string, from: JobState): JobState | null {
  return action === 'CONFIRM_PROCESS' && from === 'NEED_CONFIRMATION' ? 'PROCESSING' : null;
}
export function assertSandboxFlags(env: Record<string, string | undefined> = process.env): void {
  if (env.CE_VAULT_SANDBOX !== 'true') throw new Error('SANDBOX_MODE_REQUIRED');
  if (env.LIVE_SETTLEMENT !== 'false' || env.LIVE_SETTLEMENT_ENABLED !== 'false') {
    throw new Error('LIVE_SETTLEMENT_MUST_BE_FALSE');
  }
}
