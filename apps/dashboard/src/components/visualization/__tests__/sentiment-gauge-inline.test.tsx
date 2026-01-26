import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SentimentGaugeInline } from '../sentiment-gauge-inline';

describe('SentimentGaugeInline', () => {
  describe('rendering', () => {
    it('renders with required nss prop', () => {
      render(<SentimentGaugeInline nss={50} />);

      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('displays NSS value', () => {
      render(<SentimentGaugeInline nss={42} />);

      expect(screen.getByText('+42')).toBeInTheDocument();
    });

    it('displays description text', () => {
      render(<SentimentGaugeInline nss={42} />);

      expect(screen.getByText('Positive')).toBeInTheDocument();
    });
  });

  describe('NSS value formatting', () => {
    it('displays positive values with + prefix', () => {
      render(<SentimentGaugeInline nss={75} />);

      expect(screen.getByText('+75')).toBeInTheDocument();
    });

    it('displays negative values without + prefix', () => {
      render(<SentimentGaugeInline nss={-45} />);

      expect(screen.getByText('-45')).toBeInTheDocument();
    });

    it('displays zero without + prefix', () => {
      render(<SentimentGaugeInline nss={0} />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('displays maximum positive value', () => {
      render(<SentimentGaugeInline nss={100} />);

      expect(screen.getByText('+100')).toBeInTheDocument();
    });

    it('displays maximum negative value', () => {
      render(<SentimentGaugeInline nss={-100} />);

      expect(screen.getByText('-100')).toBeInTheDocument();
    });
  });

  describe('NSS descriptions', () => {
    it('shows "Very Positive" for nss >= 50', () => {
      render(<SentimentGaugeInline nss={50} />);

      expect(screen.getByText('Very Positive')).toBeInTheDocument();
    });

    it('shows "Very Positive" for nss = 100', () => {
      render(<SentimentGaugeInline nss={100} />);

      expect(screen.getByText('Very Positive')).toBeInTheDocument();
    });

    it('shows "Positive" for nss >= 20 and < 50', () => {
      render(<SentimentGaugeInline nss={35} />);

      expect(screen.getByText('Positive')).toBeInTheDocument();
    });

    it('shows "Positive" at lower boundary (nss = 20)', () => {
      render(<SentimentGaugeInline nss={20} />);

      expect(screen.getByText('Positive')).toBeInTheDocument();
    });

    it('shows "Neutral" for nss >= -20 and < 20', () => {
      render(<SentimentGaugeInline nss={0} />);

      expect(screen.getByText('Neutral')).toBeInTheDocument();
    });

    it('shows "Neutral" at upper boundary (nss = 19)', () => {
      render(<SentimentGaugeInline nss={19} />);

      expect(screen.getByText('Neutral')).toBeInTheDocument();
    });

    it('shows "Neutral" at lower boundary (nss = -20)', () => {
      render(<SentimentGaugeInline nss={-20} />);

      expect(screen.getByText('Neutral')).toBeInTheDocument();
    });

    it('shows "Negative" for nss >= -50 and < -20', () => {
      render(<SentimentGaugeInline nss={-35} />);

      expect(screen.getByText('Negative')).toBeInTheDocument();
    });

    it('shows "Negative" at upper boundary (nss = -21)', () => {
      render(<SentimentGaugeInline nss={-21} />);

      expect(screen.getByText('Negative')).toBeInTheDocument();
    });

    it('shows "Very Negative" for nss < -50', () => {
      render(<SentimentGaugeInline nss={-75} />);

      expect(screen.getByText('Very Negative')).toBeInTheDocument();
    });

    it('shows "Very Negative" for nss = -100', () => {
      render(<SentimentGaugeInline nss={-100} />);

      expect(screen.getByText('Very Negative')).toBeInTheDocument();
    });

    it('shows "Very Negative" at boundary (nss = -51)', () => {
      render(<SentimentGaugeInline nss={-51} />);

      expect(screen.getByText('Very Negative')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has role="img"', () => {
      render(<SentimentGaugeInline nss={50} />);

      const element = screen.getByRole('img');
      expect(element).toBeInTheDocument();
    });

    it('includes aria-label with NSS value', () => {
      render(<SentimentGaugeInline nss={42} />);

      const element = screen.getByRole('img');
      expect(element).toHaveAttribute(
        'aria-label',
        expect.stringContaining('42'),
      );
    });

    it('includes aria-label with description', () => {
      render(<SentimentGaugeInline nss={42} />);

      const element = screen.getByRole('img');
      expect(element).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Positive'),
      );
    });

    it('formats aria-label correctly for positive NSS', () => {
      render(<SentimentGaugeInline nss={75} />);

      const element = screen.getByRole('img');
      expect(element).toHaveAttribute(
        'aria-label',
        'Net Sentiment Score: 75. Very Positive',
      );
    });

    it('formats aria-label correctly for negative NSS', () => {
      render(<SentimentGaugeInline nss={-35} />);

      const element = screen.getByRole('img');
      expect(element).toHaveAttribute(
        'aria-label',
        'Net Sentiment Score: -35. Negative',
      );
    });

    it('formats aria-label correctly for zero NSS', () => {
      render(<SentimentGaugeInline nss={0} />);

      const element = screen.getByRole('img');
      expect(element).toHaveAttribute(
        'aria-label',
        'Net Sentiment Score: 0. Neutral',
      );
    });
  });

});
