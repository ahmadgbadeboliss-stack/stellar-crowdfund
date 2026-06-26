/**
 * Freighter wallet integration.
 *
 * Freighter is the standard browser extension wallet for Stellar. We lazy-check
 * its presence so the app still renders (in read-only mode) without it installed.
 */
import {
  isConnected,
  isAllowed,
  setAllowed,
  getAddress,
  signTransaction,
} from '@stellar/freighter-api';
import { CONFIG } from './config';

export async function walletAvailable(): Promise<boolean> {
  try {
    const res = await isConnected();
    return !!res.isConnected;
  } catch {
    return false;
  }
}

export async function connectWallet(): Promise<string> {
  const available = await walletAvailable();
  if (!available) {
    throw new Error(
      'Freighter wallet not detected. Install it from freighter.app to pledge on-chain.',
    );
  }
  const allowed = await isAllowed();
  if (!allowed.isAllowed) {
    await setAllowed();
  }
  const { address, error } = await getAddress();
  if (error || !address) {
    throw new Error(error || 'Could not read wallet address.');
  }
  return address;
}

export async function signXDR(xdr: string): Promise<string> {
  const { signedTxXdr, error } = await signTransaction(xdr, {
    networkPassphrase: CONFIG.networkPassphrase,
  });
  if (error || !signedTxXdr) {
    throw new Error(typeof error === 'string' ? error : 'User rejected or signing failed.');
  }
  return signedTxXdr;
}
