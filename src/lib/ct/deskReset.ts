import { startNewDay } from '../botSessions';
import { ensureTodayPins } from '../banks';
import { parkOpenQueue } from './store';
import { ymdBkk } from './format';

export async function resetDesk(chatId: number): Promise<{
  parked: string[];
  parkedCount: number;
  dayCutAt: string;
  tag: string;
}> {
  const tag = `RESET:${ymdBkk()}`;
  const parked = await parkOpenQueue(chatId, tag);
  await startNewDay(chatId);
  await ensureTodayPins(chatId).catch(() => []);
  return {
    parked,
    parkedCount: parked.length,
    dayCutAt: new Date().toISOString(),
    tag,
  };
}
