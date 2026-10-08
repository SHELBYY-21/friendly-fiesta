import { createHash } from 'crypto';
import { assertSandboxFlags, canTransition, type JobState, type SandboxAction } from './contract';
import type { NewSandboxJob, SandboxJob, SandboxRepository } from './repository';

export interface AdminActor { id: string; isAdmin: boolean; }
export class SandboxCommandError extends Error { constructor(public code: string) { super(code); } }
const checkActor = (actor: AdminActor) => { if (!actor.isAdmin || !actor.id) throw new SandboxCommandError('ADMIN_REQUIRED'); };
export function createSandboxCommands(repository: SandboxRepository, env: Record<string, string | undefined> = process.env) {
  return {
    async createSandboxJob(input: NewSandboxJob, actor: AdminActor): Promise<SandboxJob> {
      assertSandboxFlags(env); checkActor(actor);
      if (!input.summary?.trim()) throw new SandboxCommandError('SUMMARY_REQUIRED');
      return repository.create({ ...input, summary: input.summary.trim(), actorId: actor.id });
    },
    async transitionSandboxJob(input: { jobId: string; expectedVersion: number; action: SandboxAction; toState: JobState; idempotencyKey: string }, actor: AdminActor): Promise<SandboxJob> {
      assertSandboxFlags(env); checkActor(actor);
      if (!input.jobId || !input.idempotencyKey) throw new SandboxCommandError('INVALID_REQUEST');
      // State authority remains in the locked RPC; reject impossible direct jumps before I/O.
      const knownFrom = input.action === 'CONFIRM_PROCESS' ? 'NEED_CONFIRMATION' : input.toState === 'SCANNING' ? 'IDLE' : null;
      if (knownFrom && !canTransition(knownFrom, input.toState)) throw new SandboxCommandError('INVALID_TRANSITION');
      if (input.toState === 'COMPLETED' && input.action === 'ADVANCE') throw new SandboxCommandError('INVALID_TRANSITION');
      const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
      return repository.transition({ ...input, requestHash, actorId: actor.id });
    },
  };
}
export const sandboxCommands = createSandboxCommands(sandboxRepositoryImport());
function sandboxRepositoryImport(): SandboxRepository {
  // Kept behind a function so unit tests can inject a repository without database access.
  return require('./repository').sandboxRepository as SandboxRepository;
}
