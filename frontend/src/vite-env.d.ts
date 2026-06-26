/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STELLAR_NETWORK?: string;
  readonly VITE_NETWORK_PASSPHRASE?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_CROWDFUND_ID?: string;
  readonly VITE_REWARD_TOKEN_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
