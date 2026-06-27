import { useCallback, useEffect, useState } from 'react';
import type { Campaign, ContractEvent, WalletState } from './lib/types';
import { fetchCampaigns, fetchEvents, invoke, arg } from './lib/stellar';
import { connectWallet, signXDR } from './lib/wallet';
import { CONFIG } from './lib/config';
import { Header } from './components/Header';
import { CampaignCard } from './components/CampaignCard';
import { CreateCampaign } from './components/CreateCampaign';
import { EventFeed } from './components/EventFeed';
import { Toast, type ToastMsg } from './components/Toast';

export default function App() {
  const [wallet, setWallet] = useState<WalletState>({ status: 'disconnected' });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | 'create' | null>(null);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [cursor, setCursor] = useState<number | undefined>(undefined);

  const notify = useCallback((t: ToastMsg) => {
    setToast(t);
    setTimeout(() => setToast(null), 6000);
  }, []);

  const loadCampaigns = useCallback(async () => {
    try {
      setError(null);
      const list = await fetchCampaigns();
      setCampaigns(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaigns.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load.
  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  // Real-time event streaming: poll the RPC every 6s and merge new events.
  useEffect(() => {
    let active = true;
    const poll = async () => {
      const { events: fresh, latestLedger } = await fetchEvents(cursor);
      if (!active) return;
      if (fresh.length > 0) {
        setEvents((prev) => {
          const seen = new Set(prev.map((e) => `${e.txHash}:${e.type}:${e.ledger}`));
          const merged = [
            ...fresh.filter((e) => !seen.has(`${e.txHash}:${e.type}:${e.ledger}`)),
            ...prev,
          ];
          return merged.slice(0, 30);
        });
        // A new event likely changed campaign state — refresh.
        void loadCampaigns();
      }
      setCursor(latestLedger + 1);
    };
    void poll();
    const interval = setInterval(poll, 6000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [cursor, loadCampaigns]);

  const onConnect = async () => {
    setWallet({ status: 'connecting' });
    try {
      const address = await connectWallet();
      setWallet({ status: 'connected', address });
      notify({ kind: 'success', text: 'Wallet connected.' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to connect wallet.';
      setWallet({ status: 'error', message });
      notify({ kind: 'error', text: message });
    }
  };

  const requireWallet = (): string | null => {
    if (wallet.status !== 'connected') {
      notify({ kind: 'error', text: 'Connect your Freighter wallet first.' });
      return null;
    }
    return wallet.address;
  };

  const onCreate = async (title: string, goal: bigint, durationSecs: number) => {
    const address = requireWallet();
    if (!address) return;
    setBusyId('create');
    try {
      const hash = await invoke(
        'create_campaign',
        [arg.address(address), arg.string(title), arg.i128(goal), arg.u64(durationSecs)],
        signXDR,
        address,
      );
      notify({ kind: 'success', text: 'Campaign created!', txHash: hash });
      await loadCampaigns();
    } catch (e) {
      notify({ kind: 'error', text: e instanceof Error ? e.message : 'Create failed.' });
    } finally {
      setBusyId(null);
    }
  };

  const onPledge = async (id: number, amount: bigint) => {
    const address = requireWallet();
    if (!address) return;
    setBusyId(id);
    try {
      const hash = await invoke(
        'pledge',
        [arg.u32(id), arg.address(address), arg.i128(amount)],
        signXDR,
        address,
      );
      notify({ kind: 'success', text: 'Pledge confirmed — reward tokens minted!', txHash: hash });
      await loadCampaigns();
    } catch (e) {
      notify({ kind: 'error', text: e instanceof Error ? e.message : 'Pledge failed.' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="app">
      <Header wallet={wallet} onConnect={onConnect} />

      <main className="container">
        <section className="hero">
          <h1>Fund ideas on Stellar</h1>
          <p>
            On-chain crowdfunding with automatic backer rewards. Every pledge mints{' '}
            <strong>BRW</strong> reward tokens to your wallet via a cross-contract call.
          </p>
        </section>

        <CreateCampaign onCreate={onCreate} busy={busyId === 'create'} connected={wallet.status === 'connected'} />

        <div className="layout">
          <section className="campaigns" aria-label="Campaigns">
            <div className="section-head">
              <h2>Campaigns</h2>
              <button className="ghost" onClick={() => void loadCampaigns()} disabled={loading}>
                {loading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            {loading && campaigns.length === 0 && (
              <div className="grid">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="card skeleton" aria-hidden />
                ))}
              </div>
            )}

            {error && (
              <div className="banner error" role="alert">
                <span>⚠️ {error}</span>
                <button className="ghost" onClick={() => void loadCampaigns()}>
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && campaigns.length === 0 && (
              <div className="empty">
                <p>No campaigns yet. Be the first to create one! 🚀</p>
              </div>
            )}

            <div className="grid">
              {campaigns.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  onPledge={onPledge}
                  busy={busyId === c.id}
                  connected={wallet.status === 'connected'}
                />
              ))}
            </div>
          </section>

          <aside className="sidebar">
            <EventFeed events={events} />
          </aside>
        </div>
      </main>

      <footer className="footer">
        <span>
          Crowdfund&nbsp;
          <a href={`${CONFIG.explorerBase}/contract/${CONFIG.crowdfundId}`} target="_blank" rel="noreferrer">
            {CONFIG.crowdfundId.slice(0, 6)}…{CONFIG.crowdfundId.slice(-4)}
          </a>
        </span>
        <span>·</span>
        <span>
          Reward&nbsp;
          <a href={`${CONFIG.explorerBase}/contract/${CONFIG.rewardTokenId}`} target="_blank" rel="noreferrer">
            {CONFIG.rewardTokenId.slice(0, 6)}…{CONFIG.rewardTokenId.slice(-4)}
          </a>
        </span>
        <span>· Stellar Testnet</span>
      </footer>

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
