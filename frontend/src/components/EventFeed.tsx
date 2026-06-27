import type { ContractEvent } from '../lib/types';
import { CONFIG } from '../lib/config';
import { truncate } from '../lib/format';

const ICONS: Record<string, string> = {
  create: '🆕',
  pledge: '💸',
  mint: '🎁',
  claim: '🏦',
  refund: '↩️',
  failed: '⚠️',
  transfer: '🔁',
  init: '⚙️',
};

export function EventFeed({ events }: { events: ContractEvent[] }) {
  return (
    <div className="card feed">
      <div className="feed-head">
        <h2>Live activity</h2>
        <span className="live">
          <span className="pulse" aria-hidden /> live
        </span>
      </div>

      {events.length === 0 ? (
        <p className="feed-empty">Listening for on-chain events…</p>
      ) : (
        <ul className="feed-list">
          {events.map((e, i) => (
            <li key={`${e.txHash}-${e.type}-${i}`} className="feed-item">
              <span className="feed-icon" aria-hidden>
                {ICONS[e.type] ?? '•'}
              </span>
              <div className="feed-body">
                <span className="feed-type">{e.type}</span>
                {e.topics[1] && <span className="feed-actor">{truncate(e.topics[1], 4, 4)}</span>}
                {e.txHash && (
                  <a
                    className="feed-link"
                    href={`${CONFIG.explorerBase}/tx/${e.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    tx ↗
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
