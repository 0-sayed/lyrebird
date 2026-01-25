import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import { StatsSummary, StatsSummarySkeleton } from '../stats-summary';

describe('StatsSummary', () => {
  it('renders all stat cards', () => {
    render(<StatsSummary averageSentiment={0.35} nss={42} />);

    expect(screen.getByText('Average')).toBeInTheDocument();
    expect(screen.getByText('NSS')).toBeInTheDocument();
    expect(screen.getByText('Distribution')).toBeInTheDocument();
    expect(screen.getByText('Momentum')).toBeInTheDocument();
    expect(screen.getByText('Rate')).toBeInTheDocument();
  });

  it('displays positive average sentiment with + prefix', () => {
    render(<StatsSummary averageSentiment={0.35} nss={null} />);

    expect(screen.getByText('+0.35')).toBeInTheDocument();
    expect(screen.getByText('Positive')).toBeInTheDocument();
  });

  it('displays negative average sentiment without + prefix', () => {
    render(<StatsSummary averageSentiment={-0.35} nss={null} />);

    expect(screen.getByText('-0.35')).toBeInTheDocument();
    expect(screen.getByText('Negative')).toBeInTheDocument();
  });

  it('displays neutral sentiment label for scores near zero', () => {
    render(<StatsSummary averageSentiment={0.05} nss={null} />);

    expect(screen.getByText('+0.05')).toBeInTheDocument();
    expect(screen.getByText('Neutral')).toBeInTheDocument();
  });

  it('displays em-dash for null average sentiment', () => {
    render(<StatsSummary averageSentiment={null} nss={null} />);

    // The Average card has role="region" with aria-labelledby="stat-average"
    const averageCard = screen.getByRole('region', { name: 'Average' });
    // Within the Average card, find the em-dash with its aria-label
    expect(within(averageCard).getByLabelText('No data available')).toHaveTextContent('—');
  });

  it('displays positive NSS with bullish label', () => {
    render(<StatsSummary averageSentiment={null} nss={42} />);

    expect(screen.getByText('+42')).toBeInTheDocument();
    expect(screen.getByText('Bullish')).toBeInTheDocument();
  });

  it('displays very positive NSS with very bullish label', () => {
    render(<StatsSummary averageSentiment={null} nss={75} />);

    expect(screen.getByText('+75')).toBeInTheDocument();
    expect(screen.getByText('Very Bullish')).toBeInTheDocument();
  });

  it('displays negative NSS with bearish label', () => {
    render(<StatsSummary averageSentiment={null} nss={-35} />);

    expect(screen.getByText('-35')).toBeInTheDocument();
    expect(screen.getByText('Bearish')).toBeInTheDocument();
  });

  it('shows live indicator when isLive is true', () => {
    render(<StatsSummary averageSentiment={0.5} nss={30} isLive />);

    // Test accessibility - screen reader text indicates live data
    expect(screen.getByText('Live data')).toBeInTheDocument();
  });

  it('shows rate with collecting data message when postsPerMinute is null', () => {
    render(
      <StatsSummary averageSentiment={0.5} nss={30} postsPerMinute={null} />,
    );

    // The Rate card should show the collecting data message
    expect(screen.getByText('Collecting data...')).toBeInTheDocument();
  });

  it('shows rate value when postsPerMinute is provided', () => {
    render(
      <StatsSummary averageSentiment={0.5} nss={30} postsPerMinute={12.5} />,
    );

    expect(screen.getByText('12.5/min')).toBeInTheDocument();
  });
});

describe('StatsSummarySkeleton', () => {
  it('renders with accessible loading state', () => {
    render(<StatsSummarySkeleton />);

    // Test accessibility - skeleton has loading role and label
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Loading statistics',
    );
    expect(screen.getByText('Loading statistics...')).toBeInTheDocument();
  });
});
