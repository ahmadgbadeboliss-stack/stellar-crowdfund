import type { WalletState } from '../lib/types';
import { truncate } from '../lib/format';

interface Props {
  wallet: WalletState;
  onConnect: () => void;
}

export function Header({ wallet, onConnect }: Props) {
  return (
    <header className="header">
      <div className="brand">
        <span className="logo" aria-hidden>
          ✦
        </span>
        <span className="brand-name">StellarFund</span>
      </div>

      <div className="wallet">
        {wallet.status === 'connected' ? (
          <span className="wallet-chip" title={wallet.address}>
            <span className="dot" aria-hidden />
            {truncate(wallet.address, 5, 4)}
          </span>
        ) : (
          <button className="primary" onClick={onConnect} disabled={wallet.status === 'connecting'}>
            {wallet.status === 'connecting' ? 'Connecting…' : 'Connect Wallet'}
          </button>
        )}
      </div>
    </header>
  );
}
