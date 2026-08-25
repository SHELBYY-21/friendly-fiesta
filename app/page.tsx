import { cookies } from 'next/headers';
import PinGate from '@/components/PinGate';
import VaultDesk from '@/components/ct/VaultDesk';
import { SESSION_COOKIE, isAuthConfigured, verifySessionToken } from '@/lib/dashboardAuth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  if (isAuthConfigured()) {
    const store = await cookies();
    const ok = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
    if (!ok) {
      return (
        <main className="grid min-h-screen place-items-center px-6 py-12">
          <PinGate nextPath="/" />
        </main>
      );
    }
  }

  return <VaultDesk />;
}
