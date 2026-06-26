/** Shared types mirroring the on-chain Campaign struct. */

export interface Campaign {
  id: number;
  creator: string;
  title: string;
  /** integer, 7 decimals */
  goal: string;
  /** integer, 7 decimals */
  raised: string;
  /** unix seconds */
  deadline: number;
  /** 0 Active, 1 Successful, 2 Failed, 3 Claimed */
  state: number;
  backers: number;
}

export interface ContractEvent {
  type: string;
  ledger: number;
  txHash: string;
  /** decoded topic symbols, e.g. ["pledge", "G..."] */
  topics: string[];
  /** best-effort decoded value summary */
  value: string;
}

export type WalletState =
  | { status: 'disconnected' }
  | { status: 'connecting' }
  | { status: 'connected'; address: string }
  | { status: 'error'; message: string };
