/**
 * Pure formatting/derivation helpers.
 *
 * These are deliberately free of any Stellar SDK or DOM dependency so they can be
 * unit-tested in isolation and reused across components.
 */
import type { Campaign } from './types';

/** Reward token / pledge amounts are stored as integers (stroops-like). */
export function formatAmount(raw: bigint | number | string, decimals = 7): string {
  const value = typeof raw === 'bigint' ? raw : BigInt(raw);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fracStr = frac
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '');
  const out = fracStr ? `${wholeStr}.${fracStr}` : wholeStr;
  return negative ? `-${out}` : out;
}

/** Progress toward goal as an integer percentage, clamped to 0..100. */
export function progressPct(
  raised: bigint | number | string,
  goal: bigint | number | string,
): number {
  const r = BigInt(raised);
  const g = BigInt(goal);
  if (g <= 0n) return 0;
  const pct = Number((r * 100n) / g);
  return Math.max(0, Math.min(100, pct));
}

/** Human readable time-until (or "Ended") for a unix-seconds deadline. */
export function timeLeft(deadlineSec: number | bigint, nowSec = Date.now() / 1000): string {
  const deadline = Number(deadlineSec);
  const diff = Math.floor(deadline - nowSec);
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

/** Shorten a Stellar address/contract id for display. */
export function truncate(id: string, head = 4, tail = 4): string {
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export type DerivedStatus = 'active' | 'funded' | 'ended' | 'claimed';

/** Derive a display status from raw campaign fields + current time. */
export function deriveStatus(c: Campaign, nowSec = Date.now() / 1000): DerivedStatus {
  if (c.state === 3) return 'claimed';
  const ended = Number(c.deadline) <= nowSec;
  const funded = BigInt(c.raised) >= BigInt(c.goal);
  if (funded && ended) return 'funded';
  if (funded) return 'funded';
  if (ended) return 'ended';
  return 'active';
}
