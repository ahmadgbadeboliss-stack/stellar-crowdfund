import { useState } from 'react';
import type { Campaign } from '../lib/types';
import { formatAmount, progressPct, timeLeft, deriveStatus, truncate } from '../lib/format';

interface Props {
  campaign: Campaign;
  onPledge: (id: number, amount: bigint) => void;
  busy: boolean;
  connected: boolean;
}

const DECIMALS = 7;

export function CampaignCard({ campaign, onPledge, busy, connected }: Props) {
  const [amount, setAmount] = useState('');
  const pct = progressPct(campaign.raised, campaign.goal);
  const status = deriveStatus(campaign);
  const ended = status === 'ended' || status === 'funded' || status === 'claimed';

  const submit = () => {
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) return;
    // Convert whole-token input to integer with 7 decimals.
    const scaled = BigInt(Math.round(parsed * 10 ** DECIMALS));
    onPledge(campaign.id, scaled);
    setAmount('');
  };

  return (
    <article className="card campaign-card">
      <div className="card-top">
        <span className={`status status-${status}`}>{status}</span>
        <span className="time-left">{timeLeft(campaign.deadline)}</span>
      </div>

      <h3 className="campaign-title">{campaign.title}</h3>
      <p className="creator">by {truncate(campaign.creator, 4, 4)}</p>

      <div className="progress" aria-label={`${pct}% funded`}>
        <div className="progress-bar" style={{ width: `${pct}%` }} />
      </div>

      <div className="stats">
        <div>
          <strong>{formatAmount(campaign.raised, DECIMALS)}</strong>
          <span>raised</span>
        </div>
        <div>
          <strong>{formatAmount(campaign.goal, DECIMALS)}</strong>
          <span>goal</span>
        </div>
        <div>
          <strong>{campaign.backers}</strong>
          <span>backers</span>
        </div>
      </div>

      {!ended ? (
        <div className="pledge-row">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label={`Pledge amount for ${campaign.title}`}
            disabled={busy}
          />
          <button className="primary" onClick={submit} disabled={busy || !amount || !connected}>
            {busy ? 'Pledging…' : 'Pledge'}
          </button>
        </div>
      ) : (
        <div className="ended-note">
          {status === 'claimed'
            ? '✅ Funds claimed by creator'
            : status === 'funded'
              ? '🎉 Goal reached'
              : '⌛ Campaign ended'}
        </div>
      )}
      {!connected && !ended && <p className="hint">Connect a wallet to pledge.</p>}
    </article>
  );
}
