import { describe, it, expect } from 'vitest';
import {
  formatAmount,
  progressPct,
  timeLeft,
  truncate,
  deriveStatus,
} from '../lib/format';
import type { Campaign } from '../lib/types';

describe('formatAmount', () => {
  it('formats integer stroops with 7 decimals and strips trailing zeros', () => {
    expect(formatAmount(5000000000n)).toBe('500');
    expect(formatAmount(1234500000n)).toBe('123.45');
    expect(formatAmount(0n)).toBe('0');
  });

  it('adds thousands separators', () => {
    expect(formatAmount(12345670000000n)).toBe('1,234,567');
  });

  it('handles string and number inputs', () => {
    expect(formatAmount('10000000')).toBe('1');
    expect(formatAmount(20000000)).toBe('2');
  });
});

describe('progressPct', () => {
  it('computes clamped percentage', () => {
    expect(progressPct(50, 100)).toBe(50);
    expect(progressPct(0, 100)).toBe(0);
    expect(progressPct(150, 100)).toBe(100); // over-funded clamps at 100
  });

  it('returns 0 when goal is zero to avoid div-by-zero', () => {
    expect(progressPct(10, 0)).toBe(0);
  });
});

describe('timeLeft', () => {
  const now = 1_000_000; // fixed reference in seconds
  it('reports days/hours when far out', () => {
    expect(timeLeft(now + 2 * 86400 + 3 * 3600, now)).toBe('2d 3h left');
  });

  it('reports Ended once the deadline passes', () => {
    expect(timeLeft(now - 10, now)).toBe('Ended');
  });

  it('reports minutes when under an hour', () => {
    expect(timeLeft(now + 45 * 60, now)).toBe('45m left');
  });
});

describe('truncate', () => {
  it('shortens long ids with an ellipsis', () => {
    const id = 'GBIYZWNE6HGKGGT2G73W6F7ZXXRQ2LP3RGLYIOOTZH6557A3EEBB4S7D';
    expect(truncate(id, 4, 4)).toBe('GBIY…4S7D');
  });

  it('leaves short strings unchanged', () => {
    expect(truncate('abc', 4, 4)).toBe('abc');
  });
});

describe('deriveStatus', () => {
  const base: Campaign = {
    id: 0,
    creator: 'G...',
    title: 't',
    goal: '1000',
    raised: '0',
    deadline: 2_000_000,
    state: 0,
    backers: 0,
  };

  it('is active when open and under goal', () => {
    expect(deriveStatus({ ...base, raised: '400' }, 1_000_000)).toBe('active');
  });

  it('is funded once raised meets goal', () => {
    expect(deriveStatus({ ...base, raised: '1000' }, 1_000_000)).toBe('funded');
  });

  it('is ended when past deadline and under goal', () => {
    expect(deriveStatus({ ...base, raised: '400', deadline: 500_000 }, 1_000_000)).toBe('ended');
  });

  it('is claimed when state is 3', () => {
    expect(deriveStatus({ ...base, state: 3 }, 1_000_000)).toBe('claimed');
  });
});
