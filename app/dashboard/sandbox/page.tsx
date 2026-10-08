import { SandboxActivity } from '@/components/ops/SandboxActivity';
import { buildSandboxActivity } from '@/lib/sandbox/activity';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default async function SandboxPage() {
  const enabled = process.env.CE_VAULT_SANDBOX === 'true';
  let activity = buildSandboxActivity([], []);
  let unavailable = false;
  if (enabled) {
    const [jobs, events, outbox] = await Promise.all([
      supabaseAdmin.from('workflow_jobs').select('id,public_ref,state,summary,updated_at').order('updated_at', { ascending: false }).limit(25),
      supabaseAdmin.from('job_events').select('event_id,job_id,event_type,payload,occurred_at').order('occurred_at', { ascending: false }).limit(25),
      supabaseAdmin.from('outbox_messages').select('status,last_error_code').in('status', ['PENDING', 'FAILED']).limit(100),
    ]);
    unavailable = Boolean(jobs.error ?? events.error ?? outbox.error);
    if (!unavailable) activity = buildSandboxActivity(jobs.data ?? [], events.data ?? [], outbox.data ?? []);
  }
  return <main className="mx-auto max-w-5xl space-y-6 p-6"><div><p className="text-xs uppercase tracking-widest text-amber-300">isolated workflow</p><h1 className="text-3xl font-semibold">Sandbox Activity</h1><p className="mt-2 opacity-70">งานทดลองแยกจาก ledger และไม่โอนหรือ settle เงิน</p></div>{unavailable ? <div className="rounded-xl border border-red-400/30 p-5">ยังไม่ได้ติดตั้ง sandbox schema</div> : <SandboxActivity activity={activity} disabled={!enabled} />}</main>;
}
