import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CampaignCard } from '../components/CampaignCard';
import type { Campaign } from '../lib/types';

const active: Campaign = {
  id: 1,
  creator: 'GBIYZWNE6HGKGGT2G73W6F7ZXXRQ2LP3RGLYIOOTZH6557A3EEBB4S7D',
  title: 'Clean Water Well',
  goal: '10000000000', // 1000.0
  raised: '5000000000', // 500.0
  deadline: Math.floor(Date.now() / 1000) + 86400,
  state: 0,
  backers: 3,
};

describe('CampaignCard', () => {
  it('renders title, raised/goal amounts and backer count', () => {
    render(<CampaignCard campaign={active} onPledge={() => {}} busy={false} connected />);
    expect(screen.getByText('Clean Water Well')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('submits a scaled pledge amount (7 decimals) when Pledge is clicked', () => {
    const onPledge = vi.fn();
    render(<CampaignCard campaign={active} onPledge={onPledge} busy={false} connected />);
    const input = screen.getByLabelText(/Pledge amount/i);
    fireEvent.change(input, { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /pledge/i }));
    expect(onPledge).toHaveBeenCalledWith(1, 1000000000n); // 100 * 10^7
  });

  it('disables pledging and shows a hint when wallet is not connected', () => {
    render(<CampaignCard campaign={active} onPledge={() => {}} busy={false} connected={false} />);
    expect(screen.getByRole('button', { name: /pledge/i })).toBeDisabled();
    expect(screen.getByText(/connect a wallet to pledge/i)).toBeInTheDocument();
  });

  it('shows an ended state instead of the pledge form once the deadline passes', () => {
    const ended: Campaign = {
      ...active,
      deadline: Math.floor(Date.now() / 1000) - 100,
      raised: '0',
    };
    render(<CampaignCard campaign={ended} onPledge={() => {}} busy={false} connected />);
    expect(screen.queryByRole('button', { name: /pledge/i })).not.toBeInTheDocument();
    expect(screen.getByText(/campaign ended/i)).toBeInTheDocument();
  });
});
