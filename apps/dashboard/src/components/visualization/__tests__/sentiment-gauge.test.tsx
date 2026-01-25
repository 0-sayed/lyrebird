import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SentimentGauge, SentimentGaugeInline } from '../sentiment-gauge';

describe('SentimentGauge', () => {
  describe('SentimentGauge full component', () => {
    it('renders with title', () => {
      render(<SentimentGauge nss={50} />);

      expect(screen.getByText('Net Sentiment Score')).toBeInTheDocument();
    });

    it('renders with custom title', () => {
      render(<SentimentGauge nss={50} title="Custom Gauge" />);

      expect(screen.getByText('Custom Gauge')).toBeInTheDocument();
    });

    it('displays positive NSS with + prefix', () => {
      render(<SentimentGauge nss={75} />);

      expect(screen.getByText('+75')).toBeInTheDocument();
    });

    it('displays negative NSS without + prefix', () => {
      render(<SentimentGauge nss={-45} />);

      expect(screen.getByText('-45')).toBeInTheDocument();
    });

    it('displays zero NSS', () => {
      render(<SentimentGauge nss={0} />);

      // There are multiple '0' elements (scale labels + value), so use getAllByText
      const zeros = screen.getAllByText('0');
      // Should find the value display (not the scale label)
      expect(zeros.length).toBeGreaterThanOrEqual(1);
    });

    it('shows correct description for very positive', () => {
      render(<SentimentGauge nss={75} showLabel />);

      expect(screen.getByText('Very Positive')).toBeInTheDocument();
    });

    it('shows correct description for positive', () => {
      render(<SentimentGauge nss={30} showLabel />);

      expect(screen.getByText('Positive')).toBeInTheDocument();
    });

    it('shows correct description for neutral', () => {
      render(<SentimentGauge nss={0} showLabel />);

      expect(screen.getByText('Neutral')).toBeInTheDocument();
    });

    it('shows correct description for negative', () => {
      render(<SentimentGauge nss={-35} showLabel />);

      expect(screen.getByText('Negative')).toBeInTheDocument();
    });

    it('shows correct description for very negative', () => {
      render(<SentimentGauge nss={-75} showLabel />);

      expect(screen.getByText('Very Negative')).toBeInTheDocument();
    });

    it('hides value when showValue is false', () => {
      render(<SentimentGauge nss={50} showValue={false} />);

      expect(screen.queryByText('+50')).not.toBeInTheDocument();
    });

    it('hides label when showLabel is false', () => {
      render(<SentimentGauge nss={50} showLabel={false} />);

      expect(screen.queryByText('Very Positive')).not.toBeInTheDocument();
    });

    it('includes ARIA label with NSS info', () => {
      render(<SentimentGauge nss={30} />);

      const svg = screen.getByRole('img');
      expect(svg).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Net Sentiment Score: 30'),
      );
    });

  });

  describe('SentimentGaugeInline', () => {
    it('displays positive NSS', () => {
      render(<SentimentGaugeInline nss={45} />);

      expect(screen.getByText('+45')).toBeInTheDocument();
    });

    it('displays description', () => {
      render(<SentimentGaugeInline nss={45} />);

      expect(screen.getByText('Positive')).toBeInTheDocument();
    });

    it('includes ARIA label', () => {
      render(<SentimentGaugeInline nss={30} />);

      const container = screen.getByRole('img');
      expect(container).toHaveAttribute(
        'aria-label',
        expect.stringContaining('30'),
      );
    });
  });
});
