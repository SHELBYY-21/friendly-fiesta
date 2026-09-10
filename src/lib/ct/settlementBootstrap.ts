/** One-shot setup for settlement FX + media (call from webhook cold start). */
import { setupAutoEffects } from './settlementEffects';
import { setupMedia } from './settlementMedia';

let booted = false;

export async function setupSettlementRuntime(): Promise<void> {
  if (booted) return;
  booted = true;
  await setupAutoEffects();
  setupMedia('auto');
}
