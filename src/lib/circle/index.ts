// Public server-side entry for Circle Smart Contract Platform scaffolding.
// Import only from API routes, server actions, or Node scripts.

export type { CircleClients, ScpClient, WalletsClient } from './clients';
export { getCircleClients, isCircleConfigured, resetCircleClients } from './clients';

export type { ContractTemplateKey, ScpBlockchain } from './config';
export {
  CONTRACT_TEMPLATES,
  DEFAULT_FEE,
  DEFAULT_SCP_BLOCKCHAIN,
  SCP_BLOCKCHAINS,
  isScpBlockchain,
  resolveScpBlockchain,
} from './config';

export type { TxTerminalState } from './helpers';
export {
  executeContract,
  importContract,
  newIdempotencyKey,
  queryContract,
  waitForContractDeployment,
  waitForTransaction,
} from './helpers';
