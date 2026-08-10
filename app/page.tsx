// Landing page — PIN gate. ถ้ามี session อยู่แล้วเด้งเข้า dashboard เลย
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import PinGate from '@/components/PinGate';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/dashboardAuth';

export const dynamic = 'force-dynamic';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const store = await cookies();
  if (await verifySessionToken(store.get(SESSION_COOKIE)?.value)) {
    redirect('/dashboard');
  }

  const { next } = await searchParams;
  const nextPath = next && next.startsWith('/') ? next : '/dashboard';

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <PinGate nextPath={nextPath} />
    </main>
  );
}
