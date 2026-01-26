import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SentimentScoreBar } from '../sentiment-score-bar';
import { SentimentLabel } from '@/types/api';

describe('SentimentScoreBar', () => {
  describe('rendering', () => {
    it('renders with required props', () => {
      render(<SentimentScoreBar score={0.5} label={SentimentLabel.POSITIVE} />);

      expect(screen.getByText('+0.50')).toBeInTheDocument();
    });

  });

  describe('score formatting', () => {
    it('displays positive scores with + prefix', () => {
      render(
        <SentimentScoreBar score={0.75} label={SentimentLabel.POSITIVE} />,
      );

      expect(screen.getByText('+0.75')).toBeInTheDocument();
    });

    it('displays negative scores without + prefix', () => {
      render(
        <SentimentScoreBar score={-0.45} label={SentimentLabel.NEGATIVE} />,
      );

      expect(screen.getByText('-0.45')).toBeInTheDocument();
    });

    it('displays zero without + prefix', () => {
      render(<SentimentScoreBar score={0} label={SentimentLabel.NEUTRAL} />);

      expect(screen.getByText('0.00')).toBeInTheDocument();
    });

    it('displays maximum positive score (+1)', () => {
      render(<SentimentScoreBar score={1} label={SentimentLabel.POSITIVE} />);

      expect(screen.getByText('+1.00')).toBeInTheDocument();
    });

    it('displays maximum negative score (-1)', () => {
      render(<SentimentScoreBar score={-1} label={SentimentLabel.NEGATIVE} />);

      expect(screen.getByText('-1.00')).toBeInTheDocument();
    });

    it('displays scores with two decimal places', () => {
      render(
        <SentimentScoreBar score={0.333} label={SentimentLabel.POSITIVE} />,
      );

      expect(screen.getByText('+0.33')).toBeInTheDocument();
    });
  });

  describe('percentage calculation', () => {
    it('calculates 0% width for score -1', () => {
      const { container } = render(
        <SentimentScoreBar score={-1} label={SentimentLabel.NEGATIVE} />,
      );

      const fillBar = container.querySelector('[style*="width"]');
      expect(fillBar).toHaveStyle({ width: '0%' });
    });

    it('calculates 50% width for score 0', () => {
      const { container } = render(
        <SentimentScoreBar score={0} label={SentimentLabel.NEUTRAL} />,
      );

      const fillBar = container.querySelector('[style*="width"]');
      expect(fillBar).toHaveStyle({ width: '50%' });
    });

    it('calculates 100% width for score +1', () => {
      const { container } = render(
        <SentimentScoreBar score={1} label={SentimentLabel.POSITIVE} />,
      );

      const fillBar = container.querySelector('[style*="width"]');
      expect(fillBar).toHaveStyle({ width: '100%' });
    });

    it('calculates 75% width for score +0.5', () => {
      const { container } = render(
        <SentimentScoreBar score={0.5} label={SentimentLabel.POSITIVE} />,
      );

      const fillBar = container.querySelector('[style*="width"]');
      expect(fillBar).toHaveStyle({ width: '75%' });
    });

    it('calculates 25% width for score -0.5', () => {
      const { container } = render(
        <SentimentScoreBar score={-0.5} label={SentimentLabel.NEGATIVE} />,
      );

      const fillBar = container.querySelector('[style*="width"]');
      expect(fillBar).toHaveStyle({ width: '25%' });
    });
  });

  describe('edge cases', () => {
    it('handles score at boundary -0.1 (often neutral)', () => {
      render(<SentimentScoreBar score={-0.1} label={SentimentLabel.NEUTRAL} />);

      expect(screen.getByText('-0.10')).toBeInTheDocument();
    });

    it('handles score at boundary +0.1 (often neutral)', () => {
      render(<SentimentScoreBar score={0.1} label={SentimentLabel.NEUTRAL} />);

      expect(screen.getByText('+0.10')).toBeInTheDocument();
    });

    it('handles very small positive score', () => {
      render(
        <SentimentScoreBar score={0.001} label={SentimentLabel.NEUTRAL} />,
      );

      expect(screen.getByText('+0.00')).toBeInTheDocument();
    });

    it('handles very small negative score', () => {
      render(
        <SentimentScoreBar score={-0.001} label={SentimentLabel.NEUTRAL} />,
      );

      expect(screen.getByText('-0.00')).toBeInTheDocument();
    });
  });
});
