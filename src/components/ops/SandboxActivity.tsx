import type { SandboxActivity as Activity } from '@/lib/sandbox/activity';

export function SandboxActivity({ activity, disabled = false }: { activity: Activity; disabled?: boolean }) {
  if (disabled) return <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-5">Sandbox ปิดอยู่ตามค่าเริ่มต้น</div>;
  if (!activity.jobs.length) return <div className="rounded-xl border border-white/10 p-5">ยังไม่มี sandbox job</div>;
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-white/10 p-4">Outbox รอส่ง: {activity.pendingOutbox}</div><div className="rounded-xl border border-white/10 p-4">ส่งไม่สำเร็จ: {activity.failedOutbox}</div></div>
    {activity.jobs.map((job) => <article key={job.id} className="rounded-xl border border-white/10 p-4"><b>{job.reference}</b><span className="ml-3 text-amber-300">{job.state}</span><p className="mt-2 text-sm opacity-75">{job.summary}</p></article>)}
  </div>;
}
