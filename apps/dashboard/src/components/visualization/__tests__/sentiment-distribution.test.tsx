import { describe, expect, it } from 'vitest';
import { render, screen } from '@/__tests__/test-utils';
import { SentimentDistributionCard } from '../sentiment-distribution';

// Test data helpers
const createBreakdown = (
  positive: number,
  neutral: number,
  negative: number,
  positivePercent: number,
  neutralPercent: number,
  negativePercent: number,
) => ({
  positive,
  neutral,
  negative,
  positivePercent,
  neutralPercent,
  negativePercent,
});

const defaultBreakdown = createBreakdown(50, 30, 20, 50, 30, 20);

describe('SentimentDistributionCard', () => {
  describe('rendering', () => {
    it('renders the card with title', () => {
      render(<SentimentDistributionCard breakdown={defaultBreakdown} />);

      expect(screen.getByText('Distribution')).toBeInTheDocument();
    });

    it('renders the PieChart icon', () => {
      const { container } = render(
        <SentimentDistributionCard breakdown={defaultBreakdown} />,
      );

      // Icon should be present and hidden from screen readers
      const icon = container.querySelector('svg[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
    });

    it('renders without breakdown (empty state)', () => {
      render(<SentimentDistributionCard />);

      expect(screen.getByText('Distribution')).toBeInTheDocument();
      expect(screen.getByLabelText('No data available')).toBeInTheDocument();
    });

    it('renders em dash for empty state', () => {
      render(<SentimentDistributionCard />);

      // Em dash character
      expect(screen.getByText('\u2014')).toBeInTheDocument();
    });
  });

  describe('distribution bar', () => {
    it('renders distribution bar when breakdown is provided', () => {
      render(<SentimentDistributionCard breakdown={defaultBreakdown} />);

      const bar = screen.getByRole('img', { name: /Sentiment distribution/ });
      expect(bar).toBeInTheDocument();
    });

    it('has correct aria-label describing distribution', () => {
      render(<SentimentDistributionCard breakdown={defaultBreakdown} />);

      const bar = screen.getByRole('img');
      expect(bar).toHaveAttribute(
        'aria-label',
        'Sentiment distribution: 50% positive, 30% neutral, 20% negative',
      );
    });

    it('renders segments with correct widths', () => {
      const { container } = render(
        <SentimentDistributionCard breakdown={defaultBreakdown} />,
      );

      const bar = container.querySelector('[role="img"]');
      const segments = bar?.querySelectorAll('div');

      expect(segments?.[0]).toHaveStyle({ width: '50%' });
      expect(segments?.[1]).toHaveStyle({ width: '30%' });
      expect(segments?.[2]).toHaveStyle({ width: '20%' });
    });

    it('applies minimum width for non-zero percentages', () => {
      const breakdown = createBreakdown(1, 1, 98, 1, 1, 98);
      const { container } = render(
        <SentimentDistributionCard breakdown={breakdown} />,
      );

      const bar = container.querySelector('[role="img"]');
      const segments = bar?.querySelectorAll('div');

      // All non-zero segments should have minWidth
      expect(segments?.[0]).toHaveStyle({ minWidth: '4px' });
      expect(segments?.[1]).toHaveStyle({ minWidth: '4px' });
      expect(segments?.[2]).toHaveStyle({ minWidth: '4px' });
    });

    it('applies no minimum width for zero percentages', () => {
      const breakdown = createBreakdown(100, 0, 0, 100, 0, 0);
      const { container } = render(
        <SentimentDistributionCard breakdown={breakdown} />,
      );

      const bar = container.querySelector('[role="img"]');
      const segments = bar?.querySelectorAll('div');

      expect(segments?.[0]).toHaveStyle({ minWidth: '4px' }); // 100%
      expect(segments?.[1]).toHaveStyle({ minWidth: '0' }); // 0%
      expect(segments?.[2]).toHaveStyle({ minWidth: '0' }); // 0%
    });

  });

  describe('legend', () => {
    it('renders all three percentage values', () => {
      render(<SentimentDistributionCard breakdown={defaultBreakdown} />);

      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('30%')).toBeInTheDocument();
      expect(screen.getByText('20%')).toBeInTheDocument();
    });

    it('renders screen reader text for each category', () => {
      render(<SentimentDistributionCard breakdown={defaultBreakdown} />);

      // sr-only text
      expect(screen.getByText('Positive:')).toBeInTheDocument();
      expect(screen.getByText('Neutral:')).toBeInTheDocument();
      expect(screen.getByText('Negative:')).toBeInTheDocument();
    });

  });

  describe('accessibility', () => {
    it('has role="region" on the card', () => {
      render(<SentimentDistributionCard breakdown={defaultBreakdown} />);

      const region = screen.getByRole('region');
      expect(region).toBeInTheDocument();
    });

    it('has aria-labelledby pointing to title', () => {
      render(<SentimentDistributionCard breakdown={defaultBreakdown} />);

      const region = screen.getByRole('region');
      expect(region).toHaveAttribute('aria-labelledby', 'stat-distribution');

      const title = screen.getByText('Distribution');
      expect(title).toHaveAttribute('id', 'stat-distribution');
    });

    it('distribution bar has role="img"', () => {
      render(<SentimentDistributionCard breakdown={defaultBreakdown} />);

      const bar = screen.getByRole('img');
      expect(bar).toBeInTheDocument();
    });

    it('distribution bar has descriptive aria-label', () => {
      const breakdown = createBreakdown(25, 50, 25, 25, 50, 25);
      render(<SentimentDistributionCard breakdown={breakdown} />);

      const bar = screen.getByRole('img');
      expect(bar).toHaveAttribute(
        'aria-label',
        'Sentiment distribution: 25% positive, 50% neutral, 25% negative',
      );
    });

    it('empty state has aria-label', () => {
      render(<SentimentDistributionCard />);

      const emDash = screen.getByLabelText('No data available');
      expect(emDash).toBeInTheDocument();
    });

  });

  describe('edge cases', () => {
    it('handles all positive distribution', () => {
      const breakdown = createBreakdown(100, 0, 0, 100, 0, 0);
      render(<SentimentDistributionCard breakdown={breakdown} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getAllByText('0%')).toHaveLength(2);
    });

    it('handles all neutral distribution', () => {
      const breakdown = createBreakdown(0, 100, 0, 0, 100, 0);
      render(<SentimentDistributionCard breakdown={breakdown} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getAllByText('0%')).toHaveLength(2);
    });

    it('handles all negative distribution', () => {
      const breakdown = createBreakdown(0, 0, 100, 0, 0, 100);
      render(<SentimentDistributionCard breakdown={breakdown} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getAllByText('0%')).toHaveLength(2);
    });

    it('handles decimal percentages in aria-label', () => {
      // Component uses percentage values directly, so decimals are passed through
      const breakdown = createBreakdown(33, 33, 34, 33.33, 33.33, 33.34);
      render(<SentimentDistributionCard breakdown={breakdown} />);

      const bar = screen.getByRole('img');
      expect(bar).toHaveAttribute(
        'aria-label',
        'Sentiment distribution: 33.33% positive, 33.33% neutral, 33.34% negative',
      );
    });

    it('handles zero total distribution', () => {
      const breakdown = createBreakdown(0, 0, 0, 0, 0, 0);
      render(<SentimentDistributionCard breakdown={breakdown} />);

      expect(screen.getAllByText('0%')).toHaveLength(3);
    });
  });

});
