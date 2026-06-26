/**
 * Network + contract configuration.
 *
 * Values default to the deployed testnet contracts (see /deployments.json at the
 * repo root) but can be overridden at build time via Vite env vars so the same
 * bundle can target a different deployment without code changes.
 */
export const CONFIG = {
  network: import.meta.env.VITE_STELLAR_NETWORK ?? 'testnet',
  networkPassphrase:
    import.meta.env.VITE_NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015',
  rpcUrl: import.meta.env.VITE_RPC_URL ?? 'https://soroban-testnet.stellar.org',
  crowdfundId:
    import.meta.env.VITE_CROWDFUND_ID ??
    'CDBLYYBCBWN5ZRBSKK5764E7VQIQQSTD2GVB4WSAZW7L3ABNI4GM7KDP',
  rewardTokenId:
    import.meta.env.VITE_REWARD_TOKEN_ID ??
    'CBHFZFWUO22CZ74LXNZVU6AP2LCI3YEYYQ43RCP77IBS34PBLNF7GZW7',
  explorerBase: 'https://stellar.expert/explorer/testnet',
} as const;

export const txUrl = (hash: string) => `${CONFIG.explorerBase}/tx/${hash}`;
export const contractUrl = (id: string) => `${CONFIG.explorerBase}/contract/${id}`;
