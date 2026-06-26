/**
 * Thin wrapper around @stellar/stellar-sdk for reading campaigns, submitting
 * transactions through Freighter, and streaming contract events.
 *
 * The read path (simulation) needs no wallet; the write path signs via Freighter.
 */
import {
  Account,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  rpc,
  xdr,
  Address,
} from '@stellar/stellar-sdk';
import { CONFIG } from './config';
import type { Campaign, ContractEvent } from './types';

const server = new rpc.Server(CONFIG.rpcUrl, { allowHttp: CONFIG.rpcUrl.startsWith('http://') });

function crowdfund() {
  return new Contract(CONFIG.crowdfundId);
}

/** Simulate a read-only call and return the decoded native result. */
async function simulateRead(method: string, args: xdr.ScVal[] = []): Promise<unknown> {
  // Simulation consumes no sequence number or fees, so a synthetic account with
  // any valid public key works as the transaction source.
  const account = new Account(DUMMY_ACCOUNT, '0');
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: CONFIG.networkPassphrase,
  })
    .addOperation(crowdfund().call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed for ${method}: ${sim.error}`);
  }
  const retval = sim.result?.retval;
  return retval ? scValToNative(retval) : undefined;
}

// Any well-formed account id works for read-only simulation.
const DUMMY_ACCOUNT = 'GBIYZWNE6HGKGGT2G73W6F7ZXXRQ2LP3RGLYIOOTZH6557A3EEBB4S7D';

/** Fetch and normalize all campaigns. */
export async function fetchCampaigns(): Promise<Campaign[]> {
  const raw = (await simulateRead('list_campaigns')) as
    | Map<number, Record<string, unknown>>
    | Record<string, unknown>
    | undefined;
  if (!raw) return [];

  const entries: Array<[number, Record<string, unknown>]> =
    raw instanceof Map
      ? Array.from(raw.entries())
      : Object.entries(raw).map(([k, v]) => [Number(k), v as Record<string, unknown>]);

  return entries
    .map(([, c]) => normalizeCampaign(c))
    .sort((a, b) => b.id - a.id);
}

export function normalizeCampaign(c: Record<string, unknown>): Campaign {
  const stateMap: Record<string, number> = {
    Active: 0,
    Successful: 1,
    Failed: 2,
    Claimed: 3,
  };
  const rawState = c.state as unknown;
  const state =
    typeof rawState === 'number'
      ? rawState
      : typeof rawState === 'string'
        ? (stateMap[rawState] ?? 0)
        : 0;
  return {
    id: Number(c.id),
    creator: String(c.creator),
    title: String(c.title),
    goal: String(c.goal),
    raised: String(c.raised),
    deadline: Number(c.deadline),
    state,
    backers: Number(c.backers ?? 0),
  };
}

/** Build, sign (via Freighter), and submit a contract invocation. Returns tx hash. */
export async function invoke(
  method: string,
  args: xdr.ScVal[],
  signXDR: (xdr: string) => Promise<string>,
  publicKey: string,
): Promise<string> {
  const account = await server.getAccount(publicKey);
  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: CONFIG.networkPassphrase,
  })
    .addOperation(crowdfund().call(method, ...args))
    .setTimeout(60)
    .build();

  const prepared = await server.prepareTransaction(built);
  const signed = await signXDR(prepared.toXDR());
  const tx = TransactionBuilder.fromXDR(signed, CONFIG.networkPassphrase);
  const sent = await server.sendTransaction(tx);

  if (sent.status === 'ERROR') {
    throw new Error(`Transaction submission failed: ${JSON.stringify(sent.errorResult)}`);
  }

  // Poll until the transaction is confirmed.
  let attempts = 0;
  let result = await server.getTransaction(sent.hash);
  while (result.status === rpc.Api.GetTransactionStatus.NOT_FOUND && attempts < 15) {
    await new Promise((r) => setTimeout(r, 1500));
    result = await server.getTransaction(sent.hash);
    attempts += 1;
  }
  if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
    throw new Error('Transaction failed on-chain');
  }
  return sent.hash;
}

// ---- ScVal argument builders ----

export const arg = {
  address: (a: string) => new Address(a).toScVal(),
  u32: (n: number) => nativeToScVal(n, { type: 'u32' }),
  u64: (n: number | bigint) => nativeToScVal(n, { type: 'u64' }),
  i128: (n: bigint) => nativeToScVal(n, { type: 'i128' }),
  string: (s: string) => nativeToScVal(s, { type: 'string' }),
};

// ---- Event streaming ----

/**
 * Poll the RPC for contract events since a starting ledger. This is the
 * "event streaming / real-time updates" mechanism: the UI calls this on an
 * interval and merges new events into its feed.
 */
export async function fetchEvents(startLedger?: number): Promise<{
  events: ContractEvent[];
  latestLedger: number;
}> {
  const latest = await server.getLatestLedger();
  const from = startLedger ?? Math.max(latest.sequence - 8000, 1);
  try {
    const res = await server.getEvents({
      startLedger: from,
      filters: [
        {
          type: 'contract',
          contractIds: [CONFIG.crowdfundId, CONFIG.rewardTokenId],
        },
      ],
      limit: 100,
    });
    const events: ContractEvent[] = res.events.map((e) => decodeEvent(e));
    return { events, latestLedger: res.latestLedger ?? latest.sequence };
  } catch {
    return { events: [], latestLedger: latest.sequence };
  }
}

export function decodeEvent(e: rpc.Api.EventResponse): ContractEvent {
  let topics: string[] = [];
  try {
    topics = e.topic.map((t) => {
      const native = scValToNative(t);
      return typeof native === 'string' ? native : JSON.stringify(native);
    });
  } catch {
    topics = [];
  }
  let value = '';
  try {
    value = JSON.stringify(scValToNative(e.value));
  } catch {
    value = '';
  }
  return {
    type: topics[0] ?? 'event',
    ledger: e.ledger,
    txHash: e.txHash ?? '',
    topics,
    value,
  };
}

export { CONFIG };
