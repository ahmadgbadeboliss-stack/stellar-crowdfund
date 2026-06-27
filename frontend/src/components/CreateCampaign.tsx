import { useState } from 'react';

interface Props {
  onCreate: (title: string, goal: bigint, durationSecs: number) => void;
  busy: boolean;
  connected: boolean;
}

const DECIMALS = 7;

const DURATIONS = [
  { label: '1 day', secs: 86400 },
  { label: '7 days', secs: 604800 },
  { label: '30 days', secs: 2592000 },
];

export function CreateCampaign({ onCreate, busy, connected }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [duration, setDuration] = useState(DURATIONS[1].secs);
  const [err, setErr] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!title.trim()) return setErr('Title is required.');
    const g = Number(goal);
    if (!g || g <= 0) return setErr('Goal must be greater than zero.');
    const scaled = BigInt(Math.round(g * 10 ** DECIMALS));
    onCreate(title.trim(), scaled, duration);
    setTitle('');
    setGoal('');
  };

  return (
    <section className="create">
      <button
        className="create-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {open ? '× Close' : '+ Start a campaign'}
      </button>

      {open && (
        <form className="create-form card" onSubmit={submit}>
          <div className="field">
            <label htmlFor="c-title">Title</label>
            <input
              id="c-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Clean water for a village"
              maxLength={64}
              disabled={busy}
            />
          </div>

          <div className="field">
            <label htmlFor="c-goal">Goal (XLM-equiv units)</label>
            <input
              id="c-goal"
              type="number"
              min="0"
              step="any"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="1000"
              disabled={busy}
            />
          </div>

          <div className="field">
            <label htmlFor="c-duration">Duration</label>
            <select
              id="c-duration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              disabled={busy}
            >
              {DURATIONS.map((d) => (
                <option key={d.secs} value={d.secs}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {err && <p className="form-error" role="alert">{err}</p>}

          <button className="primary full" type="submit" disabled={busy || !connected}>
            {busy ? 'Creating…' : 'Create campaign'}
          </button>
          {!connected && <p className="hint">Connect a wallet to create a campaign.</p>}
        </form>
      )}
    </section>
  );
}
