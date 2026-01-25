import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SentimentChart, SentimentChartCompact } from '../sentiment-chart';
import type { SentimentDistribution } from '@/types/api';

describe('SentimentChart', () => {
  const mockDistribution: SentimentDistribution = {
    positive: 50,
    neutral: 30,
    negative: 20,
  };

  const emptyDistribution: SentimentDistribution = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };

  describe('SentimentChart full component', () => {
    it('renders with title', () => {
      render(<SentimentChart distribution={mockDistribution} />);

      expect(screen.getByText('Sentiment Distribution')).toBeInTheDocument();
    });

    it('renders with custom title', () => {
      render(
        <SentimentChart distribution={mockDistribution} title="Custom Title" />,
      );

      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('displays no data message when distribution is empty', () => {
      render(<SentimentChart distribution={emptyDistribution} />);

      expect(
        screen.getByText('No sentiment data available'),
      ).toBeInTheDocument();
    });

    it('includes ARIA label with distribution data', () => {
      render(<SentimentChart distribution={mockDistribution} />);

      const chart = screen.getByRole('img');
      expect(chart).toHaveAttribute(
        'aria-label',
        expect.stringContaining('50 positive'),
      );
      expect(chart).toHaveAttribute(
        'aria-label',
        expect.stringContaining('30 neutral'),
      );
      expect(chart).toHaveAttribute(
        'aria-label',
        expect.stringContaining('20 negative'),
      );
    });

    it('shows legend when showLegend is true', () => {
      render(<SentimentChart distribution={mockDistribution} showLegend />);

      expect(screen.getByRole('list', { name: /legend/i })).toBeInTheDocument();
      expect(screen.getByText(/Positive/)).toBeInTheDocument();
      expect(screen.getByText(/Neutral/)).toBeInTheDocument();
      expect(screen.getByText(/Negative/)).toBeInTheDocument();
    });

    it('displays correct percentages in legend', () => {
      render(<SentimentChart distribution={mockDistribution} showLegend />);

      // 50/(50+30+20) = 50%
      expect(screen.getByText(/Positive: 50%/)).toBeInTheDocument();
      // 30/(50+30+20) = 30%
      expect(screen.getByText(/Neutral: 30%/)).toBeInTheDocument();
      // 20/(50+30+20) = 20%
      expect(screen.getByText(/Negative: 20%/)).toBeInTheDocument();
    });

    it('calculates NSS correctly', () => {
      // NSS = (positive - negative) / total * 100 = (50-20)/100*100 = 30
      render(<SentimentChart distribution={mockDistribution} />);

      const chart = screen.getByRole('img');
      expect(chart).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Net Sentiment Score: 30'),
      );
    });
  });

  describe('SentimentChartCompact', () => {
    it('renders compact chart', () => {
      render(<SentimentChartCompact distribution={mockDistribution} />);

      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('displays NSS value', () => {
      render(<SentimentChartCompact distribution={mockDistribution} />);

      // NSS = 30 (positive)
      expect(screen.getByText('+30')).toBeInTheDocument();
    });

    it('returns null for empty distribution', () => {
      const { container } = render(
        <SentimentChartCompact distribution={emptyDistribution} />,
      );

      expect(container.firstChild).toBeNull();
    });

    it('applies custom size', () => {
      const { container } = render(
        <SentimentChartCompact distribution={mockDistribution} size={200} />,
      );

      // Find the element with inline style
      const chartContainer = container.querySelector('[style*="width"]');
      expect(chartContainer).toHaveAttribute(
        'style',
        expect.stringContaining('200px'),
      );
    });
  });
});
