import { supabaseAdmin } from '../supabaseAdmin';
import type { JobState } from './contract';

export interface SandboxJob { id: string; publicRef: string; state: JobState; stateVersion: number; summary?: string; amount?: number | null; currency?: string; }
export interface NewSandboxJob { summary: string; amount?: number | null; currency?: string; }
export interface SandboxRepository {
  create(input: NewSandboxJob & { actorId: string }): Promise<SandboxJob>;
  transition(input: { jobId: string; expectedVersion: number; toState: JobState; idempotencyKey: string; requestHash: string; actorId: string }): Promise<SandboxJob>;
}
const mapJob = (row: any): SandboxJob => ({ id: String(row.job_id ?? row.id), publicRef: String(row.public_ref ?? ''), state: row.state, stateVersion: Number(row.state_version), summary: row.summary, amount: row.amount == null ? null : Number(row.amount), currency: row.currency });
export const sandboxRepository: SandboxRepository = {
  async create(input) {
    const { data, error } = await supabaseAdmin.rpc('create_sandbox_workflow_job', { p_summary: input.summary, p_amount: input.amount ?? null, p_currency: input.currency ?? 'THB', p_actor_id: input.actorId });
    if (error) throw error;
    return mapJob(data);
  },
  async transition(input) {
    const { data, error } = await supabaseAdmin.rpc('transition_sandbox_job', { p_job_id: input.jobId, p_expected_version: input.expectedVersion, p_to_state: input.toState, p_idempotency_key: input.idempotencyKey, p_request_hash: input.requestHash, p_actor_id: input.actorId });
    if (error) throw error;
    return mapJob(data);
  },
};
