import { getLatestRates, insertRate } from '../transactions';
import { getChatRate, setChatRate } from '../botSessions';
import { fetchMktRate, fetchUsdThb } from '../mkt';

export { fetchMktRate, fetchUsdThb };

export async function opsRates(chatId: number): Promise<{
  desk: number;
  mkt: number | null;
  usd: number | null;
}> {
  const [latest, chat, mkt, usd] = await Promise.all([
    getLatestRates().catch(() => null),
    getChatRate(chatId),
    fetchMktRate(),
    fetchUsdThb(),
  ]);
  const desk = Number(chat ?? latest?.sellRate ?? 0);
  return {
    desk: Number.isFinite(desk) && desk > 0 ? desk : 0,
    mkt,
    usd,
  };
}

export async function applyDeskRate(
  chatId: number,
  adminId: string,
  rate: number,
): Promise<{ desk: number; mkt: number | null }> {
  const mkt = await fetchMktRate();
  try {
    await setChatRate(chatId, rate);
  } catch {
    /* chat_settings may be missing; global rates still apply */
  }
  if (mkt) await insertRate(adminId, rate, mkt);
  return { desk: rate, mkt };
}
