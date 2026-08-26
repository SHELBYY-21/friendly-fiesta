'use client';

/** Browser must not subscribe to money tables. VaultDesk polls the API. */
export function useVaultLive(_onChange: () => void) {
  return false;
}
